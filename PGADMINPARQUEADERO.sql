-- ============================================================
-- SCRIPT DE BASE DE DATOS: PARQUEADERO UNIVERSITARIO (CESMAG)
-- PostgreSQL / pgAdmin 4
-- ============================================================

-- 1. Limpieza preventiva de tablas si ya existían
DROP TABLE IF EXISTS incidentes CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;
DROP TABLE IF EXISTS espacios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 2. Tabla de Roles (Administrador, Personal, Estudiante)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

-- Registramos los tres roles requeridos en el sistema
INSERT INTO roles (nombre) VALUES 
('ADMINISTRADOR'),
('PERSONAL'),
('ESTUDIANTE');

-- 3. Tabla de Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    identificacion VARCHAR(20) NOT NULL UNIQUE,
    nombre_completo VARCHAR(100) NOT NULL,
    correo_institucional VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(15),
    rol_id INT NOT NULL REFERENCES roles(id),
    password_hash VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Vehículos (Motos y Bicicletas)
CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_vehiculo VARCHAR(10) NOT NULL CHECK (tipo_vehiculo IN ('MOTO', 'BICICLETA')),
    placa_o_codigo VARCHAR(20) NOT NULL UNIQUE, -- Placa para moto, Código único para bici
    marca VARCHAR(50),
    modelo VARCHAR(50),
    color VARCHAR(30)
);

-- 5. Tabla de Espacios del Parqueadero
CREATE TABLE espacios (
    id SERIAL PRIMARY KEY,
    numero_espacio VARCHAR(10) NOT NULL UNIQUE,
    tipo_vehiculo VARCHAR(10) NOT NULL CHECK (tipo_vehiculo IN ('MOTO', 'BICICLETA')),
    estado VARCHAR(10) DEFAULT 'LIBRE' CHECK (estado IN ('LIBRE', 'OCUPADO'))
);

-- 6. Tabla de Registro de Movimientos (Ingresos y Salidas)
CREATE TABLE movimientos (
    id SERIAL PRIMARY KEY,
    vehiculo_id INT NOT NULL REFERENCES vehiculos(id),
    espacio_id INT NOT NULL REFERENCES espacios(id),
    fecha_hora_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_hora_salida TIMESTAMP NULL,
    estado VARCHAR(10) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'FINALIZADO'))
);

-- ============================================================
-- DATOS INICIALES DE PRUEBA
-- ============================================================

-- Insertar usuario Administrador por defecto (Identificación: 123456789 / Pass: admin123)
INSERT INTO usuarios (identificacion, nombre_completo, correo_institucional, telefono, rol_id, password_hash)
VALUES ('123456789', 'Administrador CESMAG', 'admin@unicesmag.edu.co', '3000000000', 1, 'admin123');

-- Insertar espacios iniciales para Motocicletas (M-01 a M-05)
INSERT INTO espacios (numero_espacio, tipo_vehiculo, estado) VALUES
('M-01', 'MOTO', 'LIBRE'),
('M-02', 'MOTO', 'LIBRE'),
('M-03', 'MOTO', 'LIBRE'),
('M-04', 'MOTO', 'LIBRE'),
('M-05', 'MOTO', 'LIBRE');

-- Insertar espacios iniciales para Bicicletas (B-01 a B-05)
INSERT INTO espacios (numero_espacio, tipo_vehiculo, estado) VALUES
('B-01', 'BICICLETA', 'LIBRE'),
('B-02', 'BICICLETA', 'LIBRE'),
('B-03', 'BICICLETA', 'LIBRE'),
('B-04', 'BICICLETA', 'LIBRE'),
('B-05', 'BICICLETA', 'LIBRE');