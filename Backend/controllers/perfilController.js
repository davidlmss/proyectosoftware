'use strict';
const bcrypt = require('bcryptjs');
const { getAsync, runAsync } = require('../db');
const { sesion } = require('./rolesController');

async function obtenerPerfil(req, res) {
  const u = await sesion(req);
  if (!u) return res.status(401).json({ exito:false, mensaje:'Sesión inválida o expirada.' });
  const usuario = await getAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,fecha_registro,email_verificado FROM USUARIO WHERE id_usuario=?`, [u.id_usuario]);
  return res.json({ exito:true, usuario });
}

async function actualizarPerfil(req, res) {
  try {
    const u = await sesion(req);
    if (!u) return res.status(401).json({ exito:false, mensaje:'Sesión inválida o expirada.' });
    const d = req.body || {};
    const errores = {};
    if (!d.nombre || String(d.nombre).trim().length < 2) errores.nombre='El nombre debe tener mínimo 2 caracteres.';
    if (!d.apellido || String(d.apellido).trim().length < 2) errores.apellido='El apellido debe tener mínimo 2 caracteres.';
    if (!d.ubicacion || !String(d.ubicacion).trim()) errores.ubicacion='Selecciona tu localidad.';
    if (d.contrasena && String(d.contrasena).length < 8) errores.contrasena='La nueva contraseña debe tener mínimo 8 caracteres.';
    if (Object.keys(errores).length) return res.status(400).json({exito:false,errores});

    if (d.contrasena) {
      const hash = await bcrypt.hash(String(d.contrasena), Number(process.env.BCRYPT_ROUNDS || 10));
      await runAsync(`UPDATE USUARIO SET nombre=?,apellido=?,ubicacion=?,contrasena_hash=? WHERE id_usuario=?`, [String(d.nombre).trim(),String(d.apellido).trim(),String(d.ubicacion).trim(),hash,u.id_usuario]);
    } else {
      await runAsync(`UPDATE USUARIO SET nombre=?,apellido=?,ubicacion=? WHERE id_usuario=?`, [String(d.nombre).trim(),String(d.apellido).trim(),String(d.ubicacion).trim(),u.id_usuario]);
    }

    const usuario = await getAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,fecha_registro,email_verificado FROM USUARIO WHERE id_usuario=?`, [u.id_usuario]);
    return res.json({exito:true,mensaje:'Perfil actualizado correctamente.',usuario});
  } catch (e) {
    console.error('[actualizarPerfil]',e.message);
    return res.status(500).json({exito:false,mensaje:'No se pudo actualizar el perfil.'});
  }
}

module.exports = { obtenerPerfil, actualizarPerfil };
