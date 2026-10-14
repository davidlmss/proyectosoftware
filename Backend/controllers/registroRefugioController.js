/**
 * registroRefugioController.js
 * ControladorRegistroRefugio — CU #4: Registro de Perfil de Refugio
 *
 * Flujo según diagrama de secuencia §1.2.1:
 *   validarDatosRefugio() → crearRefugio() → guardarRefugio() → mostrarConfirmacion()
 *
 * Columnas REFUGIO según §1.2.3: nombre_refugio, direccion, descripcion, capacidad, localidad, id_usuario
 *
 * Excepciones:
 *   E-1: Token inválido/expirado
 *   E-2: Datos inválidos
 *   E-3: Error al guardar en BD
 */

const { getAsync, runAsync, allAsync } = require('../db');

/* ─── validarDatosRefugio() ─────────────────────────────────────── */
function validarDatosRefugio(datos) {
  const errores = {};

  if (!datos.nombre_refugio || datos.nombre_refugio.trim().length < 3)
    errores.nombre_refugio = 'Nombre del refugio requerido (mínimo 3 caracteres).';
  if (!datos.direccion || datos.direccion.trim().length < 5)
    errores.direccion = 'Ingresa la dirección física del refugio.';
  if (!datos.descripcion || datos.descripcion.trim().length < 10)
    errores.descripcion = 'Escribe una descripción (mínimo 10 caracteres).';
  if (!datos.localidad || datos.localidad.trim() === '')
    errores.localidad = 'Selecciona la localidad.';
  if (datos.capacidad === undefined || datos.capacidad === '' ||
      isNaN(Number(datos.capacidad)) || Number(datos.capacidad) < 1)
    errores.capacidad = 'Ingresa una capacidad mayor a 0.';
  if (datos.capacidad_actual === undefined || datos.capacidad_actual === '' ||
      isNaN(Number(datos.capacidad_actual)) || Number(datos.capacidad_actual) < 0)
    errores.capacidad_actual = 'Ingresa la cantidad actual de perros.';
  else if (datos.capacidad !== undefined && datos.capacidad !== '' && Number(datos.capacidad_actual) > Number(datos.capacidad))
    errores.capacidad_actual = 'La cantidad actual de perros no puede superar la capacidad del refugio.';
  if (!datos.responsable_nombre || datos.responsable_nombre.trim().length < 3) errores.responsable_nombre='Ingresa el nombre del responsable.';
  if (!datos.responsable_correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.responsable_correo)) errores.responsable_correo='Correo del responsable inválido.';
  if (!datos.responsable_telefono || datos.responsable_telefono.trim().length < 7) errores.responsable_telefono='Ingresa el teléfono del responsable.';
  if (!Array.isArray(datos.permisos_autorizaciones) || datos.permisos_autorizaciones.length===0) errores.permisos_autorizaciones='Selecciona al menos un permiso o autorización.';

  return { valido: Object.keys(errores).length === 0, errores };
}

/* ─── registrarRefugio() ────────────────────────────────────────────
   POST /api/registro-refugio
   Header: Authorization: Bearer <token_sesion>
──────────────────────────────────────────────────────────────────── */
async function registrarRefugio(req, res) {
  try {
    // E-1: Verificar token
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    console.log('[registrarRefugio] token:', token ? token.substring(0, 20) + '...' : 'NINGUNO');
    console.log('[registrarRefugio] body:', req.body);

    if (!token) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Debes iniciar sesión para registrar un refugio.' }
      });
    }

    // Buscar sesión activa
    const sesion = await getAsync(
      `SELECT s.id_usuario, u.nombre, u.apellido, u.correo
       FROM SESION s
       JOIN USUARIO u ON s.id_usuario = u.id_usuario
       WHERE s.token_sesion = ?`,
      [token]
    );

    console.log('[registrarRefugio] sesion:', sesion);

    if (!sesion || !sesion.id_usuario) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Sesión inválida o expirada. Inicia sesión nuevamente.' }
      });
    }

    const idUsuario = sesion.id_usuario;
    const datos     = req.body;

    // E-2: validarDatosRefugio()
    const { valido, errores } = validarDatosRefugio(datos);
    if (!valido) {
      console.log('[registrarRefugio] errores validación:', errores);
      return res.status(400).json({ exito: false, errores });
    }

    // E-3: crearRefugio() → guardarRefugio()
    let idRefugio;
    try {
      const { lastID } = await runAsync(
        `INSERT INTO REFUGIO (nombre_refugio, direccion, descripcion, capacidad, localidad, id_usuario, telefono, red_social, logo_url, tipo,responsable_nombre,responsable_correo,responsable_telefono,capacidad_actual,permisos_autorizaciones,instagram,facebook,tiktok,x_social,youtube,whatsapp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [datos.nombre_refugio.trim(),datos.direccion.trim(),datos.descripcion.trim(),datos.capacidad ? Number(datos.capacidad) : null,datos.localidad.trim(),idUsuario,datos.telefono?datos.telefono.trim():null,null,datos.logo_url?datos.logo_url.trim():null,'perros',datos.responsable_nombre.trim(),datos.responsable_correo.trim(),datos.responsable_telefono.trim(),datos.capacidad_actual!==''?Number(datos.capacidad_actual):null,JSON.stringify(Array.isArray(datos.permisos_autorizaciones)?datos.permisos_autorizaciones:[]),datos.instagram||null,datos.facebook||null,datos.tiktok||null,datos.x_social||null,datos.youtube||null,datos.whatsapp||null]
      );
      idRefugio = lastID;
      console.log('[registrarRefugio] Refugio creado id:', idRefugio);
    } catch (errBD) {
      console.error('[registrarRefugio] Error guardarRefugio():', errBD.message);
      return res.status(500).json({
        exito: false,
        errores: { _global: 'Error al registrar el refugio. Intenta de nuevo.' }
      });
    }

    let trabajadores=[]; try { trabajadores=Array.isArray(datos.trabajadores)?datos.trabajadores:JSON.parse(datos.trabajadores_json||'[]'); } catch(e){ trabajadores=[]; }
    for(const t of trabajadores){ if(t && t.nombre && t.correo) await runAsync(`INSERT INTO REFUGIO_TRABAJADOR (id_refugio,nombre,correo,telefono,cargo) VALUES (?,?,?,?,?)`,[idRefugio,String(t.nombre).trim(),String(t.correo).trim(),t.telefono||null,t.cargo||null]); }

    // publicarPerfil() → mostrarConfirmacion()
    const refugio = await getAsync(
      `SELECT id_refugio, nombre_refugio, direccion, descripcion, capacidad, capacidad_actual, localidad, telefono, red_social, logo_url, tipo, responsable_nombre, responsable_correo, responsable_telefono, permisos_autorizaciones, instagram, facebook, tiktok, x_social, youtube, whatsapp
       FROM REFUGIO WHERE id_refugio = ?`,
      [idRefugio]
    );

    const usuario = {
      nombre:   sesion.nombre,
      apellido: sesion.apellido,
      correo:   sesion.correo
    };

    console.log('[registrarRefugio] OK:', refugio);
    return res.status(201).json({
      exito:   true,
      mensaje: 'Perfil de refugio registrado exitosamente.',
      usuario,
      refugio
    });

  } catch (err) {
    console.error('[registrarRefugio] Error inesperado:', err.message);
    return res.status(500).json({
      exito: false,
      errores: { _global: 'Error interno del servidor. Intenta de nuevo.' }
    });
  }
}

/* ─── listarRefugios() ──────────────────────────────────────────────
   GET /api/refugios
──────────────────────────────────────────────────────────────────── */
async function listarRefugios(req, res) {
  try {
    // Consulta pública deliberadamente independiente del usuario y del estado.
    // Si un refugio existe en REFUGIO, debe poder visualizarse públicamente.
    const filas = await allAsync(`SELECT r.*, COALESCE((SELECT COUNT(*) FROM ANIMAL a WHERE a.id_refugio=r.id_refugio AND COALESCE(a.estado_adopcion,'disponible')<>'adoptado'),0) AS perros_actuales FROM REFUGIO r ORDER BY r.id_refugio DESC`);

    const refugios = filas.map(r => ({
      id_refugio: r.id_refugio,
      nombre_refugio: r.nombre_refugio,
      direccion: r.direccion || '',
      descripcion: r.descripcion || 'Refugio registrado en RefugiosBogotá.',
      capacidad: r.capacidad ?? null,
      capacidad_actual: Number(r.perros_actuales ?? 0),
      localidad: r.localidad || '',
      telefono: r.telefono || '',
      red_social: r.red_social || '',
      logo_url: r.logo_url || '',
      tipo: 'perros',
      estado: r.estado || 'aprobada',
      instagram: r.instagram || '',
      facebook: r.facebook || '',
      tiktok: r.tiktok || '',
      x_social: r.x_social || '',
      youtube: r.youtube || '',
      whatsapp: r.whatsapp || '',
      responsable_nombre: r.responsable_nombre || ''
    }));

    console.log(`[listarRefugios] ${refugios.length} refugio(s) público(s)`);
    return res.json({ exito: true, total: refugios.length, refugios });
  } catch (err) {
    console.error('[listarRefugios] Error:', err.message);
    return res.status(500).json({ exito: false, error: 'Error al obtener refugios.', refugios: [] });
  }
}

/* ─── getMisRefugios() ──────────────────────────────────────────────
   GET /api/mis-refugios
   Header: Authorization: Bearer <token_sesion>
   Devuelve los refugios creados por el usuario autenticado.
──────────────────────────────────────────────────────────────────── */
async function getMisRefugios(req, res) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ exito: false, mensaje: 'No autenticado.' });
    }

    const sesion = await getAsync(
      `SELECT s.id_usuario FROM SESION s WHERE s.token_sesion = ?`,
      [token]
    );

    if (!sesion || !sesion.id_usuario) {
      return res.status(401).json({ exito: false, mensaje: 'Sesión inválida o expirada.' });
    }

    const refugios = await allAsync(
      `SELECT r.id_refugio, r.nombre_refugio, r.direccion, r.descripcion, r.capacidad, COALESCE((SELECT COUNT(*) FROM ANIMAL a WHERE a.id_refugio=r.id_refugio AND COALESCE(a.estado_adopcion,'disponible')<>'adoptado'),0) AS capacidad_actual, r.localidad, r.telefono, r.red_social, r.logo_url, r.tipo, r.responsable_nombre, r.responsable_correo, r.responsable_telefono, r.permisos_autorizaciones, r.instagram, r.facebook, r.tiktok, r.x_social, r.youtube, r.whatsapp
       FROM REFUGIO r
       WHERE r.id_usuario = ?
       ORDER BY id_refugio DESC`,
      [sesion.id_usuario]
    );

    return res.json({ exito: true, total: refugios.length, refugios });

  } catch (err) {
    console.error('[getMisRefugios]', err.message);
    return res.status(500).json({ exito: false, mensaje: 'Error al obtener tus refugios.' });
  }
}

/* ─── getRefugioById() ──────────────────────────────────────────────
   GET /api/refugios/:id
   Header: Authorization: Bearer <token_sesion>
   Devuelve un refugio por ID, solo si pertenece al usuario autenticado.
──────────────────────────────────────────────────────────────────── */
async function getRefugioById(req, res) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ exito: false, mensaje: 'No autenticado.' });
    }

    const sesion = await getAsync(
      `SELECT id_usuario FROM SESION WHERE token_sesion = ?`,
      [token]
    );

    if (!sesion || !sesion.id_usuario) {
      return res.status(401).json({ exito: false, mensaje: 'Sesión inválida o expirada.' });
    }

    const idRefugio = parseInt(req.params.id, 10);
    if (!idRefugio) {
      return res.status(400).json({ exito: false, mensaje: 'ID de refugio inválido.' });
    }

    const refugio = await getAsync(
      `SELECT r.id_refugio, r.nombre_refugio, r.direccion, r.descripcion, r.capacidad, COALESCE((SELECT COUNT(*) FROM ANIMAL a WHERE a.id_refugio=r.id_refugio AND COALESCE(a.estado_adopcion,'disponible')<>'adoptado'),0) AS capacidad_actual, r.localidad, r.telefono, r.red_social, r.logo_url, r.tipo, r.responsable_nombre, r.responsable_correo, r.responsable_telefono, r.permisos_autorizaciones, r.instagram, r.facebook, r.tiktok, r.x_social, r.youtube, r.whatsapp
       FROM REFUGIO r
       WHERE r.id_refugio = ? AND id_usuario = ?`,
      [idRefugio, sesion.id_usuario]
    );

    if (!refugio) {
      return res.status(404).json({ exito: false, mensaje: 'Refugio no encontrado o no tienes permiso.' });
    }

    try { refugio.permisos_autorizaciones = JSON.parse(refugio.permisos_autorizaciones || '[]'); } catch(e) { refugio.permisos_autorizaciones = String(refugio.permisos_autorizaciones || '').split(',').map(x=>x.trim()).filter(Boolean); }
  refugio.trabajadores = await allAsync(`SELECT id_trabajador,nombre,correo,telefono,cargo FROM REFUGIO_TRABAJADOR WHERE id_refugio=? ORDER BY id_trabajador`,[idRefugio]);
    return res.json({ exito: true, refugio });

  } catch (err) {
    console.error('[getRefugioById]', err.message);
    return res.status(500).json({ exito: false, mensaje: 'Error al obtener el refugio.' });
  }
}

/* ─── actualizarRefugio() ───────────────────────────────────────────
   PUT /api/refugios/:id
   Header: Authorization: Bearer <token_sesion>
   CU #5 — actualizarDatosPerfil(): edita los datos de un refugio propio.
──────────────────────────────────────────────────────────────────── */
async function actualizarRefugio(req, res) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ exito: false, errores: { _global: 'Debes iniciar sesión.' } });
    }

    const sesion = await getAsync(
      `SELECT id_usuario FROM SESION WHERE token_sesion = ?`,
      [token]
    );

    if (!sesion || !sesion.id_usuario) {
      return res.status(401).json({ exito: false, errores: { _global: 'Sesión inválida o expirada.' } });
    }

    const idRefugio = parseInt(req.params.id, 10);
    if (!idRefugio) {
      return res.status(400).json({ exito: false, errores: { _global: 'ID de refugio inválido.' } });
    }

    // Verificar que el refugio pertenece al usuario
    const existente = await getAsync(
      `SELECT id_refugio FROM REFUGIO WHERE id_refugio = ? AND id_usuario = ?`,
      [idRefugio, sesion.id_usuario]
    );

    if (!existente) {
      return res.status(403).json({ exito: false, errores: { _global: 'No tienes permiso para editar este refugio.' } });
    }

    const datos = req.body;

    // Reutilizar validarDatosRefugio()
    const { valido, errores } = validarDatosRefugio(datos);
    if (!valido) {
      return res.status(400).json({ exito: false, errores });
    }

    await runAsync(
      `UPDATE REFUGIO
       SET nombre_refugio = ?, direccion = ?, descripcion = ?, capacidad = ?, localidad = ?,
           telefono = ?, red_social = ?, logo_url = ?, tipo = ?, responsable_nombre = ?, responsable_correo = ?, responsable_telefono = ?,
           capacidad_actual = ?, permisos_autorizaciones = ?,
           instagram = ?, facebook = ?, tiktok = ?, x_social = ?, youtube = ?, whatsapp = ?
       WHERE id_refugio = ? AND id_usuario = ?`,
      [
        datos.nombre_refugio.trim(),
        datos.direccion.trim(),
        datos.descripcion.trim(),
        datos.capacidad ? Number(datos.capacidad) : null,
        datos.localidad.trim(),
        datos.telefono   ? datos.telefono.trim()   : null,
        null,
        datos.logo_url   ? datos.logo_url.trim()   : null,
        'perros',
        datos.responsable_nombre.trim(), datos.responsable_correo.trim(), datos.responsable_telefono.trim(),
        datos.capacidad_actual!=='' && datos.capacidad_actual!==undefined ? Number(datos.capacidad_actual) : null,
        JSON.stringify(Array.isArray(datos.permisos_autorizaciones)?datos.permisos_autorizaciones:[]),
        datos.instagram || null, datos.facebook || null, datos.tiktok || null, datos.x_social || null, datos.youtube || null, datos.whatsapp || null,
        idRefugio,
        sesion.id_usuario
      ]
    );

    let trabajadores=[]; try { trabajadores=Array.isArray(datos.trabajadores)?datos.trabajadores:[]; } catch(e){ trabajadores=[]; }
    await runAsync(`DELETE FROM REFUGIO_TRABAJADOR WHERE id_refugio=?`,[idRefugio]);
    for(const t of trabajadores){ if(t && t.nombre && t.correo) await runAsync(`INSERT INTO REFUGIO_TRABAJADOR (id_refugio,nombre,correo,telefono,cargo) VALUES (?,?,?,?,?)`,[idRefugio,String(t.nombre).trim(),String(t.correo).trim(),t.telefono||null,t.cargo||null]); }

    const refugioActualizado = await getAsync(
      `SELECT id_refugio, nombre_refugio, direccion, descripcion, capacidad, capacidad_actual, localidad, telefono, red_social, logo_url, tipo, responsable_nombre, responsable_correo, responsable_telefono, permisos_autorizaciones, instagram, facebook, tiktok, x_social, youtube, whatsapp
       FROM REFUGIO WHERE id_refugio = ?`,
      [idRefugio]
    );

    try { refugioActualizado.permisos_autorizaciones = JSON.parse(refugioActualizado.permisos_autorizaciones || '[]'); } catch(e) { refugioActualizado.permisos_autorizaciones = String(refugioActualizado.permisos_autorizaciones || '').split(',').map(x=>x.trim()).filter(Boolean); }
    refugioActualizado.trabajadores = await allAsync(`SELECT id_trabajador,nombre,correo,telefono,cargo FROM REFUGIO_TRABAJADOR WHERE id_refugio=? ORDER BY id_trabajador`,[idRefugio]);

    console.log('[actualizarRefugio] OK id:', idRefugio);
    return res.json({
      exito:   true,
      mensaje: 'Refugio actualizado exitosamente.',
      refugio: refugioActualizado
    });

  } catch (err) {
    console.error('[actualizarRefugio]', err.message);
    return res.status(500).json({ exito: false, errores: { _global: 'Error interno al actualizar.' } });
  }
}

module.exports = { registrarRefugio, listarRefugios, getMisRefugios, getRefugioById, actualizarRefugio };
