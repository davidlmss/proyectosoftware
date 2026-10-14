'use strict';
const { getAsync, allAsync, runAsync } = require('../db');

async function sesion(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  if (!token) return null;
  const u = await getAsync(`SELECT s.id_usuario,u.nombre,u.apellido,u.correo,u.rol,u.estado_refugio
    FROM SESION s JOIN USUARIO u ON u.id_usuario=s.id_usuario
    WHERE s.token_sesion=? AND datetime(s.fecha_expiracion) > datetime('now','localtime') AND u.activo=1`, [token]);
  return u || null;
}

function listaPermisos(valor) {
  if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
  try { const parsed = JSON.parse(valor || '[]'); if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean); } catch(e) {}
  return String(valor || '').split(',').map(x=>x.trim()).filter(Boolean);
}

async function solicitarRefugio(req,res){
  try {
    const u=await sesion(req);
    if(!u) return res.status(401).json({exito:false,mensaje:'Debes iniciar sesión.'});
    if(u.rol==='administrador') return res.status(403).json({exito:false,mensaje:'El administrador no requiere solicitud de refugio.'});
    if(u.estado_refugio==='pendiente') return res.status(409).json({exito:false,mensaje:'Ya tienes una solicitud de refugio pendiente.'});
    if(u.rol==='refugio' && u.estado_refugio==='aprobada') return res.status(409).json({exito:false,mensaje:'Tu perfil ya está aprobado como refugio.'});

    const d=req.body||{}, errores={};
    if(!d.nombre_refugio||String(d.nombre_refugio).trim().length<3) errores.nombre_refugio='Nombre del refugio requerido (mínimo 3 caracteres).';
    if(!d.direccion||String(d.direccion).trim().length<5) errores.direccion='Ingresa la dirección física del refugio.';
    if(!d.descripcion||String(d.descripcion).trim().length<10) errores.descripcion='Escribe una descripción (mínimo 10 caracteres).';
    if(!d.localidad) errores.localidad='Selecciona la localidad.';
    if(d.capacidad===''||d.capacidad===undefined||!Number.isFinite(Number(d.capacidad))||Number(d.capacidad)<1) errores.capacidad='Ingresa una capacidad mayor a 0.';
    if(!d.responsable_nombre||String(d.responsable_nombre).trim().length<3) errores.responsable_nombre='Ingresa el nombre del responsable.';
    if(!d.responsable_correo||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.responsable_correo))) errores.responsable_correo='Ingresa un correo válido del responsable.';
    if(!d.responsable_telefono||String(d.responsable_telefono).trim().length<7) errores.responsable_telefono='Ingresa el teléfono del responsable.';
    const permisos=listaPermisos(d.permisos_autorizaciones);
    if(!permisos.length) errores.permisos_autorizaciones='Selecciona al menos un permiso o autorización.';
    if(Object.keys(errores).length) return res.status(400).json({exito:false,errores});

    let trabajadores=Array.isArray(d.trabajadores)?d.trabajadores:[];
    trabajadores=trabajadores.filter(t=>t&&String(t.nombre||'').trim());
    for(const t of trabajadores){
      if(!t.correo||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t.correo))) return res.status(400).json({exito:false,errores:{trabajadores:'Cada integrante del Equipo Humano debe tener un correo válido.'}});
    }
    let documentos=Array.isArray(d.documentos)?d.documentos:[];
    for(const doc of documentos){
      if(!doc||!doc.nombre||!doc.tipo||!doc.data) return res.status(400).json({exito:false,errores:{permisos_autorizaciones:'Cada documento debe tener nombre y archivo.'}});
      if(String(doc.data).length>12*1024*1024) return res.status(400).json({exito:false,errores:{permisos_autorizaciones:'Cada documento supera el límite permitido.'}});
    }

    const {lastID}=await runAsync(`INSERT INTO SOLICITUD_REFUGIO
      (id_usuario,nombre_refugio,direccion,descripcion,capacidad,localidad,telefono,red_social,logo_url,tipo,responsable_nombre,responsable_correo,responsable_telefono,capacidad_actual,permisos_autorizaciones,instagram,facebook,tiktok,x_social,youtube,whatsapp,trabajadores_json,documentos_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
        u.id_usuario,String(d.nombre_refugio).trim(),String(d.direccion).trim(),String(d.descripcion).trim(),Number(d.capacidad),String(d.localidad).trim(),String(d.telefono||'').trim(),null,String(d.logo_url||'').trim(),'perros',String(d.responsable_nombre).trim(),String(d.responsable_correo).trim(),String(d.responsable_telefono).trim(),0,JSON.stringify(permisos),String(d.instagram||''),String(d.facebook||''),String(d.tiktok||''),String(d.x_social||''),String(d.youtube||''),String(d.whatsapp||''),JSON.stringify(trabajadores),JSON.stringify(documentos)
      ]);
    await runAsync(`UPDATE USUARIO SET estado_refugio='pendiente' WHERE id_usuario=?`,[u.id_usuario]);
    return res.status(201).json({exito:true,mensaje:'Solicitud enviada. Un administrador debe aprobarla antes de crear el refugio.',id_solicitud:lastID,estado:'pendiente'});
  }catch(e){console.error('[solicitarRefugio]',e);return res.status(500).json({exito:false,mensaje:'Error al enviar la solicitud.'});}
}

async function miSolicitud(req,res){
  const u=await sesion(req); if(!u)return res.status(401).json({exito:false,mensaje:'No autenticado.'});
  const s=await getAsync(`SELECT * FROM SOLICITUD_REFUGIO WHERE id_usuario=? ORDER BY id_solicitud DESC LIMIT 1`,[u.id_usuario]);
  if(s)s.permisos_autorizaciones=listaPermisos(s.permisos_autorizaciones);
  res.json({exito:true,solicitud:s||null,rol:u.rol,estado_refugio:u.estado_refugio});
}

async function listarSolicitudes(req,res){
  const u=await sesion(req); if(!u)return res.status(401).json({exito:false,mensaje:'No autenticado.'});
  if(u.rol!=='administrador')return res.status(403).json({exito:false,mensaje:'Solo Administración puede gestionar solicitudes.'});
  const rows=await allAsync(`SELECT s.*,u.nombre,u.apellido,u.correo FROM SOLICITUD_REFUGIO s JOIN USUARIO u ON u.id_usuario=s.id_usuario ORDER BY CASE s.estado WHEN 'pendiente' THEN 0 ELSE 1 END,s.fecha_solicitud DESC`);
  rows.forEach(r=>r.permisos_autorizaciones=listaPermisos(r.permisos_autorizaciones));
  res.json({exito:true,solicitudes:rows});
}

async function resolverSolicitud(req,res){
  try{
    const u=await sesion(req); if(!u)return res.status(401).json({exito:false,mensaje:'No autenticado.'});
    if(u.rol!=='administrador')return res.status(403).json({exito:false,mensaje:'Solo Administración puede aprobar solicitudes.'});
    const id=Number(req.params.id),estado=req.body.estado;
    if(!['aprobada','rechazada'].includes(estado))return res.status(400).json({exito:false,mensaje:'Estado inválido.'});
    const s=await getAsync(`SELECT * FROM SOLICITUD_REFUGIO WHERE id_solicitud=?`,[id]);
    if(!s)return res.status(404).json({exito:false,mensaje:'Solicitud no encontrada.'});
    if(s.estado!=='pendiente')return res.status(409).json({exito:false,mensaje:'La solicitud ya fue resuelta.'});
    const comentario=String(req.body.comentario_admin||'').trim()||null;
    await runAsync(`UPDATE SOLICITUD_REFUGIO SET estado=?,comentario_admin=?,fecha_respuesta=datetime('now','localtime') WHERE id_solicitud=?`,[estado,comentario,id]);
    if(estado==='aprobada'){
      await runAsync(`UPDATE USUARIO SET rol='refugio',estado_refugio='aprobada' WHERE id_usuario=?`,[s.id_usuario]);
      const {lastID}=await runAsync(`INSERT INTO REFUGIO
        (nombre_refugio,direccion,descripcion,capacidad,localidad,id_usuario,telefono,red_social,logo_url,tipo,estado,responsable_nombre,responsable_correo,responsable_telefono,capacidad_actual,permisos_autorizaciones,instagram,facebook,tiktok,x_social,youtube,whatsapp,documentos_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
          s.nombre_refugio,s.direccion,s.descripcion,s.capacidad,s.localidad,s.id_usuario,s.telefono,s.red_social,s.logo_url,'perros','aprobada',s.responsable_nombre,s.responsable_correo,s.responsable_telefono,0,s.permisos_autorizaciones,s.instagram,s.facebook,s.tiktok,s.x_social,s.youtube,s.whatsapp,s.documentos_json
        ]);
      let trabajadores=[];try{trabajadores=JSON.parse(s.trabajadores_json||'[]');}catch(e){trabajadores=[];}
      for(const t of trabajadores)if(t&&t.nombre&&t.correo)await runAsync(`INSERT INTO REFUGIO_TRABAJADOR(id_refugio,nombre,correo,telefono,cargo) VALUES(?,?,?,?,?)`,[lastID,String(t.nombre).trim(),String(t.correo).trim(),t.telefono||null,t.cargo||null]);
      return res.json({exito:true,mensaje:'Solicitud aprobada y refugio creado. Ahora los perros se registran desde la sección de animales.',id_refugio:lastID});
    }
    await runAsync(`UPDATE USUARIO SET rol='adoptante',estado_refugio='rechazada' WHERE id_usuario=?`,[s.id_usuario]);
    res.json({exito:true,mensaje:'Solicitud rechazada.'});
  }catch(e){console.error('[resolverSolicitud]',e);res.status(500).json({exito:false,mensaje:'Error al resolver la solicitud.'});}
}

async function listarUsuariosAdmin(req,res){
  const u=await sesion(req);if(!u)return res.status(401).json({exito:false,mensaje:'No autenticado.'});
  if(u.rol!=='administrador')return res.status(403).json({exito:false,mensaje:'Solo Administración.'});
  const rows=await allAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,fecha_registro FROM USUARIO ORDER BY id_usuario DESC`);
  res.json({exito:true,usuarios:rows});
}

module.exports={solicitarRefugio,miSolicitud,listarSolicitudes,resolverSolicitud,listarUsuariosAdmin,sesion,listaPermisos};
