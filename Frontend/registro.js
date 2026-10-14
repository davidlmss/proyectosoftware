/**
 * registro.js — Frontend del Caso de Uso: Registro de un Nuevo Usuario
 * Versión con backend real (Node.js + Express + SQLite)
 *
 * Cambios respecto a la versión anterior:
 *   - BaseDeDatos (array en memoria) → reemplazado por fetch() a /api/registro
 *   - verificarDatos() sigue corriendo en frontend para feedback inmediato (UX)
 *   - El backend hace la validación definitiva y el guardado real en SQLite
 *   - bcrypt corre en el servidor, no en el navegador
 */

'use strict';

const API = '/api';

/* ── Validación frontend (feedback inmediato, sin esperar al servidor) ── */
const Validador = {
  verificar(datos) {
    const errores = {};
    if (!datos.nombre   || datos.nombre.trim().length   < 2) errores.nombre   = 'Mínimo 2 caracteres.';
    if (!datos.apellido || datos.apellido.trim().length < 2) errores.apellido  = 'Mínimo 2 caracteres.';
    if (!datos.ubicacion)                                     errores.ubicacion = 'Selecciona tu localidad.';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!datos.correo || !re.test(datos.correo))              errores.correo    = 'Correo electrónico inválido.';
    if (!datos.esSocial && (!datos.contrasena || datos.contrasena.length < 8))
      errores.contrasena = 'Mínimo 8 caracteres.';
    return { valido: Object.keys(errores).length === 0, errores };
  }
};

/* ── Referencias DOM ── */
const $ = id => document.getElementById(id);
const form      = $('form-registro');
const btnSubmit = $('btn-submit');
const btnText   = $('btn-text');
const btnLoader = $('btn-loader');

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  if (!form) return;

  // Validación en tiempo real por campo
  ['nombre', 'apellido'].forEach(id => $(id)?.addEventListener('blur', () => validarCampo(id)));
  $('correo')?.addEventListener('blur',  () => validarCampo('correo'));
  $('contrasena')?.addEventListener('input', () => {
    actualizarMedidor($('contrasena').value);
    if ($('contrasena').classList.contains('invalid')) validarCampo('contrasena');
  });
  $('ubicacion')?.addEventListener('change', () => validarCampo('ubicacion'));

  form.addEventListener('submit', async e => { e.preventDefault(); await enviarDatos(); });
});

/* ── enviarDatos() — llama al backend real ── */
async function enviarDatos() {
  limpiarErrores();

  const datos = recopilarCampos();

  // Validación local primero (evita un round-trip innecesario)
  const { valido, errores } = Validador.verificar(datos);
  if (!valido) { mostrarErrores(errores); return; }

  setEnviando(true);

  try {
    console.log('Datos enviados:', JSON.stringify(datos));
    const res = await fetch(`${API}/registro`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(datos)
    });

    const json = await res.json();
    setEnviando(false);

    if (!json.exito) {
      mostrarErrores(json.errores || { _global: 'Error desconocido.' });
    } else {
      // La cuenta no inicia sesión automáticamente: primero debe confirmarse el correo.
      mostrarConfirmacion(json.usuario, json.mensaje);
    }

  } catch (err) {
    setEnviando(false);
    // Error de red — el servidor no está corriendo
    mostrarToast('No se pudo conectar al servidor. ¿Está corriendo Node.js?', 'error');
    console.error('[fetch /api/registro]', err);
  }
}

/* ── registrarConRedSocial() — S-1 (preparado para cuando estén los IDs OAuth) ── */
async function registrarConRedSocial(proveedor) {
  mostrarToast(
    `Integración con ${proveedor === 'google' ? 'Google' : 'Facebook'} próximamente disponible.`,
    'info'
  );
}

/* ── Helpers de UI ── */

function recopilarCampos() {
  return {
    nombre:     $('nombre')?.value     || '',
    apellido:   $('apellido')?.value   || '',
    correo:     $('correo')?.value      || '',
    contrasena: $('contrasena')?.value  || '',
    ubicacion:  $('ubicacion')?.value   || '',
    esSocial:   false
  };
}

function mostrarConfirmacion(usuario, mensaje) {
  if ($('success-nombre')) $('success-nombre').textContent = usuario.nombre;
  const msg = document.querySelector('.success-msg');
  if (msg) msg.textContent = mensaje || 'Cuenta creada. Revisa tu correo electrónico y confirma la cuenta antes de iniciar sesión.';

  const dd = $('success-data');
  if (dd) {
    dd.innerHTML = `
      <div class="row"><span class="k">Nombre</span>   <span class="v">${usuario.nombre} ${usuario.apellido}</span></div>
      <div class="row"><span class="k">Correo</span>   <span class="v">${usuario.correo}</span></div>
      <div class="row"><span class="k">Localidad</span><span class="v">${fmtLoc(usuario.ubicacion)}</span></div>
      <div class="row"><span class="k">Registro</span> <span class="v">${fmtFecha(usuario.fecha_registro)}</span></div>
    `;
  }

  $('screen-form')?.classList.remove('active');
  const ss = $('screen-success');
  if (ss) { ss.style.display = 'flex'; ss.classList.add('active'); }
}

function mostrarErrores(errores) {
  ['nombre','apellido','correo','contrasena','ubicacion'].forEach(c => {
    if (errores[c]) {
      const el = $('error-' + c); if (el) el.textContent = errores[c];
      const inp = $(c); if (inp) { inp.classList.add('invalid'); inp.classList.remove('valid'); }
    }
  });
  if (errores._global) mostrarToast(errores._global, 'error');
  if (errores._global && /correo|Gmail|EMAIL_/i.test(errores._global)) {
    console.error('[Correo de confirmación]', errores._global);
  }
  document.querySelector('.ferror:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validarCampo(campo) {
  const datos = recopilarCampos();
  const { errores } = Validador.verificar(datos);
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

function limpiarErrores() {
  ['nombre','apellido','correo','contrasena','ubicacion'].forEach(c => {
    const el = $('error-' + c); if (el) el.textContent = '';
    const inp = $(c); if (inp) inp.classList.remove('invalid','valid');
  });
}

function setEnviando(v) {
  if (btnSubmit) btnSubmit.disabled = v;
  if (btnText)   btnText.style.display   = v ? 'none'         : 'inline';
  if (btnLoader) btnLoader.style.display = v ? 'inline-block' : 'none';
  [$('btn-google'), $('btn-facebook')].forEach(b => { if (b) b.disabled = v; });
}

function actualizarMedidor(pw) {
  const fill = $('pw-fill'), label = $('pw-label');
  if (!fill || !label) return;
  if (!pw) { fill.style.width = '0%'; label.textContent = ''; return; }
  let p = 0;
  if (pw.length >= 8)          p++;
  if (/[A-Z]/.test(pw))        p++;
  if (/[0-9]/.test(pw))        p++;
  if (/[^a-zA-Z0-9]/.test(pw)) p++;
  const n = [
    { w: '25%',  c: '#DC2626', t: 'Débil'   },
    { w: '50%',  c: '#EA580C', t: 'Regular' },
    { w: '75%',  c: '#CA8A04', t: 'Buena'   },
    { w: '100%', c: '#1B5E3B', t: 'Fuerte'  }
  ][Math.max(0, p - 1)];
  fill.style.width = n.w; fill.style.background = n.c;
  label.textContent = n.t; label.style.color = n.c;
}

function togglePw() {
  const inp = $('contrasena');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function mostrarToast(msg, tipo = 'error') {
  const t = $('toast') || document.querySelector('.toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = tipo === 'info' ? '#1B5E3B' : '#DC2626';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

function reiniciar() {
  form?.reset();
  limpiarErrores();
  actualizarMedidor('');
  const pwField = $('contrasena')?.closest('.field');
  if (pwField) pwField.style.display = '';
  $('screen-success')?.classList.remove('active');
  if ($('screen-success')) $('screen-success').style.display = 'none';
  $('screen-form')?.classList.add('active');
}

// Nav scroll
const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => navEl?.classList.toggle('scrolled', window.scrollY > 20));

/* ── Utilidades ── */
const LOC = {
  usaquen:'Usaquén', chapinero:'Chapinero', santa_fe:'Santa Fe', san_cristobal:'San Cristóbal',
  usme:'Usme', tunjuelito:'Tunjuelito', bosa:'Bosa', kennedy:'Kennedy', fontibon:'Fontibón',
  engativa:'Engativá', suba:'Suba', barrios_unidos:'Barrios Unidos', teusaquillo:'Teusaquillo',
  los_martires:'Los Mártires', antonio_narino:'Antonio Nariño', puente_aranda:'Puente Aranda',
  candelaria:'La Candelaria', rafael_uribe:'Rafael Uribe Uribe', ciudad_bolivar:'Ciudad Bolívar',
  otra:'Otra ciudad'
};
const fmtLoc   = v => LOC[v] || v;
const fmtFecha = str => {
  if (!str) return '';
  const d = new Date(str);
  return isNaN(d) ? str : d.toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
};
