'use strict';
const bcrypt=require('bcryptjs');
const { iniciarDB,getAsync,runAsync }=require('./db');

async function main(){
  const [, , nombre='Administrador', apellido='General', correo, contrasena]=process.argv;
  if(!correo||!contrasena){
    console.log('Uso: node crear-admin.js "Nombre" "Apellido" "correo@ejemplo.com" "ContraseñaSegura123"');
    process.exit(1);
  }
  if(String(contrasena).length<8){console.log('La contraseña debe tener mínimo 8 caracteres.');process.exit(1);}
  await iniciarDB();
  const existe=await getAsync('SELECT id_usuario FROM USUARIO WHERE LOWER(correo)=LOWER(?)',[correo.trim()]);
  const hash=await bcrypt.hash(contrasena,Number(process.env.BCRYPT_ROUNDS||10));
  if(existe){
    await runAsync(`UPDATE USUARIO SET nombre=?,apellido=?,contrasena_hash=?,rol='administrador',estado_refugio='aprobada',email_verificado=1,activo=1 WHERE id_usuario=?`,[nombre.trim(),apellido.trim(),hash,existe.id_usuario]);
    console.log('Cuenta de administrador actualizada:',correo);
  }else{
    await runAsync(`INSERT INTO USUARIO(nombre,apellido,correo,contrasena_hash,ubicacion,rol,estado_refugio,email_verificado,activo) VALUES(?,?,?,?,?,?,?,?,1)`,[nombre.trim(),apellido.trim(),correo.trim().toLowerCase(),hash,'Bogotá','administrador','aprobada',1]);
    console.log('Cuenta de administrador creada:',correo);
  }
}
main().catch(e=>{console.error('No se pudo crear el administrador:',e);process.exit(1);});
