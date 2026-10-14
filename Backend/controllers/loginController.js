/**
 * loginController.js — Caso de Uso: Inicio de Sesión
 * Verifica credenciales y crea sesión en la tabla SESION
 */

const bcrypt = require('bcryptjs');
const { getAsync, runAsync } = require('../db');

function generarToken() {
  return require('crypto').randomBytes(48).toString('hex');
}
function fechaExpiracion() {
  const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString();
}

/**
 * POST /api/login
 * Flujo principal del caso de uso Inicio de Sesión
 */
async function login(req, res) {
  try {
    const { correo, contrasena, recordarme } = req.body;

    // 1. Validar campos obligatorios
    const errores = {};
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !re.test(correo))          errores.correo     = 'Ingresa un correo válido.';
    if (!contrasena || contrasena.length < 1) errores.contrasena = 'Ingresa tu contraseña.';
    if (Object.keys(errores).length > 0) {
      return res.status(400).json({ exito: false, errores });
    }

    // 2. Buscar usuario por correo
    const usuario = await getAsync(
      'SELECT id_usuario, nombre, apellido, correo, contrasena_hash, ubicacion, activo, rol, estado_refugio, email_verificado FROM USUARIO WHERE LOWER(correo) = LOWER(?)',
      [correo.trim()]
    );

    // E-1: Usuario no existe
    if (!usuario) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Correo o contraseña incorrectos.' }
      });
    }

    // E-2: Cuenta inactiva
    if (!usuario.activo) {
      return res.status(403).json({
        exito: false,
        errores: { _global: 'Esta cuenta está desactivada. Contacta al soporte.' }
      });
    }

    // E-3: Correo electrónico aún no confirmado
    if (!usuario.email_verificado) {
      return res.status(403).json({
        exito: false,
        errores: { _global: 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.' }
      });
    }

    // E-4: Usuario registrado con red social (sin contraseña)
    if (!usuario.contrasena_hash) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Esta cuenta fue creada con Google o Facebook. Usa ese método para ingresar.' }
      });
    }

    // 3. Verificar contraseña con bcrypt
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!contrasenaValida) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Correo o contraseña incorrectos.' }
      });
    }

    // Las cuentas administrativas creadas por el sistema también quedan identificadas por nombre y rol.
    // 4. Crear sesión en tabla SESION
    const token  = generarToken();
    const expira = fechaExpiracion();
    await runAsync(
      `INSERT INTO SESION (id_usuario, token_sesion, fecha_expiracion, ip_acceso) VALUES (?, ?, ?, ?)`,
      [usuario.id_usuario, token, expira, req.ip || null]
    );

    console.log(`[Login] Sesión creada para: ${usuario.correo}`);

    // 5. Devolver datos del usuario sin la contraseña
    return res.status(200).json({
      exito: true,
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id_usuario:     usuario.id_usuario,
        nombre:         usuario.nombre,
        apellido:       usuario.apellido,
        correo:         usuario.correo,
        ubicacion:      usuario.ubicacion,
        rol:           usuario.rol,
        estado_refugio: usuario.estado_refugio
      }
    });

  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({
      exito: false,
      errores: { _global: 'Error interno. Intenta de nuevo.' }
    });
  }
}

module.exports = { login };
