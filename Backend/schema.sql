-- ============================================================
-- schema.sql — Diseño Lógico (1.2.3 + 2.2.3 Sprint 2)
-- Sistema de Refugios y Adopciones de Animales en Bogotá
-- ============================================================

CREATE TABLE IF NOT EXISTS USUARIO (
  id_usuario       INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT    NOT NULL,
  apellido         TEXT    NOT NULL,
  correo           TEXT    NOT NULL UNIQUE,
  contrasena_hash  TEXT,
  ubicacion        TEXT,
  fecha_registro   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  activo           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS SOLICITUD_REFUGIO (
  id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  nombre_refugio TEXT NOT NULL,
  direccion TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  capacidad INTEGER, localidad TEXT NOT NULL, telefono TEXT, red_social TEXT, logo_url TEXT, tipo TEXT DEFAULT 'perros',
  responsable_nombre TEXT NOT NULL, responsable_correo TEXT NOT NULL, responsable_telefono TEXT NOT NULL, capacidad_actual INTEGER,
  permisos_autorizaciones TEXT,
  instagram TEXT, facebook TEXT, tiktok TEXT, x_social TEXT, youtube TEXT, whatsapp TEXT, trabajadores_json TEXT, documentos_json TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  comentario_admin TEXT, fecha_solicitud TEXT NOT NULL DEFAULT (datetime('now','localtime')), fecha_respuesta TEXT
);
CREATE INDEX IF NOT EXISTS idx_solicitud_refugio_estado ON SOLICITUD_REFUGIO(estado);
CREATE INDEX IF NOT EXISTS idx_solicitud_refugio_usuario ON SOLICITUD_REFUGIO(id_usuario);

CREATE TABLE IF NOT EXISTS PROVEEDOR_SOCIAL (
  id_proveedor     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_proveedor TEXT    NOT NULL UNIQUE,
  url_oauth        TEXT    NOT NULL,
  activo           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS CUENTA_SOCIAL (
  id_cuenta         INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario        INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  id_proveedor      INTEGER NOT NULL REFERENCES PROVEEDOR_SOCIAL(id_proveedor),
  token_social      TEXT    NOT NULL,
  correo_social     TEXT,
  fecha_vinculacion TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS SESION (
  id_sesion        INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario       INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  token_sesion     TEXT    NOT NULL UNIQUE,
  fecha_inicio     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_expiracion TEXT    NOT NULL,
  ip_acceso        TEXT
);

-- ============================================================
-- Tabla: REFUGIO (CU #4 — Registro de Perfil de Refugio)
-- Diseño lógico §1.2.3 + localidad requerida
-- ============================================================
CREATE TABLE IF NOT EXISTS REFUGIO (
  id_refugio       INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_refugio   TEXT    NOT NULL,
  direccion        TEXT    NOT NULL,
  descripcion      TEXT    NOT NULL,
  capacidad        INTEGER,
  capacidad_actual INTEGER,
  localidad        TEXT    NOT NULL,
  estado TEXT NOT NULL DEFAULT 'aprobada',
  id_usuario       INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  telefono TEXT, logo_url TEXT, tipo TEXT DEFAULT 'perros',
  responsable_nombre TEXT NOT NULL, responsable_correo TEXT NOT NULL, responsable_telefono TEXT NOT NULL,
  permisos_autorizaciones TEXT,
  instagram TEXT, facebook TEXT, tiktok TEXT, x_social TEXT, youtube TEXT, whatsapp TEXT,
  trabajadores_json TEXT, documentos_json TEXT
);

CREATE TABLE IF NOT EXISTS REFUGIO_TRABAJADOR (
  id_trabajador INTEGER PRIMARY KEY AUTOINCREMENT, id_refugio INTEGER NOT NULL REFERENCES REFUGIO(id_refugio) ON DELETE CASCADE,
  nombre TEXT NOT NULL, correo TEXT NOT NULL, telefono TEXT, cargo TEXT,
  fecha_registro TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_trabajador_refugio ON REFUGIO_TRABAJADOR(id_refugio);


-- ============================================================
-- Tabla: ANIMAL — Registro de animales disponibles para adopción
-- ============================================================
CREATE TABLE IF NOT EXISTS ANIMAL (
  id_animal          INTEGER PRIMARY KEY AUTOINCREMENT,
  id_refugio         INTEGER NOT NULL REFERENCES REFUGIO(id_refugio) ON DELETE CASCADE,
  nombre             TEXT NOT NULL,
  especie            TEXT NOT NULL CHECK (especie = 'perro'),
  raza               TEXT,
  sexo               TEXT CHECK (sexo IN ('macho','hembra','no_determinado')),
  edad               TEXT,
  tamano             TEXT CHECK (tamano IN ('pequeno','mediano','grande')),
  color              TEXT,
  descripcion        TEXT NOT NULL,
  estado_salud       TEXT NOT NULL DEFAULT 'estable'
                     CHECK (estado_salud IN ('estable','en_tratamiento','recuperacion','especial','embarazo')),
  estado_adopcion    TEXT NOT NULL DEFAULT 'disponible'
                     CHECK (estado_adopcion IN ('disponible','en_proceso','adoptado','no_disponible')),
  fotos_urls         TEXT,
  fecha_ingreso      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_animal_refugio ON ANIMAL(id_refugio);
CREATE INDEX IF NOT EXISTS idx_animal_estado ON ANIMAL(estado_adopcion);
CREATE INDEX IF NOT EXISTS idx_animal_especie ON ANIMAL(especie);

-- ============================================================
-- Tabla: ADOPCION — Solicitudes y seguimiento de adopción
-- ============================================================
CREATE TABLE IF NOT EXISTS ADOPCION (
  id_adopcion       INTEGER PRIMARY KEY AUTOINCREMENT,
  id_animal         INTEGER NOT NULL REFERENCES ANIMAL(id_animal) ON DELETE CASCADE,
  id_usuario        INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','aprobada','rechazada','cancelada','completada')),
  mensaje           TEXT,
  fecha_solicitud   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_respuesta   TEXT,
  fecha_completada  TEXT
);

CREATE INDEX IF NOT EXISTS idx_adopcion_animal ON ADOPCION(id_animal);
CREATE INDEX IF NOT EXISTS idx_adopcion_usuario ON ADOPCION(id_usuario);

CREATE TABLE IF NOT EXISTS ADOPCION_MENSAJE (
  id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,
  id_adopcion INTEGER NOT NULL REFERENCES ADOPCION(id_adopcion) ON DELETE CASCADE,
  id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  mensaje TEXT NOT NULL,
  fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_adopcion_mensaje_adopcion ON ADOPCION_MENSAJE(id_adopcion);

-- ============================================================
-- REPORTE — Reportes de animales realizados por usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS REPORTE (
  id_reporte INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
  especie TEXT NOT NULL CHECK (especie = 'perro'),
  descripcion_fisica TEXT NOT NULL,
  estado_animal TEXT NOT NULL CHECK (estado_animal IN ('herido','perdido','abandonado','sano')),
  estado_reporte TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_reporte IN ('pendiente','en_proceso','atendido','cerrado')),
  ubicacion TEXT NOT NULL,
  localidad TEXT NOT NULL,
  fotos_urls TEXT,
  fecha_creacion TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS REPORTE_REFUGIO (
  id_reporte INTEGER NOT NULL REFERENCES REPORTE(id_reporte) ON DELETE CASCADE,
  id_refugio INTEGER NOT NULL REFERENCES REFUGIO(id_refugio) ON DELETE CASCADE,
  fecha_notificacion TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (id_reporte,id_refugio)
);
