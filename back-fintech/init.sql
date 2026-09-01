CREATE TABLE IF NOT EXISTS usuario (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    rol VARCHAR(20) DEFAULT 'CLIENTE'
);

CREATE TABLE IF NOT EXISTS solicitud_prestamo (
    id_solicitud SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuario(id_usuario),
    monto_solicitado DECIMAL(12, 2) NOT NULL,
    plazo_meses INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    curp VARCHAR(18),
    ine VARCHAR(255),
    recibo_luz_agua VARCHAR(255),
    comprobante_ingresos VARCHAR(255),
    estado_cuenta VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS prestamo (
    id_prestamo SERIAL PRIMARY KEY,
    id_solicitud INT REFERENCES solicitud_prestamo(id_solicitud),
    id_usuario INT REFERENCES usuario(id_usuario),
    monto_aprobado DECIMAL(12, 2) NOT NULL,
    tasa_interes DECIMAL(5, 2) NOT NULL,
    saldo_pendiente DECIMAL(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS transaccion (
    id_transaccion SERIAL PRIMARY KEY,
    id_prestamo INT REFERENCES prestamo(id_prestamo),
    tipo_transaccion VARCHAR(20) NOT NULL,
    monto DECIMAL(12, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL,
    fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);