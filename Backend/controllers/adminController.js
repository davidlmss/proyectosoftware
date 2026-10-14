'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { enviarCorreoVerificacion } = require('../emailService');
const { getAsync, allAsync, runAsync } = require('../db');
const { localidadValida } = require('../localidadesBogota');
const { sesion } = require('./rolesController');

async function administrador(req,res){
  const u=await sesion(req);
  if(!u) return {ok:false,respuesta:res.status(401).json({exito:false,mensaje:'Sesión inválida o expirada.'})};
  if(u.rol!=='administrador') return {ok:false,respuesta:res.status(403).json({exito:false,mensaje:'Solo un administrador puede realizar esta operación.'})};
  return {ok:true,usuario:u};
}

async function listarUsuarios(req,res){
  const a=await administrador(req,res); if(!a.ok)return;
  const usuarios=await allAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,email_verificado,fecha_registro FROM USUARIO ORDER BY id_usuario DESC`);
  res.json({exito:true,usuarios});
}

async function crearUsuario(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const d=req.body||{}; const errores={};
    if(!d.nombre||String(d.nombre).trim().length<2) errores.nombre='Nombre requerido.';
    if(!d.apellido||String(d.apellido).trim().length<2) errores.apellido='Apellido requerido.';
    if(!d.correo||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.correo))) errores.correo='Correo válido requerido.';
    if(!d.contrasena||String(d.contrasena).length<8) errores.contrasena='Contraseña de mínimo 8 caracteres requerida.';
    if(!['adoptante','administrador'].includes(d.rol)) errores.rol='Para crear un usuario nuevo desde administración usa Adoptante o Administrador. El rol Refugio se obtiene mediante aprobación.';
    if(d.ubicacion && !localidadValida(d.ubicacion)) errores.ubicacion='Selecciona una localidad válida de Bogotá.';
    if(Object.keys(errores).length)return res.status(400).json({exito:false,errores});
    const existe=await getAsync(`SELECT id_usuario FROM USUARIO WHERE LOWER(correo)=LOWER(?)`,[String(d.correo).trim()]);
    if(existe)return res.status(409).json({exito:false,errores:{correo:'Ese correo ya está registrado.'}});
    const hash=await bcrypt.hash(String(d.contrasena),Number(process.env.BCRYPT_ROUNDS||10));
    const estado=d.rol==='administrador'?'aprobada':'ninguna';
    const {lastID}=await runAsync(`INSERT INTO USUARIO(nombre,apellido,correo,contrasena_hash,ubicacion,rol,estado_refugio,email_verificado,activo) VALUES(?,?,?,?,?,?,?,?,1)`,[String(d.nombre).trim(),String(d.apellido).trim(),String(d.correo).toLowerCase().trim(),hash,String(d.ubicacion||'').trim(),d.rol,estado,1]);
    const usuario=await getAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,email_verificado,fecha_registro FROM USUARIO WHERE id_usuario=?`,[lastID]);
    res.status(201).json({exito:true,mensaje:'Usuario creado correctamente.',usuario});
  }catch(e){console.error('[admin.crearUsuario]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo crear el usuario.'});}
}

async function actualizarUsuario(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const id=Number(req.params.id); if(!id)return res.status(400).json({exito:false,mensaje:'ID de usuario inválido.'});
    const existente=await getAsync(`SELECT * FROM USUARIO WHERE id_usuario=?`,[id]);
    if(!existente)return res.status(404).json({exito:false,mensaje:'Usuario no encontrado.'});
    if(id===a.usuario.id_usuario && req.body.activo===0)return res.status(400).json({exito:false,mensaje:'No puedes desactivar tu propia cuenta de administrador.'});
    const d=req.body||{}; const rol=d.rol||existente.rol;
    if(!['adoptante','refugio','administrador'].includes(rol))return res.status(400).json({exito:false,mensaje:'Rol no válido.'});
    const localidad=String(d.ubicacion ?? existente.ubicacion ?? '').trim().toLowerCase();
    if(localidad && !localidadValida(localidad))return res.status(400).json({exito:false,mensaje:'Selecciona una localidad válida de Bogotá.'});
    const correo=String(d.correo||existente.correo).trim().toLowerCase();
    const otro=await getAsync(`SELECT id_usuario FROM USUARIO WHERE LOWER(correo)=LOWER(?) AND id_usuario<>?`,[correo,id]);
    if(otro)return res.status(409).json({exito:false,mensaje:'Ese correo ya pertenece a otro usuario.'});
    let sql=`UPDATE USUARIO SET nombre=?,apellido=?,correo=?,ubicacion=?,rol=?,estado_refugio=?,activo=?`;
    const params=[String(d.nombre??existente.nombre).trim(),String(d.apellido??existente.apellido).trim(),correo,localidad,rol,rol==='refugio'?'aprobada':(rol==='administrador'?'aprobada':(d.estado_refugio||existente.estado_refugio||'ninguna')),d.activo===undefined?Number(existente.activo):Number(d.activo)?1:0];
    if(d.contrasena){ if(String(d.contrasena).length<8)return res.status(400).json({exito:false,mensaje:'La contraseña debe tener mínimo 8 caracteres.'}); sql+=`,contrasena_hash=?`; params.push(await bcrypt.hash(String(d.contrasena),Number(process.env.BCRYPT_ROUNDS||10))); }
    sql+=` WHERE id_usuario=?`; params.push(id); await runAsync(sql,params);
    const usuario=await getAsync(`SELECT id_usuario,nombre,apellido,correo,ubicacion,rol,estado_refugio,activo,email_verificado,fecha_registro FROM USUARIO WHERE id_usuario=?`,[id]);
    res.json({exito:true,mensaje:'Usuario actualizado correctamente.',usuario});
  }catch(e){console.error('[admin.actualizarUsuario]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo actualizar el usuario.'});}
}

async function eliminarUsuario(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const id=Number(req.params.id); if(!id)return res.status(400).json({exito:false,mensaje:'ID inválido.'});
    if(id===a.usuario.id_usuario)return res.status(400).json({exito:false,mensaje:'No puedes eliminar tu propia cuenta.'});
    const u=await getAsync(`SELECT id_usuario FROM USUARIO WHERE id_usuario=?`,[id]); if(!u)return res.status(404).json({exito:false,mensaje:'Usuario no encontrado.'});
    await runAsync(`UPDATE USUARIO SET activo=0 WHERE id_usuario=?`,[id]);
    await runAsync(`DELETE FROM SESION WHERE id_usuario=?`,[id]);
    res.json({exito:true,mensaje:'Usuario desactivado correctamente.'});
  }catch(e){console.error('[admin.eliminarUsuario]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo desactivar el usuario.'});}
}

async function reenviarVerificacion(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const id=Number(req.params.id);
    if(!id) return res.status(400).json({exito:false,mensaje:'ID de usuario inválido.'});

    const u=await getAsync(`SELECT id_usuario,nombre,apellido,correo,activo,email_verificado FROM USUARIO WHERE id_usuario=?`,[id]);
    if(!u) return res.status(404).json({exito:false,mensaje:'Usuario no encontrado.'});
    if(!u.activo) return res.status(400).json({exito:false,mensaje:'No se puede enviar el correo porque la cuenta está desactivada.'});
    if(Number(u.email_verificado)===1) return res.status(400).json({exito:false,mensaje:'Este usuario ya confirmó su correo electrónico.'});

    const token=crypto.randomBytes(48).toString('hex');
    const expira=new Date();
    expira.setHours(expira.getHours()+24);

    await runAsync(`UPDATE USUARIO SET token_verificacion_email=?, token_verificacion_expira=? WHERE id_usuario=?`,[token,expira.toISOString(),id]);

    try{
      await enviarCorreoVerificacion({
        nombre:u.nombre,
        correo:u.correo,
        token,
        baseUrl:`${req.protocol}://${req.get('host')}`
      });
    }catch(correoErr){
      // No dejamos un token nuevo si el correo no pudo enviarse.
      await runAsync(`UPDATE USUARIO SET token_verificacion_email=NULL, token_verificacion_expira=NULL WHERE id_usuario=?`,[id]);
      console.error('[admin.reenviarVerificacion]',correoErr.message);
      return res.status(503).json({exito:false,mensaje:correoErr.message||'No se pudo enviar el correo de verificación.'});
    }

    res.json({exito:true,mensaje:`Correo de verificación reenviado a ${u.correo}. El enlace será válido durante 24 horas.`});
  }catch(e){
    console.error('[admin.reenviarVerificacion]',e.message);
    res.status(500).json({exito:false,mensaje:'No se pudo reenviar el correo de verificación.'});
  }
}

async function listarRefugios(req,res){
  const a=await administrador(req,res); if(!a.ok)return;
  const refugios=await allAsync(`SELECT r.*,u.nombre||' '||u.apellido AS responsable_usuario,u.correo AS correo_usuario, COALESCE((SELECT COUNT(*) FROM ANIMAL a WHERE a.id_refugio=r.id_refugio AND COALESCE(a.estado_adopcion,'disponible')<>'adoptado'),0) AS capacidad_actual FROM REFUGIO r JOIN USUARIO u ON u.id_usuario=r.id_usuario ORDER BY r.id_refugio DESC`);
  res.json({exito:true,refugios});
}


async function crearRefugio(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const d=req.body||{}; const errores={};
    if(!d.id_usuario||!Number(d.id_usuario))errores.id_usuario='Selecciona un usuario propietario.';
    if(!d.nombre_refugio||String(d.nombre_refugio).trim().length<3)errores.nombre_refugio='Nombre requerido.';
    if(!d.direccion||String(d.direccion).trim().length<5)errores.direccion='Dirección requerida.';
    if(!d.descripcion||String(d.descripcion).trim().length<10)errores.descripcion='Descripción requerida.';
    if(!d.capacidad||Number(d.capacidad)<1)errores.capacidad='Capacidad mayor a 0 requerida.';
    if(!d.localidad)errores.localidad='Localidad requerida.';
    else if(!localidadValida(d.localidad))errores.localidad='Selecciona una localidad válida de Bogotá.';
    if(Object.keys(errores).length)return res.status(400).json({exito:false,errores});
    const u=await getAsync(`SELECT id_usuario FROM USUARIO WHERE id_usuario=?`,[Number(d.id_usuario)]);if(!u)return res.status(404).json({exito:false,mensaje:'Usuario propietario no encontrado.'});
    const permisos=Array.isArray(d.permisos_autorizaciones)?JSON.stringify(d.permisos_autorizaciones):JSON.stringify([]);
    const {lastID}=await runAsync(`INSERT INTO REFUGIO(nombre_refugio,direccion,descripcion,capacidad,localidad,id_usuario,telefono,logo_url,tipo,estado,responsable_nombre,responsable_correo,responsable_telefono,capacidad_actual,permisos_autorizaciones,instagram,facebook,tiktok,x_social,youtube,whatsapp) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[String(d.nombre_refugio).trim(),String(d.direccion).trim(),String(d.descripcion).trim(),Number(d.capacidad),String(d.localidad).trim(),Number(d.id_usuario),String(d.telefono||'').trim(),String(d.logo_url||'').trim(),'perros','aprobada',String(d.responsable_nombre||'').trim(),String(d.responsable_correo||'').trim(),String(d.responsable_telefono||'').trim(),0,permisos,String(d.instagram||''),String(d.facebook||''),String(d.tiktok||''),String(d.x_social||''),String(d.youtube||''),String(d.whatsapp||'')]);
    await runAsync(`UPDATE USUARIO SET rol='refugio',estado_refugio='aprobada' WHERE id_usuario=?`,[Number(d.id_usuario)]);
    res.status(201).json({exito:true,mensaje:'Refugio creado correctamente.',id_refugio:lastID});
  }catch(e){console.error('[admin.crearRefugio]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo crear el refugio.'});}
}

async function actualizarRefugioAdmin(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const id=Number(req.params.id); const r=await getAsync(`SELECT * FROM REFUGIO WHERE id_refugio=?`,[id]);
    if(!r)return res.status(404).json({exito:false,mensaje:'Refugio no encontrado.'});
    const d=req.body||{};
    const localidad=String(d.localidad??r.localidad??'').trim().toLowerCase();
    if(!localidadValida(localidad)) return res.status(400).json({exito:false,mensaje:'Selecciona una localidad válida de Bogotá.'});
    await runAsync(`UPDATE REFUGIO SET nombre_refugio=?,direccion=?,descripcion=?,capacidad=?,localidad=?,telefono=?,estado=?,responsable_nombre=?,responsable_correo=?,responsable_telefono=?,permisos_autorizaciones=?,instagram=?,facebook=?,tiktok=?,x_social=?,youtube=?,whatsapp=? WHERE id_refugio=?`,[
      String(d.nombre_refugio??r.nombre_refugio).trim(),String(d.direccion??r.direccion).trim(),String(d.descripcion??r.descripcion).trim(),d.capacidad===''?null:Number(d.capacidad??r.capacidad),localidad,String(d.telefono??r.telefono??'').trim(),['aprobada','pendiente','rechazada'].includes(d.estado)?d.estado:r.estado,String(d.responsable_nombre??r.responsable_nombre??'').trim(),String(d.responsable_correo??r.responsable_correo??'').trim(),String(d.responsable_telefono??r.responsable_telefono??'').trim(),String(d.permisos_autorizaciones??r.permisos_autorizaciones??''),String(d.instagram??r.instagram??''),String(d.facebook??r.facebook??''),String(d.tiktok??r.tiktok??''),String(d.x_social??r.x_social??''),String(d.youtube??r.youtube??''),String(d.whatsapp??r.whatsapp??''),id]);
    res.json({exito:true,mensaje:'Refugio actualizado correctamente.'});
  }catch(e){console.error('[admin.actualizarRefugio]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo actualizar el refugio.'});}
}

async function eliminarRefugio(req,res){
  try{
    const a=await administrador(req,res); if(!a.ok)return;
    const id=Number(req.params.id); const r=await getAsync(`SELECT id_refugio,id_usuario FROM REFUGIO WHERE id_refugio=?`,[id]);
    if(!r)return res.status(404).json({exito:false,mensaje:'Refugio no encontrado.'});
    await runAsync(`DELETE FROM REFUGIO WHERE id_refugio=?`,[id]);
    await runAsync(`UPDATE USUARIO SET rol='adoptante',estado_refugio='ninguna' WHERE id_usuario=? AND rol='refugio'`,[r.id_usuario]);
    res.json({exito:true,mensaje:'Refugio eliminado correctamente.'});
  }catch(e){console.error('[admin.eliminarRefugio]',e.message);res.status(500).json({exito:false,mensaje:'No se pudo eliminar el refugio.'});}
}

module.exports={listarUsuarios,crearUsuario,actualizarUsuario,eliminarUsuario,reenviarVerificacion,listarRefugios,crearRefugio,actualizarRefugioAdmin,eliminarRefugio};
