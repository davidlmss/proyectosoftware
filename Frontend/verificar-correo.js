'use strict';

const API = '/api';
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const icon = document.getElementById('verify-icon');
const title = document.getElementById('verify-title');
const message = document.getElementById('verify-message');
const login = document.getElementById('verify-login');

async function verificar() {
  if (!token) {
    icon.textContent = '⚠️';
    title.textContent = 'Enlace incompleto';
    message.textContent = 'No se encontró el código de confirmación en el enlace.';
    return;
  }

  try {
    const res = await fetch(`${API}/verificar-correo?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data.exito) {
      icon.textContent = '✓';
      title.textContent = '¡Correo confirmado!';
      message.textContent = data.mensaje;
      login.style.display = 'inline-block';
    } else {
      icon.textContent = '⚠️';
      title.textContent = 'No se pudo confirmar';
      message.textContent = data.mensaje || 'El enlace no es válido o expiró.';
    }
  } catch (err) {
    icon.textContent = '⚠️';
    title.textContent = 'No se pudo conectar';
    message.textContent = 'El servidor no está disponible. Inicia el backend y vuelve a abrir el enlace.';
  }
}

verificar();
