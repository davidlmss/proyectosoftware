const { getAsync, runAsync } = require('../db');

async function verificarCorreo(req, res) {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).json({ exito: false, mensaje: 'Token de verificación faltante.' });
    }

    const usuario = await getAsync(
      `SELECT id_usuario, nombre, correo, email_verificado, token_verificacion_expira
       FROM USUARIO WHERE token_verificacion_email = ?`,
      [token]
    );

    if (!usuario) {
      return res.status(400).json({ exito: false, mensaje: 'El enlace de verificación no es válido o ya fue utilizado.' });
    }

    if (usuario.email_verificado) {
      return res.json({ exito: true, mensaje: 'El correo ya estaba confirmado.' });
    }

    if (!usuario.token_verificacion_expira || new Date(usuario.token_verificacion_expira) < new Date()) {
      return res.status(400).json({ exito: false, mensaje: 'El enlace de verificación expiró. Solicita un nuevo correo de confirmación.' });
    }

    await runAsync(
      `UPDATE USUARIO
       SET email_verificado = 1, token_verificacion_email = NULL, token_verificacion_expira = NULL
       WHERE id_usuario = ?`,
      [usuario.id_usuario]
    );

    return res.json({ exito: true, mensaje: 'Correo confirmado correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('[verificarCorreo]', err.message);
    return res.status(500).json({ exito: false, mensaje: 'No se pudo confirmar el correo.' });
  }
}

module.exports = { verificarCorreo };
