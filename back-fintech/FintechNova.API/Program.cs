using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Configuración del puerto dinámico para Render y desarrollo local
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSettings["Key"];
// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()    
              .AllowAnyHeader()    
              .AllowAnyMethod();   
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"],
            ValidAudience = jwtSettings["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!))
        };
    });

builder.Services.AddAuthorization();
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
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();

var dataSource = NpgsqlDataSource.Create(
    builder.Configuration.GetConnectionString("DefaultConnection")!
);

// ==========================================
// ENDPOINTS DE USUARIOS Y AUTENTICACIÓN
// ==========================================

app.MapPost("/api/registro", async (RegistroDto nuevoUsuario) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "INSERT INTO usuario (nombre, email, password) VALUES (@nombre, @email, @pass) RETURNING id_usuario;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("nombre", nuevoUsuario.Nombre);
        cmd.Parameters.AddWithValue("email", nuevoUsuario.Email);
        cmd.Parameters.AddWithValue("pass", nuevoUsuario.Password);
        int idCreado = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        return Results.Ok(new { Mensaje = "Usuario creado con éxito", UsuarioId = idCreado });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error al registrar: {ex.Message}");
    }
});

app.MapPost("/api/login", async (LoginDto loginInfo) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "SELECT id_usuario, nombre, rol FROM usuario WHERE email = @email AND password = @pass;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("email", loginInfo.Email);
        cmd.Parameters.AddWithValue("pass", loginInfo.Password);
        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            var idUsuario = reader.GetInt32(0);
            var nombreUsuario = reader.GetString(1);
            var rol = reader.GetString(2);

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                expires: DateTime.Now.AddHours(1),
                signingCredentials: creds
            );
            var tokenString = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token);
            return Results.Ok(new { token = tokenString, usuario = nombreUsuario, rol = rol, idUsuario = idUsuario });
        }
        return Results.Unauthorized();
    }
    catch (Exception ex)
    {
        return Results.Problem($"Error al iniciar sesión: {ex.Message}");
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
                Rol = reader.GetString(3)
            });
        }
        return Results.Ok(usuarios);
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapDelete("/api/usuarios/{id}", async (int id) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        string sqlGetPrestamos = "SELECT id_prestamo FROM PRESTAMO WHERE id_usuario = @id;";
        var prestamosIds = new List<int>();
        using (var cmdPrestamos = new NpgsqlCommand(sqlGetPrestamos, conn, tx))
        {
            cmdPrestamos.Parameters.AddWithValue("id", id);
            using var reader = await cmdPrestamos.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                prestamosIds.Add(reader.GetInt32(0));
            }
        }

        foreach (var idPrestamo in prestamosIds)
        {
            string sqlDelTx = "DELETE FROM TRANSACCION WHERE id_prestamo = @idPrestamo;";
            using var cmdDelTx = new NpgsqlCommand(sqlDelTx, conn, tx);
            cmdDelTx.Parameters.AddWithValue("idPrestamo", idPrestamo);
            await cmdDelTx.ExecuteNonQueryAsync();
        }

        string sqlDelPrestamos = "DELETE FROM PRESTAMO WHERE id_usuario = @id;";
        using var cmdDelPrestamos = new NpgsqlCommand(sqlDelPrestamos, conn, tx);
        cmdDelPrestamos.Parameters.AddWithValue("id", id);
        await cmdDelPrestamos.ExecuteNonQueryAsync();

        string sqlDelSolicitudes = "DELETE FROM SOLICITUD_PRESTAMO WHERE id_usuario = @id;";
        using var cmdDelSol = new NpgsqlCommand(sqlDelSolicitudes, conn, tx);
        cmdDelSol.Parameters.AddWithValue("id", id);
        await cmdDelSol.ExecuteNonQueryAsync();

        string sqlDelUsuario = "DELETE FROM usuario WHERE id_usuario = @id;";
        using var cmdDelUser = new NpgsqlCommand(sqlDelUsuario, conn, tx);
        cmdDelUser.Parameters.AddWithValue("id", id);
        int filasAfectadas = await cmdDelUser.ExecuteNonQueryAsync();

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
        return Results.Problem($"Error al eliminar la cuenta: {ex.Message}");
    }
}).RequireAuthorization();

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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/solicitudes/usuario/{idUsuario}", async (int idUsuario) =>
{
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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapPut("/api/solicitudes/{id}/estado", async (int id, DecisionDto decision) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sql = "UPDATE SOLICITUD_PRESTAMO SET estado = @estado WHERE id_solicitud = @id;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("estado", decision.Estado);
        await cmd.ExecuteNonQueryAsync();
        return Results.Ok(new { Mensaje = "Estado actualizado" });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

// ==========================================
// ENDPOINTS DE PRÉSTAMOS
// ==========================================

app.MapPost("/api/prestamos/simular", async (SolicitudDto request) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sqlSolicitud = @"INSERT INTO SOLICITUD_PRESTAMO 
            (id_usuario, monto_solicitado, plazo_meses, estado, curp, ine, recibo_luz_agua, comprobante_ingresos, estado_cuenta) 
            VALUES (@idUser, @monto, @plazo, 'PENDIENTE', @curp, 'Pendiente', 'Pendiente', 'Pendiente', 'Pendiente') 
            RETURNING id_solicitud;";
            
        using var cmdSolicitud = new NpgsqlCommand(sqlSolicitud, conn);
        cmdSolicitud.Parameters.AddWithValue("idUser", request.IdUsuario);
        cmdSolicitud.Parameters.AddWithValue("monto", request.Monto);
        cmdSolicitud.Parameters.AddWithValue("plazo", request.Meses);
        cmdSolicitud.Parameters.AddWithValue("curp", request.CURP);
        
        int idSolicitud = Convert.ToInt32(await cmdSolicitud.ExecuteScalarAsync());

        return Results.Ok(new { Mensaje = "Solicitud enviada a revisión exitosamente", SolicitudId = idSolicitud });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/prestamos/{id}", async (int id) =>
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
            return Results.Ok(new
            {
                IdPrestamo = reader.GetInt32(0),
                IdUsuario = reader.GetInt32(1),
                MontoAprobado = reader.GetDecimal(2),
                SaldoPendiente = reader.GetDecimal(3)
            });
        }
        return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapGet("/api/prestamos/usuario/{idUsuario}", async (int idUsuario) =>
{
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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapPut("/api/prestamos/{id}", async (int id, PrestamoUpdateDto request) =>
{
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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapDelete("/api/prestamos/{id}", async (int id) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    try
    {
        string sqlTx = "DELETE FROM TRANSACCION WHERE id_prestamo = @id;";
        using var cmdTx = new NpgsqlCommand(sqlTx, conn);
        cmdTx.Parameters.AddWithValue("id", id);
        await cmdTx.ExecuteNonQueryAsync();

        string sql = "DELETE FROM PRESTAMO WHERE id_prestamo = @id;";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        int filasAfectadas = await cmd.ExecuteNonQueryAsync();
        if (filasAfectadas > 0)
            return Results.Ok(new { Mensaje = "Préstamo eliminado del sistema" });
        return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

// ==========================================
// ENDPOINTS DE TRANSACCIONES Y PAGOS
// ==========================================

app.MapGet("/api/transacciones/usuario/{idUsuario}", async (int idUsuario) =>
{
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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

app.MapPost("/api/prestamos/{idPrestamo}/pagar", async (int idPrestamo, PagoDto pago) =>
{
    using var conn = await dataSource.OpenConnectionAsync();
    using var tx = await conn.BeginTransactionAsync();
    try
    {
        string sqlVerificar = "SELECT saldo_pendiente FROM PRESTAMO WHERE id_prestamo = @id FOR UPDATE;";
        using var cmdVerificar = new NpgsqlCommand(sqlVerificar, conn, tx);
        cmdVerificar.Parameters.AddWithValue("id", idPrestamo);
        
        var resultado = await cmdVerificar.ExecuteScalarAsync();
        if (resultado == null) return Results.NotFound(new { Mensaje = "Préstamo no encontrado" });
        
        decimal saldoActual = Convert.ToDecimal(resultado);
        if (saldoActual < pago.MontoAbono) 
            return Results.BadRequest(new { Mensaje = "El monto a pagar es mayor al saldo pendiente" });

        string sqlTransaccion = @"INSERT INTO TRANSACCION 
       (id_prestamo, tipo_transaccion, monto, estado, fecha_transaccion) 
       VALUES (@idPrestamo, 'PAGO', @monto, 'COMPLETADO', NOW());";
        using var cmdTrans = new NpgsqlCommand(sqlTransaccion, conn, tx);
        cmdTrans.Parameters.AddWithValue("idPrestamo", idPrestamo);
        cmdTrans.Parameters.AddWithValue("monto", pago.MontoAbono);
        await cmdTrans.ExecuteNonQueryAsync();

        string sqlActualizarSaldo = @"UPDATE PRESTAMO 
                                    SET saldo_pendiente = saldo_pendiente - @monto 
                                    WHERE id_prestamo = @idPrestamo;";
        using var cmdActualizar = new NpgsqlCommand(sqlActualizarSaldo, conn, tx);
        cmdActualizar.Parameters.AddWithValue("idPrestamo", idPrestamo);
        cmdActualizar.Parameters.AddWithValue("monto", pago.MontoAbono);
        await cmdActualizar.ExecuteNonQueryAsync();

        await tx.CommitAsync();
        
        return Results.Ok(new { Mensaje = "Pago registrado con éxito", SaldoRestante = saldoActual - pago.MontoAbono });
    }
    catch (Exception ex)
    {
        await tx.RollbackAsync();
        return Results.Problem($"Error al procesar el pago: {ex.Message}");
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
        return Results.Problem(ex.Message);
    }
}).RequireAuthorization();

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
        return Results.Problem($"Error: {ex.Message}");
    }
}).RequireAuthorization();

// ==========================================
// WEBHOOKS (SIMULADOR DE PASARELA BANCARIA)
// ==========================================

app.MapPost("/api/webhooks/spei", async (SpeiWebhookDto pago) =>
{
    if (pago.Clabe.Length != 18 || !pago.Clabe.StartsWith("6461801110000"))
        return Results.BadRequest(new { Mensaje = "CLABE inválida o no reconocida por el sistema." });

    if (!int.TryParse(pago.Clabe.Substring(13), out int idPrestamo))
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
        return Results.Problem(ex.Message);
    }
}); 

// ==========================================
// AUTO-INSTALADOR (DATA SEEDING)
// ==========================================
try
{
    using var scope = app.Services.CreateScope();
    using var conn = await dataSource.OpenConnectionAsync();
    
    string adminEmail = "admin1@gmail.com";
    string adminPass = "admin";
    string adminNombre = "admin";

    string sqlCheck = "SELECT COUNT(*) FROM usuario WHERE email = @email;";
    using var cmdCheck = new NpgsqlCommand(sqlCheck, conn);
    cmdCheck.Parameters.AddWithValue("email", adminEmail);
    int existe = Convert.ToInt32(await cmdCheck.ExecuteScalarAsync());

    if (existe == 0)
    {
        string sql = @"INSERT INTO usuario (nombre, email, password, rol) 
                       VALUES (@nombre, @email, @pass, 'ADMIN');";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("nombre", adminNombre);
        cmd.Parameters.AddWithValue("email", adminEmail);
        cmd.Parameters.AddWithValue("pass", adminPass);
        await cmd.ExecuteNonQueryAsync();
        Console.WriteLine($"✅ SEED: Cuenta Admin creada ({adminEmail} / {adminPass})");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"❌ Error en Seed: {ex.Message}");
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