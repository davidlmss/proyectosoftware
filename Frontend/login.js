/**
 * login.js — Caso de Uso: Inicio de Sesión
 * "Recordarme" guarda token en localStorage (persiste al cerrar el navegador).
 * Sin "Recordarme" usa sessionStorage (se borra al cerrar la pestaña).
 */
'use strict';

const API = '/api';

const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  const form = $('form-login');
  if (!form) return;

  // Si ya hay sesión activa, ir directo a refugios
  const tokenGuardado = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (tokenGuardado) {
    window.location.href = 'refugios.html';
    return;
  }

  $('correo')?.addEventListener('blur',      () => validarCampo('correo'));
  $('contrasena')?.addEventListener('input', () => {
    if ($('contrasena').classList.contains('invalid')) validarCampo('contrasena');
  });

  form.addEventListener('submit', async e => { e.preventDefault(); await iniciarSesion(); });
});

/* ── iniciarSesion() ── */
async function iniciarSesion() {
  limpiarErrores();

  const datos = {
    correo:     $('correo')?.value.trim() || '',
    contrasena: $('contrasena')?.value    || '',
    recordarme: $('recordarme')?.checked  || false
  };

  const { valido, errores } = validarLocal(datos);
  if (!valido) { mostrarErrores(errores); return; }

  setEnviando(true);

  try {
    const res  = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(datos)
    });

    const json = await res.json();
    setEnviando(false);

    if (!json.exito) {
      mostrarErrores(json.errores || { _global: 'Correo o contraseña incorrectos.' });
    } else {
      const usuarioStr = JSON.stringify(json.usuario);

      // Siempre guardar en sessionStorage (pestaña actual)
      sessionStorage.setItem('token',   json.token);
      sessionStorage.setItem('usuario', usuarioStr);

      // "Recordarme" → también guardar en localStorage (persiste siempre)
      if (datos.recordarme) {
        localStorage.setItem('token',   json.token);
        localStorage.setItem('usuario', usuarioStr);
      }

      window.location.href = 'refugios.html';
    }

  } catch (err) {
    setEnviando(false);
    mostrarToast('No se pudo conectar al servidor. ¿Está corriendo Node.js?', 'error');
    console.error('[fetch /api/login]', err);
  }
}

/* ── Validación local ── */
function validarLocal(datos) {
  const errores = {};
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!datos.correo || !re.test(datos.correo))          errores.correo     = 'Ingresa un correo válido.';
  if (!datos.contrasena || datos.contrasena.length < 1) errores.contrasena = 'Ingresa tu contraseña.';
  return { valido: Object.keys(errores).length === 0, errores };
}

function validarCampo(campo) {
  const datos = { correo: $('correo')?.value.trim() || '', contrasena: $('contrasena')?.value || '' };
  const { errores } = validarLocal(datos);
  const errEl = $('error-' + campo);
  const inpEl = $(campo);
  if (errores[campo]) {
    if (errEl) errEl.textContent = errores[campo];
    if (inpEl) { inpEl.classList.add('invalid'); inpEl.classList.remove('valid'); }
  } else {
    if (errEl) errEl.textContent = '';
    if (inpEl && inpEl.value) { inpEl.classList.remove('invalid'); inpEl.classList.add('valid'); }
  }
}

function mostrarErrores(errores) {
  ['correo', 'contrasena'].forEach(c => {
    if (errores[c]) {
      const el = $('error-' + c); if (el) el.textContent = errores[c];
      const inp = $(c); if (inp) { inp.classList.add('invalid'); inp.classList.remove('valid'); }
    }
  });
  if (errores._global) {
    const alert = $('alert-error');
    if (alert) { alert.textContent = errores._global; alert.style.display = 'block'; }
  }
}

function limpiarErrores() {
  ['correo', 'contrasena'].forEach(c => {
    const el = $('error-' + c); if (el) el.textContent = '';
    const inp = $(c); if (inp) inp.classList.remove('invalid', 'valid');
  });
  const alert = $('alert-error');
  if (alert) { alert.textContent = ''; alert.style.display = 'none'; }
}

function setEnviando(v) {
  const btnSubmit = $('btn-submit');
  const btnText   = $('btn-text');
  const btnLoader = $('btn-loader');
  if (btnSubmit) btnSubmit.disabled        = v;
  if (btnText)   btnText.style.display   = v ? 'none'         : 'inline';
  if (btnLoader) btnLoader.style.display = v ? 'inline-block' : 'none';
}

function togglePw() {
  const inp = $('contrasena');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function mostrarToast(msg, tipo = 'error') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = tipo === 'info' ? '#1B5E3B' : '#DC2626';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 20);
});
