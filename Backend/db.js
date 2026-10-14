/**
 * db.js — SQLite con sql.js
 * Sprint 2: tabla REFUGIO según §1.2.3 + localidad
 * Sprint 3: tablas REPORTE y REPORTE_REFUGIO según §1.2.3 Sprint 3
 */

const initSqlJs = require('sql.js');
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');
require('dotenv').config();

const DB_PATH = path.join(__dirname, process.env.DB_FILE || 'database.db');
let db;

async function iniciarDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`PRAGMA foreign_keys = ON;`);

  db.run(`
    CREATE TABLE IF NOT EXISTS USUARIO (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE, contrasena_hash TEXT,
      ubicacion TEXT,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      activo INTEGER NOT NULL DEFAULT 1,
      rol TEXT NOT NULL DEFAULT 'adoptante',
      estado_refugio TEXT NOT NULL DEFAULT 'ninguna',
      email_verificado INTEGER NOT NULL DEFAULT 0,
      token_verificacion_email TEXT,
      token_verificacion_expira TEXT
    );
    CREATE TABLE IF NOT EXISTS PROVEEDOR_SOCIAL (
      id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_proveedor TEXT NOT NULL UNIQUE,
      url_oauth TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS CUENTA_SOCIAL (
      id_cuenta INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      id_proveedor INTEGER NOT NULL REFERENCES PROVEEDOR_SOCIAL(id_proveedor),
      token_social TEXT NOT NULL, correo_social TEXT,
      fecha_vinculacion TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS SESION (
      id_sesion INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      token_sesion TEXT NOT NULL UNIQUE,
      fecha_inicio TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fecha_expiracion TEXT NOT NULL, ip_acceso TEXT
    );
  `);

  // Migración de usuarios: perfiles y estado de solicitud de refugio
  try { db.run(`ALTER TABLE USUARIO ADD COLUMN rol TEXT NOT NULL DEFAULT 'adoptante'`); } catch(e) {}
  try { db.run(`ALTER TABLE USUARIO ADD COLUMN estado_refugio TEXT NOT NULL DEFAULT 'ninguna'`); } catch(e) {}
  try { db.run(`ALTER TABLE USUARIO ADD COLUMN email_verificado INTEGER NOT NULL DEFAULT 1`); } catch(e) {}
  try { db.run(`ALTER TABLE USUARIO ADD COLUMN token_verificacion_email TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE USUARIO ADD COLUMN token_verificacion_expira TEXT`); } catch(e) {}

  // Las cuentas existentes se consideran verificadas para no bloquear usuarios ya creados.
  try { db.run(`UPDATE USUARIO SET email_verificado=1 WHERE email_verificado IS NULL`); } catch(e) {}

  // Usuarios que ya poseen refugios conservan el acceso como perfil Refugio.
  try { db.run(`UPDATE USUARIO SET rol='refugio', estado_refugio='aprobada' WHERE id_usuario IN (SELECT DISTINCT id_usuario FROM REFUGIO)`); } catch(e) {}

  // Solicitudes para convertirse en Refugio: la aprobación la realiza Administración.
  db.run(`
    CREATE TABLE IF NOT EXISTS SOLICITUD_REFUGIO (
      id_solicitud INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      nombre_refugio TEXT NOT NULL,
      direccion TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      capacidad INTEGER,
      localidad TEXT NOT NULL,
      telefono TEXT,
      red_social TEXT,
      logo_url TEXT,
      tipo TEXT DEFAULT 'mixto',
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
      comentario_admin TEXT,
      fecha_solicitud TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fecha_respuesta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_solicitud_refugio_estado ON SOLICITUD_REFUGIO(estado);
    CREATE INDEX IF NOT EXISTS idx_solicitud_refugio_usuario ON SOLICITUD_REFUGIO(id_usuario);
  `);

  // CU #4 — columnas §1.2.3 + localidad
  db.run(`
    CREATE TABLE IF NOT EXISTS REFUGIO (
      id_refugio     INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_refugio TEXT    NOT NULL,
      direccion      TEXT    NOT NULL,
      descripcion    TEXT    NOT NULL,
      capacidad      INTEGER,
      localidad      TEXT    NOT NULL,
      id_usuario     INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
    );
  `);

  // Usuarios con refugios existentes se mantienen como perfil Refugio.
  try { db.run(`UPDATE USUARIO SET rol='refugio', estado_refugio='aprobada' WHERE id_usuario IN (SELECT DISTINCT id_usuario FROM REFUGIO)`); } catch(e) {}

  // CU #4/#5 — columnas nuevas
  try { db.run(`ALTER TABLE REFUGIO ADD COLUMN telefono   TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE REFUGIO ADD COLUMN red_social TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE REFUGIO ADD COLUMN logo_url   TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE REFUGIO ADD COLUMN tipo       TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE REFUGIO ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobada'`); } catch(e) {}
  // Los refugios existentes corresponden a solicitudes aprobadas; hacerlos públicos.
  try { db.run(`UPDATE REFUGIO SET estado='aprobada' WHERE estado IS NULL OR TRIM(estado)='' OR estado='pendiente'`); } catch(e) {}


  // Datos ampliados del refugio y sus trabajadores.
  const refugeCols = [
    ['responsable_nombre','TEXT'], ['responsable_correo','TEXT'], ['responsable_telefono','TEXT'],
    ['capacidad_actual','INTEGER'], ['permisos_autorizaciones','TEXT'], ['documentos_json','TEXT'], ['trabajadores_json','TEXT'], ['instagram','TEXT'],
    ['facebook','TEXT'], ['tiktok','TEXT'], ['x_social','TEXT'], ['youtube','TEXT'], ['whatsapp','TEXT']
  ];
  for (const [col, type] of refugeCols) { try { db.run(`ALTER TABLE REFUGIO ADD COLUMN ${col} ${type}`); } catch(e) {} }
  db.run(`
    CREATE TABLE IF NOT EXISTS REFUGIO_TRABAJADOR (
      id_trabajador INTEGER PRIMARY KEY AUTOINCREMENT,
      id_refugio INTEGER NOT NULL REFERENCES REFUGIO(id_refugio) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      telefono TEXT,
      cargo TEXT,
      fecha_registro TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_trabajador_refugio ON REFUGIO_TRABAJADOR(id_refugio);
  `);

  // Nuevos campos también en solicitudes de refugio.
  const solicitudCols = [
    ['responsable_nombre','TEXT'], ['responsable_correo','TEXT'], ['responsable_telefono','TEXT'],
    ['capacidad_actual','INTEGER'], ['permisos_autorizaciones','TEXT'], ['instagram','TEXT'],
    ['facebook','TEXT'], ['tiktok','TEXT'], ['x_social','TEXT'], ['youtube','TEXT'], ['whatsapp','TEXT'],
    ['trabajadores_json','TEXT'], ['documentos_json','TEXT']
  ];
  for (const [col, type] of solicitudCols) { try { db.run(`ALTER TABLE SOLICITUD_REFUGIO ADD COLUMN ${col} ${type}`); } catch(e) {} }

  // ── CU #6 Sprint 3: REPORTE ─────────────────────────────────────
  // Registra cada reporte de animal enviado. FK → USUARIO.
  db.run(`
    CREATE TABLE IF NOT EXISTS REPORTE (
      id_reporte        INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario        INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      especie           TEXT    NOT NULL,
      descripcion_fisica TEXT   NOT NULL,
      estado_animal     TEXT    NOT NULL
                          CHECK (estado_animal IN ('herido','perdido','abandonado','sano')),
      estado_reporte    TEXT    NOT NULL DEFAULT 'pendiente'
                          CHECK (estado_reporte IN ('pendiente','en_proceso','atendido','cerrado')),
      ubicacion         TEXT    NOT NULL,
      localidad         TEXT    NOT NULL,
      fotos_urls        TEXT,
      fecha_creacion    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  // ── CU #7: Gestión de Animales y Adopciones ───────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS ANIMAL (
      id_animal INTEGER PRIMARY KEY AUTOINCREMENT,
      id_refugio INTEGER NOT NULL REFERENCES REFUGIO(id_refugio) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      especie TEXT NOT NULL CHECK (especie = 'perro'),
      raza TEXT,
      sexo TEXT CHECK (sexo IN ('macho','hembra','no_determinado')),
      edad TEXT,
      tamano TEXT CHECK (tamano IN ('pequeno','mediano','grande')),
      color TEXT,
      descripcion TEXT NOT NULL,
      estado_salud TEXT NOT NULL DEFAULT 'estable'
        CHECK (estado_salud IN ('estable','en_tratamiento','recuperacion','especial','embarazo')),
      estado_adopcion TEXT NOT NULL DEFAULT 'disponible'
        CHECK (estado_adopcion IN ('disponible','en_proceso','adoptado','no_disponible')),
      fotos_urls TEXT,
      fecha_ingreso TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_animal_refugio ON ANIMAL(id_refugio);
    CREATE INDEX IF NOT EXISTS idx_animal_estado ON ANIMAL(estado_adopcion);
    CREATE INDEX IF NOT EXISTS idx_animal_especie ON ANIMAL(especie);

    CREATE TABLE IF NOT EXISTS ADOPCION (
      id_adopcion INTEGER PRIMARY KEY AUTOINCREMENT,
      id_animal INTEGER NOT NULL REFERENCES ANIMAL(id_animal) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente','aprobada','rechazada','cancelada','completada')),
      mensaje TEXT,
      fecha_solicitud TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fecha_respuesta TEXT
    );
    CREATE TABLE IF NOT EXISTS ADOPCION_MENSAJE (
      id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,
      id_adopcion INTEGER NOT NULL REFERENCES ADOPCION(id_adopcion) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      mensaje TEXT NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_adopcion_mensaje_adopcion ON ADOPCION_MENSAJE(id_adopcion);
    CREATE INDEX IF NOT EXISTS idx_adopcion_animal ON ADOPCION(id_animal);
    CREATE INDEX IF NOT EXISTS idx_adopcion_usuario ON ADOPCION(id_usuario);
  `);

  // Migraciones permanentes del seguimiento y chat de adopciones.
  // Se ejecutan siempre para que las bases creadas en versiones anteriores
  // queden compatibles con el flujo actual.
  try { db.run(`ALTER TABLE ADOPCION ADD COLUMN fecha_completada TEXT`); } catch(e) {}
  db.run(`
    CREATE TABLE IF NOT EXISTS ADOPCION_MENSAJE (
      id_mensaje INTEGER PRIMARY KEY AUTOINCREMENT,
      id_adopcion INTEGER NOT NULL REFERENCES ADOPCION(id_adopcion) ON DELETE CASCADE,
      id_usuario INTEGER NOT NULL REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
      mensaje TEXT NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_adopcion_mensaje_adopcion ON ADOPCION_MENSAJE(id_adopcion);
  `);

  // ── CU #6 Sprint 3: REPORTE_REFUGIO (N:N) ───────────────────────
  // Tabla intermedia: relaciona reportes con los refugios notificados.
  db.run(`
    CREATE TABLE IF NOT EXISTS REPORTE_REFUGIO (
      id_reporte         INTEGER NOT NULL REFERENCES REPORTE(id_reporte)  ON DELETE CASCADE,
      id_refugio         INTEGER NOT NULL REFERENCES REFUGIO(id_refugio)  ON DELETE CASCADE,
      fecha_notificacion TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (id_reporte, id_refugio)
    );
  `);

  // Migración del alcance: la plataforma trabaja únicamente con perros.
  // Elimina registros históricos de gatos/otras especies y sus relaciones.
  try { db.run(`DELETE FROM ADOPCION WHERE id_animal IN (SELECT id_animal FROM ANIMAL WHERE LOWER(especie) <> 'perro')`); } catch(e) {}
  try { db.run(`DELETE FROM ANIMAL WHERE LOWER(especie) <> 'perro'`); } catch(e) {}
  try { db.run(`DELETE FROM REPORTE_REFUGIO WHERE id_reporte IN (SELECT id_reporte FROM REPORTE WHERE LOWER(especie) <> 'perro')`); } catch(e) {}
  try { db.run(`DELETE FROM REPORTE WHERE LOWER(especie) <> 'perro'`); } catch(e) {}

  db.run(`INSERT OR IGNORE INTO PROVEEDOR_SOCIAL (nombre_proveedor, url_oauth)
    VALUES ('google', 'https://accounts.google.com/o/oauth2/auth')`);
  db.run(`INSERT OR IGNORE INTO PROVEEDOR_SOCIAL (nombre_proveedor, url_oauth)
    VALUES ('facebook', 'https://www.facebook.com/v18.0/dialog/oauth')`);

  // Administrador inicial para gestionar solicitudes de refugio.
  const adminCorreo = 'admin@refugiosbogota.local';
  const admin = db.exec(`SELECT id_usuario FROM USUARIO WHERE LOWER(correo)=LOWER('${adminCorreo}')`);
  if (!admin.length) {
    const hash = bcrypt.hashSync('Admin12345!', 10);
    db.run(`INSERT INTO USUARIO (nombre,apellido,correo,contrasena_hash,ubicacion,rol,estado_refugio) VALUES (?,?,?,?,?,?,?)`,
      ['Administrador','General',adminCorreo,hash,'Bogotá','administrador','aprobada']);
    db.run(`UPDATE USUARIO SET email_verificado=1 WHERE LOWER(correo)=LOWER(?)`, [adminCorreo]);
  } else {
    db.run(`UPDATE USUARIO SET nombre='Administrador', apellido='General', rol='administrador', estado_refugio='aprobada', email_verificado=1, activo=1 WHERE LOWER(correo)=LOWER(?)`, [adminCorreo]);
  }

  guardarEnDisco();
  console.log(`[DB] Base de datos lista en: ${DB_PATH}`);
  console.log(`[DB] Tablas Sprint 3: REPORTE + REPORTE_REFUGIO listas.`);
}

function guardarEnDisco() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getAsync(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return Promise.resolve(row);
    }
    stmt.free();
    return Promise.resolve(undefined);
  } catch(e) { return Promise.reject(e); }
}

function allAsync(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { return Promise.reject(e); }
}

function runAsync(sql, params = []) {
  try {
    db.run(sql, params);
    const res = db.exec('SELECT last_insert_rowid() as lastID');
    const lastID = res[0]?.values[0][0] || 0;
    guardarEnDisco();
    return Promise.resolve({ lastID });
  } catch(e) { return Promise.reject(e); }
}

module.exports = { iniciarDB, getAsync, allAsync, runAsync };
