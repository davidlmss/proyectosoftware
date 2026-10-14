/**
 * Servicio de correo para confirmación de cuentas.
 *
 * Gmail SMTP por TLS directo. Requiere en Backend/.env:
 *   EMAIL_USER=cuenta@gmail.com
 *   EMAIL_PASSWORD=contraseña_de_aplicación
 *
 * IMPORTANTE: EMAIL_PASSWORD NO es la contraseña normal de Gmail.
 * Debe ser una contraseña de aplicación generada en la cuenta de Google.
 */
require('dotenv').config();
const tls = require('tls');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function esConfiguracionPlaceholder(valor) {
  const v = String(valor || '').trim().toLowerCase();
  return !v || v.includes('tu_correo') || v.includes('tu_contraseña') || v.includes('tu_contrasena') || v.includes('aqui') || v.includes('aquí');
}

function respuestaCompleta(data) {
  const lineas = data.toString().split(/\r?\n/).filter(Boolean);
  if (!lineas.length) return false;
  return lineas.some(linea => /^\d{3} /.test(linea));
}

function codigoRespuesta(data) {
  const lineas = data.toString().split(/\r?\n/).filter(Boolean);
  const ultima = [...lineas].reverse().find(linea => /^\d{3} /.test(linea));
  return ultima ? Number(ultima.substring(0, 3)) : 0;
}

function enviarSMTP({ usuario, contrasena, remitente, destinatario, asunto, html }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: 'smtp.gmail.com',
      port: 465,
      servername: 'smtp.gmail.com',
      rejectUnauthorized: true
    });

    let buffer = '';
    let esperando = null;
    let cerrado = false;

    const cerrar = (error) => {
      if (cerrado) return;
      cerrado = true;
      esperando = null;
      try { socket.end(); } catch (_) {}
      if (error) reject(error); else resolve();
    };

    const procesar = () => {
      if (!esperando) return;
      if (!respuestaCompleta(buffer)) return;

      const respuesta = buffer;
      buffer = '';
      const actual = esperando;
      esperando = null;

      const codigo = codigoRespuesta(respuesta);
      if (codigo >= 400) {
        actual.reject(new Error(`SMTP ${codigo}: ${respuesta.trim()}`));
      } else {
        actual.resolve(respuesta);
      }
    };

    const comando = (texto) => {
      if (cerrado) return Promise.reject(new Error('Conexión SMTP cerrada.'));
      return new Promise((resolve, reject) => {
        esperando = { resolve, reject };
        socket.write(`${texto}\r\n`);
      });
    };

    socket.setEncoding('utf8');
    socket.on('data', chunk => {
      buffer += chunk;
      procesar();
    });
    socket.on('error', err => cerrar(err));
    socket.on('close', () => {
      if (!cerrado) cerrar(new Error('La conexión con Gmail se cerró inesperadamente.'));
    });

    (async () => {
      try {
        await new Promise((resolve, reject) => {
          const onReady = () => { socket.off('error', onError); resolve(); };
          const onError = err => { socket.off('secureConnect', onReady); reject(err); };
          socket.once('secureConnect', onReady);
          socket.once('error', onError);
        });

        buffer = '';
        await comando('EHLO localhost');
        await comando('AUTH LOGIN');
        await comando(Buffer.from(usuario).toString('base64'));
        await comando(Buffer.from(contrasena).toString('base64'));
        await comando(`MAIL FROM:<${remitente}>`);
        await comando(`RCPT TO:<${destinatario}>`);
        await comando('DATA');

        const mensaje = [
          `From: RefugiosBogotá <${remitente}>`,
          `To: ${destinatario}`,
          `Subject: =?UTF-8?B?${Buffer.from(asunto).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: 8bit',
          '',
          html.replace(/^\./gm, '..'),
          '.'
        ].join('\r\n');

        await comando(mensaje);
        await comando('QUIT');
        cerrar();
      } catch (err) {
        cerrar(err);
      }
    })();
  });
}

function obtenerUrlPublica(baseUrl) {
  const configurada = String(process.env.PUBLIC_URL || process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (configurada && !configurada.includes('localhost') && !configurada.includes('127.0.0.1')) return configurada;
  if (baseUrl) return String(baseUrl).trim().replace(/\/$/, '');
  return configurada || 'http://localhost:3000';
}

async function enviarCorreoVerificacion({ nombre, correo, token, baseUrl }) {
  const usuario = String(process.env.EMAIL_USER || '').trim();
  const contrasena = String(process.env.EMAIL_PASSWORD || '').trim().replace(/\s+/g, '');

  if (esConfiguracionPlaceholder(usuario) || esConfiguracionPlaceholder(contrasena)) {
    throw new Error('Correo no configurado: completa EMAIL_USER y EMAIL_PASSWORD en Backend/.env usando una contraseña de aplicación de Gmail.');
  }

  const appUrl = obtenerUrlPublica(baseUrl);
  const enlace = `${appUrl}/verificar-correo.html?token=${encodeURIComponent(token)}`;
  const nombreSeguro = escapeHtml(nombre);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#263238">
      <h2>🐾 Confirma tu cuenta de RefugiosBogotá</h2>
      <p>Hola <strong>${nombreSeguro}</strong>:</p>
      <p>Se solicitó la creación de una cuenta con este correo electrónico.</p>
      <p>Si fuiste tú, confirma tu dirección haciendo clic en el siguiente botón:</p>
      <p><a href="${enlace}" style="display:inline-block;background:#1B5E3B;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">Confirmar correo</a></p>
      <p>Este enlace es válido durante 24 horas.</p>
      <p>Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
      <hr>
      <small>RefugiosBogotá — Plataforma de gestión y adopción responsable.</small>
    </div>
  `;

  try {
    await enviarSMTP({
      usuario,
      contrasena,
      remitente: usuario,
      destinatario: correo,
      asunto: 'Confirma tu cuenta de RefugiosBogotá',
      html
    });
  } catch (err) {
    const detalle = String(err?.message || err);
    if (/535|534|authentication|auth/i.test(detalle)) {
      throw new Error('Gmail rechazó la autenticación. Verifica que EMAIL_USER sea correcto y que EMAIL_PASSWORD sea una contraseña de aplicación de Google, no la contraseña normal.');
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|network/i.test(detalle)) {
      throw new Error('No se pudo conectar con Gmail. Revisa tu conexión a Internet, firewall y acceso SMTP por el puerto 465.');
    }
    throw new Error(`No se pudo enviar el correo mediante Gmail: ${detalle}`);
  }

  return { enviado: true, enlaceVerificacion: enlace };
}

module.exports = { enviarCorreoVerificacion };
