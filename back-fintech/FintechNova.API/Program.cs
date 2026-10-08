using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Puerto dinámico para Render y desarrollo local
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// ==========================================
// CONFIGURACIÓN: JWT
// ==========================================
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSettings["Key"];
if (string.IsNullOrWhiteSpace(secretKey) || Encoding.UTF8.GetByteCount(secretKey) < 32)
    throw new InvalidOperationException("Jwt:Key debe existir y tener al menos 32 caracteres.");

// ==========================================
// CONFIGURACIÓN: CORS (solo tu frontend)
// ==========================================
var origenesPermitidos = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
if (origenesPermitidos is null || origenesPermitidos.Length == 0)
    origenesPermitidos = new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(origenesPermitidos)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ==========================================
// AUTENTICACIÓN Y AUTORIZACIÓN
// ==========================================
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Mantiene los nombres cortos de los claims ("sub", "role", "name")
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            NameClaimType = "name",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy => policy.RequireRole("ADMIN"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Autenticación JWT. Escribe la palabra 'Bearer' seguida de un espacio y luego tu token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

app.UseCors("AllowFrontend");

// Swagger solo en desarrollo
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

var dataSource = NpgsqlDataSource.Create(
    builder.Configuration.GetConnectionString("DefaultConnection")!
);

// ==========================================
// REGLAS DE NEGOCIO Y BANDERAS DE ENTORNO
// ==========================================
const decimal MontoMin = 500m;
const decimal MontoMax = 50000m;
const int PasswordMin = 8;
int[] plazosValidos = { 6, 12, 24, 36 };
var curpRegex = new Regex(@"^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$");

// Por defecto solo se habilitan en desarrollo. En producción hay que activarlas por configuración.
var pagoManualHabilitado = app.Environment.IsDevelopment()
    || app.Configuration.GetValue<bool>("Pagos:PagoManualHabilitado");
var simuladorSpeiHabilitado = app.Environment.IsDevelopment()
    || app.Configuration.GetValue<bool>("Spei:SimuladorHabilitado");
var speiWebhookSecret = app.Configuration["Spei:WebhookSecret"];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
static int? IdDe(ClaimsPrincipal u) =>
    int.TryParse(u.FindFirst("sub")?.Value, out var id) ? id : null;

static bool EsAdmin(ClaimsPrincipal u) => u.IsInRole("ADMIN");

// Un cliente solo puede tocar lo suyo; el admin puede ver todo
static bool Puede(ClaimsPrincipal u, int idDueno) => EsAdmin(u) || IdDe(u) == idDueno;

static IResult Prohibido() =>
    Results.Json(new { mensaje = "No tienes permiso para esta acción." }, statusCode: StatusCodes.Status403Forbidden);

static IResult Invalido(string mensaje) => Results.BadRequest(new { mensaje });

static IResult CredencialesInvalidas() =>
    Results.Json(new { mensaje = "Correo o contraseña incorrectos." }, statusCode: StatusCodes.Status401Unauthorized);

static bool EmailValido(string email) =>
    MailAddress.TryCreate(email, out var m) && m.Address == email;

static bool SecretoIgual(string recibido, string esperado) =>
    CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(recibido), Encoding.UTF8.GetBytes(esperado));

// Acepta hashes BCrypt y, mientras se migran, contraseñas antiguas en texto plano
static bool VerificarPassword(string plano, string guardado, out bool necesitaMigrar)
{
    necesitaMigrar = false;

    if (guardado.StartsWith("$2"))
    {
        try { return BCrypt.Net.BCrypt.Verify(plano, guardado); }
        catch { return false; }
    }

    var coincide = SecretoIgual(plano, guardado);
    necesitaMigrar = coincide;
    return coincide;
}

IResult Fallo(Exception ex, string contexto)
{
    app.Logger.LogError(ex, "{Contexto}", contexto);
    return Results.Problem(detail: contexto);
}

// ==========================================
// ENDPOINTS DE USUARIOS Y AUTENTICACIÓN
// ==========================================

app.MapPost("/api/registro", async (RegistroDto nuevoUsuario) =>
{
    var nombre = (nuevoUsuario.Nombre ?? "").Trim();
    var email = (nuevoUsuario.Email ?? "").Trim().ToLowerInvariant();
    var password = nuevoUsuario.Password ?? "";

    if (nombre.Length == 0 || nombre.Length > 100)
        return Invalido("Escribe tu nombre completo (máximo 100 caracteres).");
    if (email.Length > 100 || !EmailValido(email))
        return Invalido("El correo electrónico no es válido.");
    if (password.Length < PasswordMin || Encoding.UTF8.GetByteCount(password) > 72)
        return Invalido($"La contraseña debe tener entre {PasswordMin} y 72 caracteres.");

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        using (var cmdExiste = new NpgsqlCommand("SELECT 1 FROM usuario WHERE LOWER(email) = @email LIMIT 1;", conn))
        {
            cmdExiste.Parameters.AddWithValue("email", email);
            if (await cmdExiste.ExecuteScalarAsync() is not null)
                return Results.Conflict(new { mensaje = "Ya existe una cuenta con ese correo." });
        }

        var hash = BCrypt.Net.BCrypt.HashPassword(password);

        string sql = "INSERT INTO usuario (nombre, email, password) VALUES (@nombre, @email, @pass) RETURNING id_usuario;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("nombre", nombre);
        cmd.Parameters.AddWithValue("email", email);
        cmd.Parameters.AddWithValue("pass", hash);
        int idCreado = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        return Results.Ok(new { Mensaje = "Usuario creado con éxito", UsuarioId = idCreado });
    }
    catch (PostgresException pex) when (pex.SqlState == PostgresErrorCodes.UniqueViolation)
    {
        return Results.Conflict(new { mensaje = "Ya existe una cuenta con ese correo." });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No pudimos crear tu cuenta. Intenta de nuevo.");
    }
});

app.MapPost("/api/login", async (LoginDto loginInfo) =>
{
    var email = (loginInfo.Email ?? "").Trim().ToLowerInvariant();
    var password = loginInfo.Password ?? "";
    if (email.Length == 0 || password.Length == 0) return CredencialesInvalidas();

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        int idUsuario;
        string nombreUsuario, rol, guardado;

        using (var cmd = new NpgsqlCommand(
            "SELECT id_usuario, nombre, rol, password FROM usuario WHERE LOWER(email) = @email;", conn))
        {
            cmd.Parameters.AddWithValue("email", email);
            using var reader = await cmd.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return CredencialesInvalidas();

            idUsuario = reader.GetInt32(0);
            nombreUsuario = reader.GetString(1);
            rol = reader.IsDBNull(2) ? "CLIENTE" : reader.GetString(2);
            guardado = reader.GetString(3);
        }

        if (!VerificarPassword(password, guardado, out var necesitaMigrar))
            return CredencialesInvalidas();

        // Cuenta antigua: se guarda el hash la primera vez que inicia sesión
        if (necesitaMigrar)
        {
            using var cmdMigrar = new NpgsqlCommand("UPDATE usuario SET password = @hash WHERE id_usuario = @id;", conn);
            cmdMigrar.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(password));
            cmdMigrar.Parameters.AddWithValue("id", idUsuario);
            await cmdMigrar.ExecuteNonQueryAsync();
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim("sub", idUsuario.ToString()),
            new Claim("name", nombreUsuario),
            new Claim("role", rol)
        };
        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );
        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

        return Results.Ok(new { token = tokenString, usuario = nombreUsuario, rol = rol, idUsuario = idUsuario });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No pudimos iniciar sesión. Intenta de nuevo.");
    }
});

app.MapGet("/api/usuarios", async () =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var usuarios = new List<object>();
        string sql = "SELECT id_usuario, nombre, email, rol FROM usuario;";
        using var cmd = new NpgsqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            usuarios.Add(new
            {
                IdUsuario = reader.GetInt32(0),
                Nombre = reader.GetString(1),
                Email = reader.GetString(2),
                Rol = reader.IsDBNull(3) ? "CLIENTE" : reader.GetString(3)
            });
        }
        return Results.Ok(usuarios);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo cargar la lista de usuarios.");
    }
}).RequireAuthorization("Admin");

app.MapDelete("/api/usuarios/{id}", async (int id) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        // No se pueden eliminar cuentas de administrador
        string? rolObjetivo;
        using (var cmdRol = new NpgsqlCommand("SELECT rol FROM usuario WHERE id_usuario = @id;", conn, tx))
        {
            cmdRol.Parameters.AddWithValue("id", id);
            var r = await cmdRol.ExecuteScalarAsync();
            if (r is null)
            {
                await tx.RollbackAsync();
                return Results.NotFound(new { Mensaje = "Usuario no encontrado." });
            }
            rolObjetivo = r is DBNull ? "CLIENTE" : (string)r;
        }

        if (rolObjetivo == "ADMIN")
        {
            await tx.RollbackAsync();
            return Invalido("No se puede eliminar una cuenta de administrador.");
        }

        string sqlDelTx = @"DELETE FROM TRANSACCION
                            WHERE id_prestamo IN (SELECT id_prestamo FROM PRESTAMO WHERE id_usuario = @id);";
        using (var cmdDelTx = new NpgsqlCommand(sqlDelTx, conn, tx))
        {
            cmdDelTx.Parameters.AddWithValue("id", id);
            await cmdDelTx.ExecuteNonQueryAsync();
        }

        using (var cmdDelPrestamos = new NpgsqlCommand("DELETE FROM PRESTAMO WHERE id_usuario = @id;", conn, tx))
        {
            cmdDelPrestamos.Parameters.AddWithValue("id", id);
            await cmdDelPrestamos.ExecuteNonQueryAsync();
        }

        using (var cmdDelSol = new NpgsqlCommand("DELETE FROM SOLICITUD_PRESTAMO WHERE id_usuario = @id;", conn, tx))
        {
            cmdDelSol.Parameters.AddWithValue("id", id);
            await cmdDelSol.ExecuteNonQueryAsync();
        }

        int filasAfectadas;
        using (var cmdDelUser = new NpgsqlCommand("DELETE FROM usuario WHERE id_usuario = @id;", conn, tx))
        {
            cmdDelUser.Parameters.AddWithValue("id", id);
            filasAfectadas = await cmdDelUser.ExecuteNonQueryAsync();
        }

        if (filasAfectadas == 0)
        {
            await tx.RollbackAsync();
            return Results.NotFound(new { Mensaje = "Usuario no encontrado." });
        }

        await tx.CommitAsync();
        return Results.Ok(new { Mensaje = "Cuenta y datos asociados eliminados correctamente." });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Fallo(ex, "No se pudo eliminar la cuenta.");
    }
}).RequireAuthorization("Admin");

// ==========================================
// ENDPOINTS DE SOLICITUDES
// ==========================================

app.MapGet("/api/solicitudes", async () =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var solicitudes = new List<object>();
        string sql = @"SELECT s.id_solicitud, s.id_usuario, u.nombre, s.monto_solicitado, 
                      s.plazo_meses, s.estado, s.curp, s.ine, s.recibo_luz_agua, 
                      s.comprobante_ingresos, s.estado_cuenta 
                      FROM SOLICITUD_PRESTAMO s 
                      JOIN usuario u ON s.id_usuario = u.id_usuario;";
        using var cmd = new NpgsqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            solicitudes.Add(new
            {
                IdSolicitud = reader.GetInt32(0),
                IdUsuario = reader.GetInt32(1),
                Nombre = reader.GetString(2),
                MontoSolicitado = reader.GetDecimal(3),
                PlazoMeses = reader.GetInt32(4),
                Estado = reader.GetString(5),
                CURP = reader.IsDBNull(6) ? "" : reader.GetString(6),
                INE = reader.IsDBNull(7) ? "" : reader.GetString(7),
                ReciboLuzAgua = reader.IsDBNull(8) ? "" : reader.GetString(8),
                ComprobanteIngresos = reader.IsDBNull(9) ? "" : reader.GetString(9),
                EstadoCuenta = reader.IsDBNull(10) ? "" : reader.GetString(10)
            });
        }
        return Results.Ok(solicitudes);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudieron cargar las solicitudes.");
    }
}).RequireAuthorization("Admin");

app.MapGet("/api/solicitudes/usuario/{idUsuario}", async (int idUsuario, ClaimsPrincipal user) =>
{
    if (!Puede(user, idUsuario)) return Prohibido();

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = @"SELECT id_solicitud, monto_solicitado, plazo_meses, estado 
                      FROM SOLICITUD_PRESTAMO 
                      WHERE id_usuario = @idUsuario 
                      ORDER BY id_solicitud DESC 
                      LIMIT 1;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("idUsuario", idUsuario);
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return Results.Ok(new
            {
                IdSolicitud = reader.GetInt32(0),
                MontoSolicitado = reader.GetDecimal(1),
                PlazoMeses = reader.GetInt32(2),
                Estado = reader.GetString(3)
            });
        }
        return Results.Ok(null);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo consultar la solicitud.");
    }
}).RequireAuthorization();

// Solo permite pasar una solicitud a PENDIENTE o RECHAZADA.
// La aprobación se hace únicamente con /api/admin/solicitudes/{id}/aprobar
app.MapPut("/api/solicitudes/{id}/estado", async (int id, DecisionDto decision) =>
{
    var estado = (decision.Estado ?? "").Trim().ToUpperInvariant();
    if (estado != "PENDIENTE" && estado != "RECHAZADA")
        return Invalido("Estado no permitido. Usa PENDIENTE o RECHAZADA.");

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "UPDATE SOLICITUD_PRESTAMO SET estado = @estado WHERE id_solicitud = @id;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("estado", estado);
        int filas = await cmd.ExecuteNonQueryAsync();
        if (filas == 0) return Results.NotFound(new { Mensaje = "Solicitud no encontrada." });
        return Results.Ok(new { Mensaje = "Estado actualizado" });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo actualizar el estado.");
    }
}).RequireAuthorization("Admin");

// ==========================================
// ENDPOINTS DE PRÉSTAMOS
// ==========================================

app.MapPost("/api/prestamos/simular", async (SolicitudDto request, ClaimsPrincipal user) =>
{
    // El usuario sale del token, no del cuerpo de la petición
    var idUsuario = IdDe(user);
    if (idUsuario is null) return Results.Unauthorized();

    if (request.Monto < MontoMin || request.Monto > MontoMax || Math.Round(request.Monto, 2) != request.Monto)
        return Invalido($"El monto debe estar entre ${MontoMin:N0} y ${MontoMax:N0}.");
    if (!plazosValidos.Contains(request.Meses))
        return Invalido("El plazo debe ser de 6, 12, 24 o 36 meses.");

    var curp = (request.CURP ?? "").Trim().ToUpperInvariant();
    if (!curpRegex.IsMatch(curp))
        return Invalido("El CURP no tiene un formato válido.");

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sqlSolicitud = @"INSERT INTO SOLICITUD_PRESTAMO 
            (id_usuario, monto_solicitado, plazo_meses, estado, curp, ine, recibo_luz_agua, comprobante_ingresos, estado_cuenta) 
            VALUES (@idUser, @monto, @plazo, 'PENDIENTE', @curp, 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente') 
            RETURNING id_solicitud;";

        using var cmdSolicitud = new NpgsqlCommand(sqlSolicitud, conn);
        cmdSolicitud.Parameters.AddWithValue("idUser", idUsuario.Value);
        cmdSolicitud.Parameters.AddWithValue("monto", request.Monto);
        cmdSolicitud.Parameters.AddWithValue("plazo", request.Meses);
        cmdSolicitud.Parameters.AddWithValue("curp", curp);

        int idSolicitud = Convert.ToInt32(await cmdSolicitud.ExecuteScalarAsync());

        return Results.Ok(new { Mensaje = "Solicitud enviada a revisión exitosamente", SolicitudId = idSolicitud });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo registrar tu solicitud. Intenta de nuevo.");
    }
}).RequireAuthorization();

app.MapGet("/api/prestamos/{id}", async (int id, ClaimsPrincipal user) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "SELECT id_prestamo, id_usuario, monto_aprobado, saldo_pendiente FROM PRESTAMO WHERE id_prestamo = @id;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            int idDueno = reader.IsDBNull(1) ? -1 : reader.GetInt32(1);
            if (!Puede(user, idDueno)) return Prohibido();

            return Results.Ok(new
            {
                IdPrestamo = reader.GetInt32(0),
                IdUsuario = idDueno,
                MontoAprobado = reader.GetDecimal(2),
                SaldoPendiente = reader.GetDecimal(3)
            });
        }
        return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo consultar el préstamo.");
    }
}).RequireAuthorization();

app.MapGet("/api/prestamos/usuario/{idUsuario}", async (int idUsuario, ClaimsPrincipal user) =>
{
    if (!Puede(user, idUsuario)) return Prohibido();

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var prestamos = new List<object>();
        string sql = "SELECT id_prestamo, monto_aprobado, tasa_interes, saldo_pendiente FROM PRESTAMO WHERE id_usuario = @idUsuario;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("idUsuario", idUsuario);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            prestamos.Add(new
            {
                IdPrestamo = reader.GetInt32(0),
                MontoAprobado = reader.GetDecimal(1),
                TasaInteres = reader.GetDecimal(2),
                SaldoPendiente = reader.GetDecimal(3)
            });
        }
        return Results.Ok(prestamos);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudieron cargar tus préstamos.");
    }
}).RequireAuthorization();

app.MapPut("/api/prestamos/{id}", async (int id, PrestamoUpdateDto request) =>
{
    if (request.MontoAprobado <= 0 || request.SaldoPendiente < 0)
        return Invalido("El monto debe ser mayor a 0 y el saldo no puede ser negativo.");

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "UPDATE PRESTAMO SET monto_aprobado = @monto, saldo_pendiente = @saldo WHERE id_prestamo = @id;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("monto", request.MontoAprobado);
        cmd.Parameters.AddWithValue("saldo", request.SaldoPendiente);
        int filasAfectadas = await cmd.ExecuteNonQueryAsync();
        if (filasAfectadas > 0)
            return Results.Ok(new { Mensaje = "Préstamo actualizado correctamente" });
        return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo actualizar el préstamo.");
    }
}).RequireAuthorization("Admin");

app.MapDelete("/api/prestamos/{id}", async (int id) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        using (var cmdTx = new NpgsqlCommand("DELETE FROM TRANSACCION WHERE id_prestamo = @id;", conn, tx))
        {
            cmdTx.Parameters.AddWithValue("id", id);
            await cmdTx.ExecuteNonQueryAsync();
        }

        int filasAfectadas;
        using (var cmd = new NpgsqlCommand("DELETE FROM PRESTAMO WHERE id_prestamo = @id;", conn, tx))
        {
            cmd.Parameters.AddWithValue("id", id);
            filasAfectadas = await cmd.ExecuteNonQueryAsync();
        }

        if (filasAfectadas == 0)
        {
            await tx.RollbackAsync();
            return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
        }

        await tx.CommitAsync();
        return Results.Ok(new { Mensaje = "Préstamo eliminado del sistema" });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Fallo(ex, "No se pudo eliminar el préstamo.");
    }
}).RequireAuthorization("Admin");

// ==========================================
// ENDPOINTS DE TRANSACCIONES Y PAGOS
// ==========================================

app.MapGet("/api/transacciones/usuario/{idUsuario}", async (int idUsuario, ClaimsPrincipal user) =>
{
    if (!Puede(user, idUsuario)) return Prohibido();

    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var transacciones = new List<object>();
        string sql = @"SELECT t.id_transaccion, t.tipo_transaccion, t.monto, t.estado, COALESCE(t.fecha_transaccion, CURRENT_TIMESTAMP) 
              FROM TRANSACCION t
              JOIN PRESTAMO p ON t.id_prestamo = p.id_prestamo
              WHERE p.id_usuario = @idUsuario
              ORDER BY t.fecha_transaccion DESC;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("idUsuario", idUsuario);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            transacciones.Add(new
            {
                IdTransaccion = reader.GetInt32(0),
                TipoTransaccion = reader.IsDBNull(1) ? "" : reader.GetString(1),
                Monto = reader.GetDecimal(2),
                Estado = reader.IsDBNull(3) ? "" : reader.GetString(3),
                Fecha = reader.IsDBNull(4) ? DateTime.Now.ToString("dd/MM/yyyy") : reader.GetDateTime(4).ToString("dd/MM/yyyy")
            });
        }
        return Results.Ok(transacciones);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo cargar tu historial.");
    }
}).RequireAuthorization();

// Abono manual: solo si está habilitado por configuración (por defecto, solo en desarrollo)
app.MapPost("/api/prestamos/{idPrestamo}/pagar", async (int idPrestamo, PagoDto pago, ClaimsPrincipal user) =>
{
    if (!pagoManualHabilitado)
        return Results.Json(
            new { mensaje = "Los abonos manuales están deshabilitados. Paga por SPEI a la CLABE de tu préstamo." },
            statusCode: StatusCodes.Status403Forbidden);

    if (pago.MontoAbono <= 0 || Math.Round(pago.MontoAbono, 2) != pago.MontoAbono)
        return Invalido("El monto del abono debe ser mayor a 0 y tener máximo 2 decimales.");

    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        decimal saldoActual;
        int idDueno;

        using (var cmdVerificar = new NpgsqlCommand(
            "SELECT saldo_pendiente, id_usuario FROM PRESTAMO WHERE id_prestamo = @id FOR UPDATE;", conn, tx))
        {
            cmdVerificar.Parameters.AddWithValue("id", idPrestamo);
            using var reader = await cmdVerificar.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return Results.NotFound(new { mensaje = "Préstamo no encontrado" });

            saldoActual = reader.GetDecimal(0);
            idDueno = reader.IsDBNull(1) ? -1 : reader.GetInt32(1);
        }

        if (!Puede(user, idDueno)) return Prohibido();

        if (saldoActual < pago.MontoAbono)
            return Results.BadRequest(new { mensaje = "El monto a pagar es mayor al saldo pendiente" });

        string sqlTransaccion = @"INSERT INTO TRANSACCION 
       (id_prestamo, tipo_transaccion, monto, estado, fecha_transaccion) 
       VALUES (@idPrestamo, 'PAGO', @monto, 'COMPLETADO', NOW());";
        using (var cmdTrans = new NpgsqlCommand(sqlTransaccion, conn, tx))
        {
            cmdTrans.Parameters.AddWithValue("idPrestamo", idPrestamo);
            cmdTrans.Parameters.AddWithValue("monto", pago.MontoAbono);
            await cmdTrans.ExecuteNonQueryAsync();
        }

        string sqlActualizarSaldo = @"UPDATE PRESTAMO 
                                    SET saldo_pendiente = saldo_pendiente - @monto 
                                    WHERE id_prestamo = @idPrestamo;";
        using (var cmdActualizar = new NpgsqlCommand(sqlActualizarSaldo, conn, tx))
        {
            cmdActualizar.Parameters.AddWithValue("idPrestamo", idPrestamo);
            cmdActualizar.Parameters.AddWithValue("monto", pago.MontoAbono);
            await cmdActualizar.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();

        return Results.Ok(new { mensaje = "Pago registrado con éxito", saldoRestante = saldoActual - pago.MontoAbono });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Fallo(ex, "No se pudo registrar el abono.");
    }
}).RequireAuthorization();

// ==========================================
// ENDPOINTS DE ADMINISTRADOR (BACKOFFICE)
// ==========================================
app.MapGet("/api/admin/solicitudes", async () =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var solicitudes = new List<object>();
        string sql = @"SELECT s.id_solicitud, u.nombre, s.monto_solicitado, s.plazo_meses, s.estado, s.curp, s.ine, s.recibo_luz_agua
                       FROM SOLICITUD_PRESTAMO s 
                       JOIN usuario u ON s.id_usuario = u.id_usuario 
                       WHERE s.estado = 'PENDIENTE'
                       ORDER BY s.id_solicitud DESC;";
        using var cmd = new NpgsqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            solicitudes.Add(new
            {
                IdSolicitud = reader.GetInt32(0),
                NombreCliente = reader.GetString(1),
                MontoSolicitado = reader.GetDecimal(2),
                PlazoMeses = reader.GetInt32(3),
                Estado = reader.GetString(4),
                CURP = reader.IsDBNull(5) ? "" : reader.GetString(5),
                INE = reader.IsDBNull(6) ? "Pendiente" : reader.GetString(6),
                Recibo = reader.IsDBNull(7) ? "Pendiente" : reader.GetString(7)
            });
        }
        return Results.Ok(solicitudes);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudieron cargar las solicitudes.");
    }
}).RequireAuthorization("Admin");

app.MapGet("/api/admin/prestamos", async () =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        var cartera = new List<object>();

        // LEFT JOIN para no ocultar préstamos sin solicitud asociada
        string sql = @"
            SELECT p.id_prestamo, u.nombre, u.email, p.monto_aprobado, p.saldo_pendiente, 
                   s.ine, s.recibo_luz_agua, s.curp, p.tasa_interes
            FROM PRESTAMO p
            JOIN usuario u ON p.id_usuario = u.id_usuario
            LEFT JOIN SOLICITUD_PRESTAMO s ON p.id_solicitud = s.id_solicitud
            ORDER BY p.id_prestamo DESC;";

        using var cmd = new NpgsqlCommand(sql, conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            decimal montoAprobado = reader.GetDecimal(3);
            decimal saldo = reader.GetDecimal(4);
            decimal tasa = reader.GetDecimal(8);
            string estado = saldo <= 0 ? "PAGADO COMPLETAMENTE" : "ACTIVO";

            cartera.Add(new
            {
                IdPrestamo = reader.GetInt32(0),
                Cliente = reader.GetString(1),
                Email = reader.GetString(2),
                MontoAprobado = montoAprobado,
                SaldoPendiente = saldo,
                Estado = estado,
                INE = reader.IsDBNull(5) ? "No disponible" : reader.GetString(5),
                Recibo = reader.IsDBNull(6) ? "No disponible" : reader.GetString(6),
                CURP = reader.IsDBNull(7) ? "No disponible" : reader.GetString(7),
                // Campos nuevos: el interés es fijo por plazo, no anual
                TasaInteres = tasa,
                TotalAPagar = Math.Round(montoAprobado + montoAprobado * tasa / 100m, 2)
            });
        }
        return Results.Ok(cartera);
    }
    catch (Exception ex)
    {
        return Fallo(ex, "No se pudo cargar la cartera.");
    }
}).RequireAuthorization("Admin");

app.MapPost("/api/admin/solicitudes/{id}/aprobar", async (int id) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        string sqlGet = "SELECT id_usuario, monto_solicitado, plazo_meses FROM SOLICITUD_PRESTAMO WHERE id_solicitud = @id AND estado = 'PENDIENTE' FOR UPDATE;";
        using var cmdGet = new NpgsqlCommand(sqlGet, conn, tx);
        cmdGet.Parameters.AddWithValue("id", id);
        using var reader = await cmdGet.ExecuteReaderAsync();

        if (!await reader.ReadAsync()) return Results.BadRequest(new { Mensaje = "Solicitud no encontrada o ya procesada." });

        int idUsuario = reader.GetInt32(0);
        decimal monto = reader.GetDecimal(1);
        int plazoMeses = reader.GetInt32(2);
        await reader.CloseAsync();

        string sqlUpdate = "UPDATE SOLICITUD_PRESTAMO SET estado = 'APROBADA' WHERE id_solicitud = @id;";
        using var cmdUpdate = new NpgsqlCommand(sqlUpdate, conn, tx);
        cmdUpdate.Parameters.AddWithValue("id", id);
        await cmdUpdate.ExecuteNonQueryAsync();

        decimal tasaInteres = plazoMeses switch
        {
            6 => 10.5m,
            12 => 15.5m,
            24 => 25.0m,
            36 => 35.5m,
            _ => 15.5m
        };

        decimal saldoConInteres = monto + (monto * (tasaInteres / 100m));

        string sqlPrestamo = @"INSERT INTO PRESTAMO (id_solicitud, id_usuario, monto_aprobado, tasa_interes, saldo_pendiente) 
                               VALUES (@idSol, @idUser, @monto, @tasa, @saldo) RETURNING id_prestamo;";
        using var cmdPrestamo = new NpgsqlCommand(sqlPrestamo, conn, tx);
        cmdPrestamo.Parameters.AddWithValue("idSol", id);
        cmdPrestamo.Parameters.AddWithValue("idUser", idUsuario);
        cmdPrestamo.Parameters.AddWithValue("monto", monto);
        cmdPrestamo.Parameters.AddWithValue("tasa", tasaInteres);
        cmdPrestamo.Parameters.AddWithValue("saldo", saldoConInteres);
        int idPrestamo = Convert.ToInt32(await cmdPrestamo.ExecuteScalarAsync());

        string sqlTransaccion = @"INSERT INTO TRANSACCION (id_prestamo, tipo_transaccion, monto, estado, fecha_transaccion) 
                                  VALUES (@idPrestamo, 'DESEMBOLSO', @monto, 'COMPLETADO', NOW());";
        using var cmdTrans = new NpgsqlCommand(sqlTransaccion, conn, tx);
        cmdTrans.Parameters.AddWithValue("idPrestamo", idPrestamo);
        cmdTrans.Parameters.AddWithValue("monto", monto);
        await cmdTrans.ExecuteNonQueryAsync();

        await tx.CommitAsync();

        string clabeSimulada = $"6461801110000{idPrestamo:D5}";

        return Results.Ok(new { Mensaje = "Préstamo aprobado", Clabe = clabeSimulada });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Fallo(ex, "No se pudo aprobar la solicitud.");
    }
}).RequireAuthorization("Admin");

// ==========================================
// WEBHOOK SPEI
// Lo puede llamar tu proveedor de pagos (con el secreto compartido en
// el encabezado X-Webhook-Secret) o un ADMIN usando el simulador, si está habilitado.
// ==========================================

app.MapPost("/api/webhooks/spei", async (SpeiWebhookDto pago, HttpRequest req, ClaimsPrincipal user) =>
{
    bool firmaValida = !string.IsNullOrEmpty(speiWebhookSecret)
        && req.Headers.TryGetValue("X-Webhook-Secret", out var recibido)
        && SecretoIgual(recibido.ToString(), speiWebhookSecret);

    bool esSimulador = simuladorSpeiHabilitado && EsAdmin(user);

    if (!firmaValida && !esSimulador)
    {
        return user.Identity?.IsAuthenticated == true
            ? Prohibido()
            : Results.Json(new { mensaje = "No autorizado." }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var clabe = (pago.Clabe ?? "").Trim();
    if (!Regex.IsMatch(clabe, @"^\d{18}$") || !clabe.StartsWith("6461801110000"))
        return Results.BadRequest(new { Mensaje = "CLABE inválida o no reconocida por el sistema." });

    if (pago.Monto <= 0 || Math.Round(pago.Monto, 2) != pago.Monto)
        return Results.BadRequest(new { Mensaje = "El monto debe ser mayor a 0 y tener máximo 2 decimales." });

    if (!int.TryParse(clabe.Substring(13), out int idPrestamo))
        return Results.BadRequest(new { Mensaje = "Error al decodificar la CLABE." });

    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        string sqlVerificar = "SELECT saldo_pendiente FROM PRESTAMO WHERE id_prestamo = @id FOR UPDATE;";
        using var cmdVerificar = new NpgsqlCommand(sqlVerificar, conn, tx);
        cmdVerificar.Parameters.AddWithValue("id", idPrestamo);
        var result = await cmdVerificar.ExecuteScalarAsync();

        if (result == null) return Results.NotFound(new { Mensaje = "La CLABE no está asociada a ningún préstamo activo." });

        decimal saldoActual = Convert.ToDecimal(result);
        if (saldoActual < pago.Monto)
            return Results.BadRequest(new { Mensaje = "El monto transferido supera el saldo pendiente del préstamo." });

        string sqlTx = @"INSERT INTO TRANSACCION (id_prestamo, tipo_transaccion, monto, estado, fecha_transaccion) 
                         VALUES (@id, 'PAGO_SPEI', @monto, 'COMPLETADO', NOW());";
        using var cmdTx = new NpgsqlCommand(sqlTx, conn, tx);
        cmdTx.Parameters.AddWithValue("id", idPrestamo);
        cmdTx.Parameters.AddWithValue("monto", pago.Monto);
        await cmdTx.ExecuteNonQueryAsync();

        string sqlUpdate = "UPDATE PRESTAMO SET saldo_pendiente = saldo_pendiente - @monto WHERE id_prestamo = @id;";
        using var cmdUpdate = new NpgsqlCommand(sqlUpdate, conn, tx);
        cmdUpdate.Parameters.AddWithValue("id", idPrestamo);
        cmdUpdate.Parameters.AddWithValue("monto", pago.Monto);
        await cmdUpdate.ExecuteNonQueryAsync();

        await tx.CommitAsync();
        return Results.Ok(new { Mensaje = "Transferencia SPEI procesada. Saldo actualizado.", SaldoRestante = saldoActual - pago.Monto });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Fallo(ex, "No se pudo procesar la transferencia.");
    }
});

// ==========================================
// CUENTA ADMIN INICIAL (solo si hay datos en la configuración)
// ==========================================
try
{
    var adminEmail = app.Configuration["Admin:Email"]?.Trim().ToLowerInvariant();
    var adminPass = app.Configuration["Admin:Password"];
    var adminNombre = app.Configuration["Admin:Nombre"] ?? "Administrador";

    if (!string.IsNullOrWhiteSpace(adminEmail) && !string.IsNullOrWhiteSpace(adminPass))
    {
        using var connSeed = await dataSource.OpenConnectionAsync();

        using var cmdCheck = new NpgsqlCommand("SELECT COUNT(*) FROM usuario WHERE LOWER(email) = @email;", connSeed);
        cmdCheck.Parameters.AddWithValue("email", adminEmail);
        int existe = Convert.ToInt32(await cmdCheck.ExecuteScalarAsync());

        if (existe == 0)
        {
            string sql = @"INSERT INTO usuario (nombre, email, password, rol) 
                           VALUES (@nombre, @email, @pass, 'ADMIN');";
            using var cmd = new NpgsqlCommand(sql, connSeed);
            cmd.Parameters.AddWithValue("nombre", adminNombre);
            cmd.Parameters.AddWithValue("email", adminEmail);
            cmd.Parameters.AddWithValue("pass", BCrypt.Net.BCrypt.HashPassword(adminPass));
            await cmd.ExecuteNonQueryAsync();
            app.Logger.LogInformation("SEED: cuenta de administrador creada ({Email}).", adminEmail);
        }
    }
    else
    {
        app.Logger.LogInformation("SEED omitido: no hay Admin:Email y Admin:Password en la configuración.");
    }
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Error al crear la cuenta de administrador inicial.");
}

app.Run();

// ==========================================
// DATA TRANSFER OBJECTS (DTOs)
// ==========================================

public class RegistroDto
{
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class SolicitudDto
{
    public int IdUsuario { get; set; }
    public decimal Monto { get; set; }
    public int Meses { get; set; }
    public string CURP { get; set; } = string.Empty;
}

public class PrestamoUpdateDto
{
    public decimal MontoAprobado { get; set; }
    public decimal SaldoPendiente { get; set; }
}

public class DecisionDto
{
    public string Estado { get; set; } = string.Empty;
}

public class PagoDto
{
    public decimal MontoAbono { get; set; }
}

public class SpeiWebhookDto
{
    public string Clabe { get; set; } = string.Empty;
    public decimal Monto { get; set; }
}