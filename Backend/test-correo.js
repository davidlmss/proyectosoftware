/**
 * Prueba rápida del correo de confirmación.
 * Ejecutar desde Backend:
 *   node test-correo.js correo_destino@ejemplo.com
 */
require('dotenv').config();
const crypto = require('crypto');
const { enviarCorreoVerificacion } = require('./emailService');

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node test-correo.js correo_destino@ejemplo.com');
  process.exit(1);
}

(async () => {
  try {
    const resultado = await enviarCorreoVerificacion({
      nombre: 'Prueba',
      correo: destino,
      token: crypto.randomBytes(48).toString('hex'),
      baseUrl: `${process.env.PUBLIC_URL || 'http://localhost:3000'}`
    });
    console.log('Correo enviado correctamente.');
    console.log('URL de verificación:', resultado.enlaceVerificacion);
  } catch (err) {
    console.error('ERROR DE CORREO:', err.message);
    process.exit(1);
  }
})();
