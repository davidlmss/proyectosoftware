/**
 * animalController.js — CU #7: Registro y adopción de animales
 * Un animal pertenece a un refugio. Solo el propietario del refugio
 * puede registrarlo; cualquier usuario autenticado puede solicitar adopción.
 */
'use strict';

const { getAsync, runAsync, allAsync } = require('../db');

async function obtenerSesion(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  return getAsync(`
    SELECT s.id_usuario, u.nombre, u.apellido, u.correo, u.rol, u.estado_refugio
    FROM SESION s JOIN USUARIO u ON s.id_usuario = u.id_usuario
    WHERE s.token_sesion = ?`, [token]);
}

function validarAnimal(d) {
  const errores = {};
  if (d.id_refugio !== undefined && d.id_refugio !== '' && !Number.isInteger(Number(d.id_refugio)))
    errores.id_refugio = 'Identificador de refugio no válido.';
  if (!d.nombre || d.nombre.trim().length < 2)
    errores.nombre = 'El nombre del animal es obligatorio.';
  if (d.sexo && !['macho','hembra','no_determinado'].includes(d.sexo))
    errores.sexo = 'Sexo no válido.';
  if (d.tamano && !['pequeno','mediano','grande'].includes(d.tamano))
    errores.tamano = 'Tamaño no válido.';
  if (!d.descripcion || d.descripcion.trim().length < 10)
    errores.descripcion = 'La descripción debe tener mínimo 10 caracteres.';
  if (d.estado_salud && !['estable','en_tratamiento','recuperacion','especial','embarazo'].includes(d.estado_salud))
    errores.estado_salud = 'Estado de salud no válido.';
  return { valido: Object.keys(errores).length === 0, errores };
}

function fotosJson(value) {
  if (!value) return JSON.stringify([]);
  const arr = Array.isArray(value) ? value : String(value).split(',').map(x => x.trim());
  return JSON.stringify(arr.filter(Boolean));
}

/* POST /api/animales */
async function registrarAnimal(req, res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({ exito:false, errores:{_global:'Debes iniciar sesión.'} });

    const datos = req.body;
    const validacion = validarAnimal(datos);
    if (!validacion.valido) return res.status(400).json({ exito:false, errores:validacion.errores });

    // El refugio se determina por la sesión del usuario. Si tiene varios refugios,
    // la interfaz puede enviar el ID de contexto internamente; nunca se muestra
    // como un selector al usuario.
    let idRefugio = datos.id_refugio ? Number(datos.id_refugio) : null;
    let refugio;
    if (idRefugio) {
      refugio = await getAsync(`SELECT r.id_refugio, r.nombre_refugio FROM REFUGIO r WHERE r.id_refugio=? AND r.id_usuario=? AND COALESCE(r.estado,'aprobada')='aprobada'`, [idRefugio, sesion.id_usuario]);
    } else {
      refugio = await getAsync(`SELECT r.id_refugio, r.nombre_refugio FROM REFUGIO r WHERE r.id_usuario=? AND COALESCE(r.estado,'aprobada')='aprobada' ORDER BY r.id_refugio DESC LIMIT 1`, [sesion.id_usuario]);
      if (refugio) idRefugio = refugio.id_refugio;
    }
    if (!refugio)
      return res.status(403).json({ exito:false, errores:{_global:'No se encontró un refugio aprobado asociado a tu cuenta.'} });

    // No se permite registrar más perros de los que soporta la capacidad máxima.
    const capacidadRefugio = await getAsync(`SELECT capacidad, capacidad_actual FROM REFUGIO WHERE id_refugio=?`, [idRefugio]);
    if (capacidadRefugio && capacidadRefugio.capacidad !== null && capacidadRefugio.capacidad !== undefined) {
      const actuales = Number(capacidadRefugio.capacidad_actual || 0);
      if (actuales >= Number(capacidadRefugio.capacidad)) {
        return res.status(409).json({exito:false,errores:{_global:'No se puede registrar otro perro porque el refugio ya alcanzó su capacidad máxima.'}});
      }
    }

    // Si el refugio existe porque fue aprobado por el administrador, sincronizar
    // el perfil por si el navegador conserva una sesión creada antes de la aprobación.
    if (sesion.rol !== 'refugio' || sesion.estado_refugio !== 'aprobada') {
      await runAsync(`UPDATE USUARIO SET rol='refugio', estado_refugio='aprobada' WHERE id_usuario=?`, [sesion.id_usuario]);
    }

    const { lastID } = await runAsync(`
      INSERT INTO ANIMAL
      (id_refugio,nombre,especie,raza,sexo,edad,tamano,color,descripcion,estado_salud,estado_adopcion,fotos_urls)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        idRefugio, datos.nombre.trim(), 'perro',
        datos.raza?.trim() || null, datos.sexo || 'no_determinado',
        datos.edad?.trim() || null, datos.tamano || null,
        datos.color?.trim() || null, datos.descripcion.trim(),
        datos.estado_salud || 'estable', 'disponible', fotosJson(datos.fotos_urls)
      ]
    );

    await runAsync(`UPDATE REFUGIO SET capacidad_actual = COALESCE(capacidad_actual,0) + 1 WHERE id_refugio=?`, [idRefugio]);

    const animal = await getAsync(`
      SELECT a.*, r.nombre_refugio
      FROM ANIMAL a JOIN REFUGIO r ON a.id_refugio = r.id_refugio
      WHERE a.id_animal = ?`, [lastID]);

    return res.status(201).json({ exito:true, mensaje:'Animal registrado correctamente.', animal });
  } catch (err) {
    console.error('[registrarAnimal]', err.message);
    return res.status(500).json({ exito:false, errores:{_global:'Error interno al registrar el animal.'} });
  }
}

/* GET /api/animales — público en cuanto a consulta, devuelve disponibles */
async function listarAnimales(req, res) {
  try {
    const condiciones = ["a.estado_adopcion IN ('disponible','en_proceso')"];
    const params = [];
    if (req.query.especie && ['perro'].includes(req.query.especie)) {
      condiciones.push('a.especie = ?'); params.push(req.query.especie);
    }
    if (req.query.localidad) {
      condiciones.push('LOWER(r.localidad) = LOWER(?)'); params.push(req.query.localidad);
    }
    if (req.query.refugio) {
      const idRefugioFiltro = Number(req.query.refugio);
      if (Number.isInteger(idRefugioFiltro) && idRefugioFiltro > 0) {
        condiciones.push('a.id_refugio = ?'); params.push(idRefugioFiltro);
      }
    }
    const animales = await allAsync(`
      SELECT a.id_animal,a.id_refugio,a.nombre,a.especie,a.raza,a.sexo,a.edad,
             a.tamano,a.color,a.descripcion,a.estado_salud,a.estado_adopcion,
             a.fotos_urls,a.fecha_ingreso,r.nombre_refugio,r.localidad,r.direccion
      FROM ANIMAL a JOIN REFUGIO r ON a.id_refugio = r.id_refugio
      WHERE ${condiciones.join(' AND ')}
      ORDER BY a.fecha_ingreso DESC`, params);
    return res.json({exito:true,total:animales.length,animales});
  } catch (err) {
    console.error('[listarAnimales]', err.message);
    return res.status(500).json({exito:false,mensaje:'Error al obtener animales.'});
  }
}

/* GET /api/mis-animales — animales de los refugios del usuario */
async function listarMisAnimales(req, res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({exito:false,mensaje:'No autenticado.'});
    const animales = await allAsync(`
      SELECT a.*, r.nombre_refugio
      FROM ANIMAL a JOIN REFUGIO r ON a.id_refugio=r.id_refugio
      WHERE r.id_usuario = ?
      ORDER BY a.id_animal DESC`, [sesion.id_usuario]);
    return res.json({exito:true,total:animales.length,animales});
  } catch (err) {
    return res.status(500).json({exito:false,mensaje:'Error al obtener tus animales.'});
  }
}

/* GET /api/mis-animales/:id — un animal propio */
async function obtenerAnimalPropio(req,res){
  try{
    const sesion=await obtenerSesion(req); if(!sesion) return res.status(401).json({exito:false,mensaje:'No autenticado.'});
    const id=Number(req.params.id); if(!id) return res.status(400).json({exito:false,mensaje:'ID de animal inválido.'});
    const animal=await getAsync(`SELECT a.*,r.nombre_refugio FROM ANIMAL a JOIN REFUGIO r ON r.id_refugio=a.id_refugio WHERE a.id_animal=? AND r.id_usuario=?`,[id,sesion.id_usuario]);
    if(!animal) return res.status(404).json({exito:false,mensaje:'Animal no encontrado o no pertenece a tus refugios.'});
    return res.json({exito:true,animal});
  }catch(e){console.error('[obtenerAnimalPropio]',e.message);return res.status(500).json({exito:false,mensaje:'Error al obtener el animal.'});}
}

/* PUT /api/mis-animales/:id — editar un perro propio */
async function actualizarAnimal(req,res){
  try{
    const sesion=await obtenerSesion(req); if(!sesion) return res.status(401).json({exito:false,errores:{_global:'No autenticado.'}});
    const id=Number(req.params.id); if(!id) return res.status(400).json({exito:false,errores:{_global:'ID de animal inválido.'}});
    const datos={...req.body,id_animal:id};
    const actual=await getAsync(`SELECT a.id_refugio,r.nombre_refugio FROM ANIMAL a JOIN REFUGIO r ON r.id_refugio=a.id_refugio WHERE a.id_animal=? AND r.id_usuario=?`,[id,sesion.id_usuario]);
    if(!actual) return res.status(404).json({exito:false,errores:{_global:'Animal no encontrado o no pertenece a tus refugios.'}});
    datos.id_refugio=actual.id_refugio;
    const estadoActual=await getAsync(`SELECT estado_adopcion FROM ANIMAL WHERE id_animal=?`,[id]);
    if(estadoActual?.estado_adopcion==='adoptado') return res.status(409).json({exito:false,errores:{_global:'Este perro ya fue adoptado y sus datos ya no pueden modificarse.'}});
    const validacion=validarAnimal({...datos,especie:'perro'}); if(!validacion.valido) return res.status(400).json({exito:false,errores:validacion.errores});
    const refugio=actual;
    const animal=await getAsync(`SELECT id_animal FROM ANIMAL WHERE id_animal=? AND id_refugio=?`,[id,actual.id_refugio]);
    if(!refugio||!animal) return res.status(403).json({exito:false,errores:{_global:'No tienes permiso para editar este perro.'}});
    await runAsync(`UPDATE ANIMAL SET id_refugio=?,nombre=?,especie='perro',raza=?,sexo=?,edad=?,tamano=?,color=?,descripcion=?,estado_salud=?,fotos_urls=?,fecha_actualizacion=datetime('now','localtime') WHERE id_animal=?`,[Number(datos.id_refugio),datos.nombre.trim(),datos.raza?.trim()||null,datos.sexo||'no_determinado',datos.edad?.trim()||null,datos.tamano||null,datos.color?.trim()||null,datos.descripcion.trim(),datos.estado_salud||'estable',fotosJson(datos.fotos_urls),id]);
    const actualizado=await getAsync(`SELECT a.*,r.nombre_refugio FROM ANIMAL a JOIN REFUGIO r ON r.id_refugio=a.id_refugio WHERE a.id_animal=?`,[id]);
    return res.json({exito:true,mensaje:'Datos del perro actualizados correctamente.',animal:actualizado});
  }catch(e){console.error('[actualizarAnimal]',e.message);return res.status(500).json({exito:false,errores:{_global:'Error interno al actualizar el perro.'}});}
}

/* POST /api/adopciones */
async function solicitarAdopcion(req, res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({exito:false,errores:{_global:'Debes iniciar sesión para solicitar una adopción.'}});
    if (sesion.rol !== 'adoptante') return res.status(403).json({exito:false,errores:{_global:'Las solicitudes de adopción están disponibles para cuentas adoptantes.'}});
    const idAnimal = Number(req.body.id_animal);
    const mensaje = (req.body.mensaje || '').trim();

    if (!idAnimal) return res.status(400).json({exito:false,errores:{id_animal:'Animal inválido.'}});
    if (mensaje.length > 500) return res.status(400).json({exito:false,errores:{mensaje:'El mensaje no puede superar 500 caracteres.'}});

    const animal = await getAsync(
      `SELECT id_animal,nombre,estado_adopcion,id_refugio FROM ANIMAL WHERE id_animal=?`,
      [idAnimal]
    );
    if (!animal) return res.status(404).json({exito:false,errores:{_global:'Animal no encontrado.'}});

    // Un refugio no puede solicitar la adopción de un perro que pertenece
    // a cualquiera de sus propios refugios.
    const propietario = await getAsync(`
      SELECT r.id_usuario AS id_propietario
      FROM REFUGIO r
      WHERE r.id_refugio = ?`, [animal.id_refugio]);
    if (propietario && Number(propietario.id_propietario) === Number(sesion.id_usuario)) {
      return res.status(403).json({exito:false,errores:{_global:'No puedes solicitar la adopción de un perro que pertenece a tu propio refugio.'}});
    }

    if (!['disponible','en_proceso'].includes(animal.estado_adopcion))
      return res.status(409).json({exito:false,errores:{_global:'Este animal ya no está disponible para adopción.'}});

    const existente = await getAsync(`
      SELECT id_adopcion FROM ADOPCION
      WHERE id_animal=? AND id_usuario=? AND estado IN ('pendiente','aprobada')`,
      [idAnimal, sesion.id_usuario]
    );
    if (existente) return res.status(409).json({exito:false,errores:{_global:'Ya tienes una solicitud activa para este animal.'}});

    const {lastID} = await runAsync(`
      INSERT INTO ADOPCION (id_animal,id_usuario,estado,mensaje)
      VALUES (?,?,'pendiente',?)`, [idAnimal,sesion.id_usuario,mensaje || null]);
    await runAsync(`INSERT INTO ADOPCION_MENSAJE (id_adopcion,id_usuario,mensaje) VALUES (?,?,?)`,[lastID,sesion.id_usuario,mensaje || 'Solicitud de adopción enviada. Quedo atento al proceso y a la respuesta del refugio.']);

    // El animal queda en proceso mientras el refugio revisa la solicitud.
    await runAsync(`UPDATE ANIMAL SET estado_adopcion='en_proceso', fecha_actualizacion=datetime('now','localtime') WHERE id_animal=?`, [idAnimal]);

    const adopcion = await getAsync(`
      SELECT ad.id_adopcion,ad.estado,ad.mensaje,ad.fecha_solicitud,
             a.id_animal,a.nombre AS animal,r.nombre_refugio
      FROM ADOPCION ad
      JOIN ANIMAL a ON ad.id_animal=a.id_animal
      JOIN REFUGIO r ON a.id_refugio=r.id_refugio
      WHERE ad.id_adopcion=?`, [lastID]);

    const verificada = await getAsync(`SELECT id_adopcion,id_usuario,id_animal,estado FROM ADOPCION WHERE id_adopcion=? AND id_usuario=?`, [lastID, sesion.id_usuario]);
    if (!verificada) throw new Error('La solicitud se insertó pero no pudo verificarse para el usuario actual.');
    return res.status(201).json({exito:true,mensaje:'Solicitud de adopción enviada correctamente.',adopcion:{...adopcion,id_usuario:sesion.id_usuario}});
  } catch (err) {
    console.error('[solicitarAdopcion]', err.message);
    return res.status(500).json({exito:false,errores:{_global:'Error interno al solicitar la adopción.'}});
  }
}

/* GET /api/mis-adopciones */
async function listarMisAdopciones(req,res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({exito:false,mensaje:'No autenticado.'});

    // La sección es independiente del listado de animales: se consulta
    // directamente por el usuario dueño de la solicitud.
    const adopciones = await allAsync(`
      SELECT
        ad.id_adopcion,
        ad.id_usuario AS id_adoptante,
        ad.id_animal,
        ad.estado,
        ad.mensaje,
        ad.fecha_solicitud,
        ad.fecha_respuesta,
        ad.fecha_completada,
        a.nombre AS animal,
        a.especie,
        a.fotos_urls,
        a.estado_adopcion,
        r.id_refugio,
        r.nombre_refugio,
        r.telefono AS telefono_refugio,
        r.localidad AS localidad_refugio,
        (SELECT m.mensaje
           FROM ADOPCION_MENSAJE m
          WHERE m.id_adopcion=ad.id_adopcion
          ORDER BY m.id_mensaje DESC LIMIT 1) AS ultimo_mensaje,
        (SELECT COUNT(*)
           FROM ADOPCION_MENSAJE m2
          WHERE m2.id_adopcion=ad.id_adopcion) AS total_mensajes
      FROM ADOPCION ad
      LEFT JOIN ANIMAL a ON a.id_animal=ad.id_animal
      LEFT JOIN REFUGIO r ON r.id_refugio=a.id_refugio
      WHERE ad.id_usuario=?
      ORDER BY ad.id_adopcion DESC`, [sesion.id_usuario]);

    return res.json({
      exito:true,
      id_usuario:sesion.id_usuario,
      usuario:{nombre:sesion.nombre,apellido:sesion.apellido,correo:sesion.correo},
      total:adopciones.length,
      adopciones
    });
  } catch(err) {
    console.error('[listarMisAdopciones]',err);
    return res.status(500).json({exito:false,mensaje:'Error al obtener tus solicitudes.'});
  }
}

/* PATCH /api/adopciones/:id/estado — propietario del refugio decide */
async function actualizarEstadoAdopcion(req,res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({exito:false,mensaje:'No autenticado.'});
    const idAdopcion = Number(req.params.id);
    const nuevoEstado = req.body.estado;
    if (!['aprobada','rechazada','completada','cancelada'].includes(nuevoEstado))
      return res.status(400).json({exito:false,mensaje:'Estado de adopción no válido.'});

    const adopcion = await getAsync(`
      SELECT ad.id_adopcion,ad.id_animal,a.nombre,a.id_refugio,r.id_usuario AS propietario
      FROM ADOPCION ad JOIN ANIMAL a ON ad.id_animal=a.id_animal
      JOIN REFUGIO r ON a.id_refugio=r.id_refugio
      WHERE ad.id_adopcion=?`, [idAdopcion]);
    if (!adopcion) return res.status(404).json({exito:false,mensaje:'Solicitud no encontrada.'});
    if (adopcion.propietario !== sesion.id_usuario)
      return res.status(403).json({exito:false,mensaje:'No tienes permiso para gestionar esta solicitud.'});

    await runAsync(`UPDATE ADOPCION SET estado=?,fecha_respuesta=datetime('now','localtime'),fecha_completada=CASE WHEN ?='completada' THEN datetime('now','localtime') ELSE fecha_completada END WHERE id_adopcion=?`,
      [nuevoEstado,nuevoEstado,idAdopcion]);
    await runAsync(`INSERT INTO ADOPCION_MENSAJE (id_adopcion,id_usuario,mensaje) VALUES (?,?,?)`,[idAdopcion,sesion.id_usuario,`El refugio cambió el estado de la solicitud a: ${nuevoEstado}.`]);

    if (nuevoEstado === 'aprobada' || nuevoEstado === 'completada') {
      await runAsync(`UPDATE ANIMAL SET estado_adopcion=?,fecha_actualizacion=datetime('now','localtime') WHERE id_animal=?`,
        [nuevoEstado === 'completada' ? 'adoptado' : 'en_proceso', adopcion.id_animal]);
      if (nuevoEstado === 'completada') {
        await runAsync(`UPDATE REFUGIO SET capacidad_actual=CASE WHEN COALESCE(capacidad_actual,0)>0 THEN capacidad_actual-1 ELSE 0 END WHERE id_refugio=?`, [adopcion.id_refugio]);
      }
    } else if (nuevoEstado === 'rechazada' || nuevoEstado === 'cancelada') {
      const pendientes = await getAsync(`
        SELECT id_adopcion FROM ADOPCION
        WHERE id_animal=? AND estado='pendiente' AND id_adopcion<>?`,
        [adopcion.id_animal,idAdopcion]);
      if (pendientes) {
        await runAsync(`UPDATE ANIMAL SET estado_adopcion='en_proceso',fecha_actualizacion=datetime('now','localtime') WHERE id_animal=?`, [adopcion.id_animal]);
      } else {
        await runAsync(`UPDATE ANIMAL SET estado_adopcion='disponible',fecha_actualizacion=datetime('now','localtime') WHERE id_animal=?`, [adopcion.id_animal]);
      }
    }
    return res.json({exito:true,mensaje:'Estado de solicitud actualizado.'});
  } catch(err) {
    console.error('[actualizarEstadoAdopcion]',err.message);
    return res.status(500).json({exito:false,mensaje:'Error interno al actualizar la solicitud.'});
  }
}


/* GET /api/refugio/adopciones — solicitudes de adopción de los animales del refugio */
async function listarAdopcionesRefugio(req,res) {
  try {
    const sesion = await obtenerSesion(req);
    if (!sesion) return res.status(401).json({exito:false,mensaje:'No autenticado.'});

    // Se comprueba la existencia real de refugios aprobados del usuario.
    const tieneRefugio = await getAsync(`
      SELECT 1 AS ok FROM REFUGIO WHERE id_usuario=? LIMIT 1`, [sesion.id_usuario]);
    if (!tieneRefugio) return res.status(403).json({exito:false,mensaje:'Solo los perfiles de refugio pueden gestionar solicitudes.'});

    const adopciones = await allAsync(`
      SELECT ad.id_adopcion, ad.estado, ad.mensaje, ad.fecha_solicitud, ad.fecha_respuesta,
             a.id_animal, a.nombre AS animal, a.especie, a.estado_adopcion,
             r.id_refugio, r.nombre_refugio,
             u.id_usuario AS id_adoptante, u.nombre AS adoptante_nombre,
             u.apellido AS adoptante_apellido, u.correo AS adoptante_correo
      FROM ADOPCION ad
      JOIN ANIMAL a ON a.id_animal=ad.id_animal
      JOIN REFUGIO r ON r.id_refugio=a.id_refugio
      JOIN USUARIO u ON u.id_usuario=ad.id_usuario
      WHERE r.id_usuario=?
      ORDER BY CASE ad.estado WHEN 'pendiente' THEN 0 WHEN 'aprobada' THEN 1 ELSE 2 END,
               ad.fecha_solicitud DESC`, [sesion.id_usuario]);
    return res.json({exito:true,total:adopciones.length,adopciones});
  } catch(err) {
    console.error('[listarAdopcionesRefugio]',err.message);
    return res.status(500).json({exito:false,mensaje:'Error al obtener las solicitudes de adopción.'});
  }
}

async function verificarAccesoAdopcion(idAdopcion, sesion){
  return getAsync(`SELECT ad.id_adopcion,ad.id_usuario AS id_adoptante,ad.id_animal,
    r.id_usuario AS id_refugio_usuario,COALESCE(r.nombre_refugio,'Refugio') AS nombre_refugio,
    COALESCE(a.nombre,'Perro') AS animal
    FROM ADOPCION ad
    LEFT JOIN ANIMAL a ON a.id_animal=ad.id_animal
    LEFT JOIN REFUGIO r ON r.id_refugio=a.id_refugio
    WHERE ad.id_adopcion=? AND (ad.id_usuario=? OR r.id_usuario=?)`,
    [idAdopcion,sesion.id_usuario,sesion.id_usuario]);
}
async function listarMensajesAdopcion(req,res){ try{const sesion=await obtenerSesion(req);if(!sesion)return res.status(401).json({exito:false,mensaje:'No autenticado.'});const id=Number(req.params.id);const a=await verificarAccesoAdopcion(id,sesion);if(!a)return res.status(403).json({exito:false,mensaje:'No tienes acceso a esta conversación.'});const mensajes=await allAsync(`SELECT m.id_mensaje,m.mensaje,m.fecha,m.id_usuario,u.nombre,u.apellido FROM ADOPCION_MENSAJE m JOIN USUARIO u ON u.id_usuario=m.id_usuario WHERE m.id_adopcion=? ORDER BY m.id_mensaje ASC`,[id]);return res.json({exito:true,adopcion:a,mensajes});}catch(e){console.error('[listarMensajesAdopcion]',e.message);return res.status(500).json({exito:false,mensaje:'No se pudo cargar la conversación.'});}}
async function enviarMensajeAdopcion(req,res){ try{const sesion=await obtenerSesion(req);if(!sesion)return res.status(401).json({exito:false,mensaje:'No autenticado.'});const id=Number(req.params.id),texto=String(req.body.mensaje||'').trim();if(!texto)return res.status(400).json({exito:false,mensaje:'Escribe un mensaje.'});if(texto.length>1000)return res.status(400).json({exito:false,mensaje:'El mensaje no puede superar 1000 caracteres.'});const a=await verificarAccesoAdopcion(id,sesion);if(!a)return res.status(403).json({exito:false,mensaje:'No tienes acceso a esta conversación.'});await runAsync(`INSERT INTO ADOPCION_MENSAJE (id_adopcion,id_usuario,mensaje) VALUES (?,?,?)`,[id,sesion.id_usuario,texto]);return res.status(201).json({exito:true,mensaje:'Mensaje enviado.'});}catch(e){console.error('[enviarMensajeAdopcion]',e.message);return res.status(500).json({exito:false,mensaje:'No se pudo enviar el mensaje.'});}}

module.exports = {
  registrarAnimal, listarAnimales, listarMisAnimales, obtenerAnimalPropio, actualizarAnimal,
  solicitarAdopcion, listarMisAdopciones, actualizarEstadoAdopcion, listarAdopcionesRefugio, listarMensajesAdopcion, enviarMensajeAdopcion
};
