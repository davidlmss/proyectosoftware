/**
 * reporteAnimalController.js
 * ControladorReporteAnimal — CU #6: Reportar Animal
 *
 * Flujo según diagrama de secuencia §1.2.1 Sprint 3:
 *   validarDatosReporte() → procesarFotos() → buscarRefugiosPorLocalidad()
 *   → crearReporteAnimal() → guardarReporte() → notificarRefugios()
 *   → mostrarConfirmacion()
 *
 * Tablas BD según §1.2.3 Sprint 3:
 *   REPORTE        — id_reporte, id_usuario, especie, descripcion_fisica,
 *                    estado_animal, estado_reporte, ubicacion, localidad,
 *                    fotos_urls, fecha_creacion
 *   REPORTE_REFUGIO — id_reporte, id_refugio, fecha_notificacion
 *
 * Excepciones:
 *   E-1: Campos obligatorios vacíos / ubicación inválida
 *   E-2: Error al cargar fotografías
 *   E-3: Error al guardar en BD
 */

'use strict';

const { getAsync, runAsync, allAsync } = require('../db');

/* ─── validarDatosReporte(d: Map) ──────────────────────────────── */
function validarDatosReporte(datos) {
  const errores = {};

  if (!datos.descripcion_fisica || datos.descripcion_fisica.trim().length < 10)
    errores.descripcion_fisica = 'Descripción requerida (mínimo 10 caracteres).';

  if (!datos.estado_animal || datos.estado_animal.trim() === '')
    errores.estado_animal = 'Selecciona el estado aparente del animal.';

  if (!datos.ubicacion || datos.ubicacion.trim().length < 5)
    errores.ubicacion = 'Ingresa la dirección o lugar donde encontraste el animal.';

  if (!datos.localidad || datos.localidad.trim() === '')
    errores.localidad = 'Selecciona la localidad para poder notificar refugios cercanos.';

  return { valido: Object.keys(errores).length === 0, errores };
}

/* ─── procesarFotos(fotos_urls) ─────────────────────────────────
   En esta implementación las fotos se reciben como URLs (strings)
   desde el cliente. Retorna JSON serializable para guardar en BD.
──────────────────────────────────────────────────────────────────── */
function procesarFotos(fotos_urls) {
  if (!fotos_urls) return JSON.stringify([]);
  // Acepta string separado por comas o array
  const arr = Array.isArray(fotos_urls)
    ? fotos_urls
    : String(fotos_urls).split(',').map(u => u.trim()).filter(Boolean);
  return JSON.stringify(arr);
}

/* ─── buscarRefugiosPorLocalidad(localidad: String) ─────────────── */
async function buscarRefugiosPorLocalidad(localidad) {
  try {
    const refugios = await allAsync(
      `SELECT id_refugio, nombre_refugio, localidad
       FROM REFUGIO
       WHERE localidad = ?
       ORDER BY id_refugio`,
      [localidad]
    );
    return refugios; // retorna List<Refugio> o []
  } catch (err) {
    console.error('[buscarRefugiosPorLocalidad] error:', err.message);
    return [];
  }
}

/* ─── notificarRefugios(refugios, id_reporte) ────────────────────
   Crea registros en REPORTE_REFUGIO (tabla N:N) para cada refugio
   notificado. Retorna cantidad de notificaciones enviadas.
──────────────────────────────────────────────────────────────────── */
async function notificarRefugios(refugios, idReporte) {
  if (!refugios || refugios.length === 0) return 0;

  let notificados = 0;
  for (const refugio of refugios) {
    try {
      await runAsync(
        `INSERT OR IGNORE INTO REPORTE_REFUGIO (id_reporte, id_refugio)
         VALUES (?, ?)`,
        [idReporte, refugio.id_refugio]
      );
      notificados++;
    } catch (err) {
      console.warn('[notificarRefugios] fallo para refugio', refugio.id_refugio, err.message);
    }
  }
  console.log(`[notificarRefugios] notificados: ${notificados} / ${refugios.length}`);
  return notificados;
}

/* ══════════════════════════════════════════════════════════════════
   POST /api/reportes
   enviarReporte(d: Map) — Flujo principal del CU #6
   Header: Authorization: Bearer <token_sesion>
══════════════════════════════════════════════════════════════════ */
async function crearReporte(req, res) {
  try {
    /* ── E-1 (token): verificar sesión ── */
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Debes iniciar sesión para reportar un animal.' }
      });
    }

    const sesion = await getAsync(
      `SELECT s.id_usuario, u.nombre, u.apellido, u.correo
       FROM SESION s
       JOIN USUARIO u ON s.id_usuario = u.id_usuario
       WHERE s.token_sesion = ?`,
      [token]
    );

    if (!sesion || !sesion.id_usuario) {
      return res.status(401).json({
        exito: false,
        errores: { _global: 'Sesión inválida o expirada. Inicia sesión nuevamente.' }
      });
    }

    const idUsuario = sesion.id_usuario;
    const datos     = req.body;

    console.log('[crearReporte] usuario:', idUsuario, '| body:', datos);

    /* ── validarDatosReporte() ── */
    const { valido, errores } = validarDatosReporte(datos);
    if (!valido) {
      console.log('[crearReporte] errores validación:', errores);
      return res.status(400).json({ exito: false, errores });
    }

    /* ── procesarFotos() ── */
    const fotosJson = procesarFotos(datos.fotos_urls);

    /* ── buscarRefugiosPorLocalidad() ── */
    const refugiosCercanos = await buscarRefugiosPorLocalidad(datos.localidad.trim());
    console.log(`[crearReporte] refugios en "${datos.localidad}":`, refugiosCercanos.length);

    /* ── crearReporte() / guardarReporte() → BaseDeDatos ── */
    let idReporte;
    try {
      const { lastID } = await runAsync(
        `INSERT INTO REPORTE
           (id_usuario, especie, descripcion_fisica, estado_animal,
            estado_reporte, ubicacion, localidad, fotos_urls)
         VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)`,
        [
          idUsuario,
          'perro',
          datos.descripcion_fisica.trim(),
          datos.estado_animal.trim(),
          datos.ubicacion.trim(),
          datos.localidad.trim(),
          fotosJson
        ]
      );
      idReporte = lastID;
      console.log('[crearReporte] reporte guardado id:', idReporte);
    } catch (errBD) {
      console.error('[crearReporte] guardarReporte() error:', errBD.message);
      return res.status(500).json({
        exito: false,
        errores: { _global: 'Error al registrar el reporte. Intenta de nuevo.' }
      });
    }

    /* ── notificarRefugios() ── */
    const cantidadNotificados = await notificarRefugios(refugiosCercanos, idReporte);

    /* ── reporteRegistrado() → mostrarConfirmacion() ── */
    const reporte = await getAsync(
      `SELECT id_reporte, especie, descripcion_fisica, estado_animal,
              estado_reporte, ubicacion, localidad, fotos_urls, fecha_creacion
       FROM REPORTE WHERE id_reporte = ?`,
      [idReporte]
    );

    console.log('[crearReporte] OK — mostrarConfirmacion()');
    return res.status(201).json({
      exito:   true,
      mensaje: 'El reporte ha sido enviado correctamente.',
      reporte,
      refugios_notificados: cantidadNotificados,
      refugios: refugiosCercanos.map(r => r.nombre_refugio)
    });

  } catch (err) {
    console.error('[crearReporte] Error inesperado:', err.message);
    return res.status(500).json({
      exito: false,
      errores: { _global: 'Error interno del servidor. Intenta de nuevo.' }
    });
  }
}

/* ══════════════════════════════════════════════════════════════════
   GET /api/reportes
   Listar todos los reportes del usuario autenticado
══════════════════════════════════════════════════════════════════ */
async function listarMisReportes(req, res) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) return res.status(401).json({ exito: false, mensaje: 'No autenticado.' });

    const sesion = await getAsync(
      `SELECT id_usuario FROM SESION WHERE token_sesion = ?`, [token]
    );
    if (!sesion || !sesion.id_usuario)
      return res.status(401).json({ exito: false, mensaje: 'Sesión inválida o expirada.' });

    const reportes = await allAsync(
      `SELECT id_reporte, especie, descripcion_fisica, estado_animal,
              estado_reporte, ubicacion, localidad, fotos_urls, fecha_creacion
       FROM REPORTE
       WHERE id_usuario = ?
       ORDER BY fecha_creacion DESC`,
      [sesion.id_usuario]
    );

    return res.json({ exito: true, total: reportes.length, reportes });
  } catch (err) {
    console.error('[listarMisReportes]', err.message);
    return res.status(500).json({ exito: false, mensaje: 'Error al obtener reportes.' });
  }
}


/* GET /api/reportes/publicos — reportes independientes de una fundación.
   Un reporte existe aunque no haya refugios en la localidad o ningún refugio
   lo haya aceptado. Solo se muestran reportes que aún no están cerrados. */
async function listarReportesPublicos(req, res) {
  try {
    const condiciones = ["estado_reporte IN ('pendiente','en_proceso')"];
    const params = [];
    if (req.query.especie && ['perro'].includes(req.query.especie)) {
      condiciones.push('especie = ?'); params.push(req.query.especie);
    }
    if (req.query.localidad) {
      condiciones.push('localidad = ?'); params.push(req.query.localidad);
    }
    const reportes = await allAsync(`
      SELECT id_reporte, especie, descripcion_fisica, estado_animal,
             estado_reporte, ubicacion, localidad, fotos_urls, fecha_creacion
      FROM REPORTE
      WHERE ${condiciones.join(' AND ')}
      ORDER BY fecha_creacion DESC`, params);
    return res.json({exito:true,total:reportes.length,reportes});
  } catch(err) {
    console.error('[listarReportesPublicos]', err.message);
    return res.status(500).json({exito:false,mensaje:'Error al obtener los reportes públicos.'});
  }
}

/* GET /api/refugio/reportes — reportes enviados/notificados a los refugios del usuario */
async function listarReportesRefugio(req, res) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) return res.status(401).json({ exito:false, mensaje:'No autenticado.' });

    const sesion = await getAsync(`SELECT s.id_usuario FROM SESION s WHERE s.token_sesion=?`, [token]);
    if (!sesion) return res.status(401).json({ exito:false, mensaje:'Sesión inválida o expirada.' });
    const refugioUsuario = await getAsync(`SELECT 1 AS ok FROM REFUGIO WHERE id_usuario=? LIMIT 1`, [sesion.id_usuario]);
    if (!refugioUsuario)
      return res.status(403).json({ exito:false, mensaje:'Solo los perfiles con refugios aprobados pueden administrar reportes.' });

    const reportes = await allAsync(`
      SELECT DISTINCT r.id_reporte,r.id_usuario,r.especie,r.descripcion_fisica,r.estado_animal,
             r.estado_reporte,r.ubicacion,r.localidad,r.fotos_urls,r.fecha_creacion,
             u.nombre AS reportante_nombre,u.apellido AS reportante_apellido,
             COALESCE(rr.id_refugio, (SELECT f2.id_refugio FROM REFUGIO f2 WHERE f2.id_usuario=? AND f2.localidad=r.localidad ORDER BY f2.id_refugio LIMIT 1)) AS id_refugio,
             COALESCE(f.nombre_refugio, (SELECT f3.nombre_refugio FROM REFUGIO f3 WHERE f3.id_usuario=? AND f3.localidad=r.localidad ORDER BY f3.id_refugio LIMIT 1)) AS nombre_refugio
      FROM REPORTE r
      LEFT JOIN REPORTE_REFUGIO rr ON rr.id_reporte=r.id_reporte
      LEFT JOIN REFUGIO f ON f.id_refugio=rr.id_refugio
      JOIN USUARIO u ON u.id_usuario=r.id_usuario
      WHERE r.estado_reporte IN ('pendiente','en_proceso')
        AND (
          f.id_usuario=?
          OR EXISTS (SELECT 1 FROM REFUGIO f4 WHERE f4.id_usuario=? AND f4.localidad=r.localidad)
        )
      ORDER BY r.fecha_creacion DESC`, [sesion.id_usuario, sesion.id_usuario, sesion.id_usuario, sesion.id_usuario]);

    const refugios = await allAsync(`SELECT id_refugio,nombre_refugio,localidad FROM REFUGIO WHERE id_usuario=? ORDER BY nombre_refugio`, [sesion.id_usuario]);
    return res.json({ exito:true, reportes, refugios });
  } catch(err) {
    console.error('[listarReportesRefugio]',err.message);
    return res.status(500).json({exito:false,mensaje:'Error al obtener los reportes del refugio.'});
  }
}

/* PATCH /api/refugio/reportes/:id/estado */
async function actualizarEstadoReporte(req,res) {
  try {
    const authHeader=req.headers['authorization']||'';
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():null;
    const sesion=token ? await getAsync(`SELECT s.id_usuario FROM SESION s WHERE s.token_sesion=?`,[token]) : null;
    if(!sesion) return res.status(401).json({exito:false,mensaje:'Sesión inválida o expirada.'});
    const tieneRefugio=await getAsync(`SELECT 1 AS ok FROM REFUGIO WHERE id_usuario=? LIMIT 1`,[sesion.id_usuario]);
    if(!tieneRefugio) return res.status(403).json({exito:false,mensaje:'Solo los perfiles con refugios aprobados pueden gestionar reportes.'});
    const estado=req.body.estado;
    if(!['pendiente','en_proceso','atendido','cerrado'].includes(estado)) return res.status(400).json({exito:false,mensaje:'Estado no válido.'});
    const id=Number(req.params.id);
    const acceso=await getAsync(`
      SELECT r.id_reporte FROM REPORTE r
      WHERE r.id_reporte=?
        AND (EXISTS (SELECT 1 FROM REPORTE_REFUGIO rr JOIN REFUGIO f ON f.id_refugio=rr.id_refugio WHERE rr.id_reporte=r.id_reporte AND f.id_usuario=?)
             OR EXISTS (SELECT 1 FROM REFUGIO f2 WHERE f2.id_usuario=? AND f2.localidad=r.localidad))`,[id,sesion.id_usuario,sesion.id_usuario]);
    if(!acceso) return res.status(403).json({exito:false,mensaje:'Este reporte no pertenece a tus refugios.'});
    await runAsync(`UPDATE REPORTE SET estado_reporte=? WHERE id_reporte=?`,[estado,id]);
    return res.json({exito:true,mensaje:'Estado del reporte actualizado.'});
  }catch(err){ console.error('[actualizarEstadoReporte]',err.message); return res.status(500).json({exito:false,mensaje:'Error al actualizar el reporte.'}); }
}

/* POST /api/refugio/reportes/:id/registrar-animal — convierte un reporte en animal del refugio */
async function registrarAnimalDesdeReporte(req,res){
  try {
    const authHeader=req.headers['authorization']||'';
    const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():null;
    const sesion=token ? await getAsync(`SELECT s.id_usuario FROM SESION s WHERE s.token_sesion=?`,[token]) : null;
    if(!sesion) return res.status(401).json({exito:false,mensaje:'Sesión inválida o expirada.'});
    const tieneRefugio=await getAsync(`SELECT 1 AS ok FROM REFUGIO WHERE id_usuario=? LIMIT 1`,[sesion.id_usuario]);
    if(!tieneRefugio) return res.status(403).json({exito:false,mensaje:'Solo los perfiles con refugios aprobados pueden registrar animales.'});
    const id=Number(req.params.id), idRefugio=Number(req.body.id_refugio);
    const refugio=await getAsync(`SELECT id_refugio FROM REFUGIO WHERE id_refugio=? AND id_usuario=?`,[idRefugio,sesion.id_usuario]);
    if(!refugio) return res.status(403).json({exito:false,mensaje:'El refugio seleccionado no te pertenece.'});
    const reporte=await getAsync(`SELECT * FROM REPORTE WHERE id_reporte=?`,[id]);
    if(!reporte) return res.status(404).json({exito:false,mensaje:'Reporte no encontrado.'});
    // Un reporte puede existir sin estar vinculado todavía a una fundación.
    // Un refugio aprobado puede tomarlo si está en la misma localidad o si ya fue notificado.
    const acceso=await getAsync(`
      SELECT r.id_reporte
      FROM REPORTE r
      WHERE r.id_reporte=?
        AND (EXISTS (SELECT 1 FROM REPORTE_REFUGIO rr JOIN REFUGIO f ON f.id_refugio=rr.id_refugio WHERE rr.id_reporte=r.id_reporte AND f.id_usuario=?)
             OR EXISTS (SELECT 1 FROM REFUGIO f2 WHERE f2.id_usuario=? AND f2.localidad=r.localidad))`,
      [id,sesion.id_usuario,sesion.id_usuario]);
    if(!acceso) return res.status(403).json({exito:false,mensaje:'Este reporte no corresponde a la localidad de tus refugios.'});
    const especie='perro';
    const estadoSalud=reporte.estado_animal==='herido'?'en_tratamiento':'estable';
    const {lastID}=await runAsync(`INSERT INTO ANIMAL (id_refugio,nombre,especie,descripcion,estado_salud,estado_adopcion,fotos_urls) VALUES (?,?,?,?,?,'disponible',?)`,[idRefugio,`Animal reportado #${id}`,especie,reporte.descripcion_fisica,estadoSalud,reporte.fotos_urls||'[]']);
    await runAsync(`INSERT OR IGNORE INTO REPORTE_REFUGIO (id_reporte,id_refugio) VALUES (?,?)`,[id,idRefugio]);
    await runAsync(`UPDATE REPORTE SET estado_reporte='atendido' WHERE id_reporte=?`,[id]);
    const animal=await getAsync(`SELECT a.*,f.nombre_refugio FROM ANIMAL a JOIN REFUGIO f ON f.id_refugio=a.id_refugio WHERE a.id_animal=?`,[lastID]);
    return res.status(201).json({exito:true,mensaje:'El animal reportado fue incorporado al refugio y quedó disponible para adopción.',animal});
  }catch(err){ console.error('[registrarAnimalDesdeReporte]',err.message); return res.status(500).json({exito:false,mensaje:'Error al convertir el reporte en animal.'}); }
}

module.exports.crearReporte = crearReporte;
module.exports.listarMisReportes = listarMisReportes;
module.exports.listarReportesPublicos = listarReportesPublicos;
module.exports.listarReportesRefugio = listarReportesRefugio;
module.exports.actualizarEstadoReporte = actualizarEstadoReporte;
module.exports.registrarAnimalDesdeReporte = registrarAnimalDesdeReporte;
