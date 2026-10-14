/**
 * reporte-animal.js — CU #6: Reportar Animal
 *
 * Flujo según diagrama de secuencia §1.2.1 Sprint 3:
 *   ingresarDatos() → enviarReporte(d) → validarDatosReporte()
 *   → procesarFotos() → buscarRefugiosPorLocalidad()
 *   → crearReporteAnimal() → guardarReporte() → notificarRefugios()
 *   → mostrarConfirmacion()
 *
 * Diagrama de estados InterfazReporteAnimal:
 *   FormularioVisible → DatosIngresados → ConfirmacionVisible
 *
 * Diagrama de estados Usuario:
 *   Autenticado → FormularioCompletado → ReporteAsociado
 */
'use strict';

const $ = id => document.getElementById(id);

/* ── Verificar sesión (precondición del CU) ── */
const tokenSesion  = sessionStorage.getItem('token')   || localStorage.getItem('token');
const usuarioGuard = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
if (!tokenSesion || !usuarioGuard) window.location.href = 'login.html';
const usuarioActual = JSON.parse(usuarioGuard || '{}');

/* ── Estado interno de la interfaz ── */

/* ── Coordenadas de localidades (para geolocalización S-1) ── */
const COORDS_LOCALIDADES = {
  usaquen:        { lat: 4.7016,  lng: -74.0316, nombre: 'Usaquén'           },
  chapinero:      { lat: 4.6473,  lng: -74.0643, nombre: 'Chapinero'         },
  santa_fe:       { lat: 4.6097,  lng: -74.0817, nombre: 'Santa Fe'          },
  san_cristobal:  { lat: 4.5716,  lng: -74.0876, nombre: 'San Cristóbal'     },
  usme:           { lat: 4.4916,  lng: -74.1276, nombre: 'Usme'              },
  tunjuelito:     { lat: 4.5780,  lng: -74.1276, nombre: 'Tunjuelito'        },
  bosa:           { lat: 4.6197,  lng: -74.1876, nombre: 'Bosa'              },
  kennedy:        { lat: 4.6280,  lng: -74.1509, nombre: 'Kennedy'           },
  fontibon:       { lat: 4.6716,  lng: -74.1476, nombre: 'Fontibón'          },
  engativa:       { lat: 4.7016,  lng: -74.1109, nombre: 'Engativá'          },
  suba:           { lat: 4.7416,  lng: -74.0836, nombre: 'Suba'              },
  barrios_unidos: { lat: 4.6716,  lng: -74.0743, nombre: 'Barrios Unidos'    },
  teusaquillo:    { lat: 4.6473,  lng: -74.0976, nombre: 'Teusaquillo'       },
  los_martires:   { lat: 4.6080,  lng: -74.0943, nombre: 'Los Mártires'      },
  antonio_narino: { lat: 4.5916,  lng: -74.0943, nombre: 'Antonio Nariño'    },
  puente_aranda:  { lat: 4.6216,  lng: -74.1109, nombre: 'Puente Aranda'     },
  candelaria:     { lat: 4.5966,  lng: -74.0743, nombre: 'La Candelaria'     },
  rafael_uribe:   { lat: 4.5580,  lng: -74.1076, nombre: 'Rafael Uribe Uribe'},
  ciudad_bolivar: { lat: 4.5280,  lng: -74.1609, nombre: 'Ciudad Bolívar'    }
};

const LOC_NOMBRES = Object.fromEntries(
  Object.entries(COORDS_LOCALIDADES).map(([k, v]) => [k, v.nombre])
);

/* ══════════════════════════════════════════════════════════════════
   DOMContentLoaded — Estado inicial: FormularioVisible
══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Mostrar nombre e inicial del usuario autenticado */
  const greeting = $('user-greeting');
  const avatar   = $('profile-avatar');
  if (greeting && usuarioActual.nombre) greeting.textContent = usuarioActual.nombre;
  if (avatar   && usuarioActual.nombre) avatar.textContent   = usuarioActual.nombre.charAt(0).toUpperCase();

  /* Verificar si el usuario tiene refugios para mostrar "Mis refugios" */
  verificarMisRefugios();

  /* Cerrar dropdown al hacer clic fuera */
  document.addEventListener('click', e => {
    const dd = $('profile-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  });

  /* Contador de caracteres para descripción */
  const desc = $('descripcion_fisica');
  if (desc) {
    desc.addEventListener('input', () => {
      const len = desc.value.length;
      const counter = $('char-desc');
      if (counter) counter.textContent = `${len} / 500`;
    });
  }

  /* Submit del formulario → enviarReporte() */
  const form = $('form-reporte');
  if (form) form.addEventListener('submit', enviarReporte);

  /* Scroll del nav */
  const navEl = $('nav');
  window.addEventListener('scroll', () => navEl?.classList.toggle('scrolled', window.scrollY > 20));
});

/* ══════════════════════════════════════════════════════════════════
   usarMiUbicacionReporte() — Subflujo S-1: Geolocalización
   UbicacionUsuario: solicitarPermiso() → obtenerCoordenadas()
══════════════════════════════════════════════════════════════════ */
function usarMiUbicacionReporte() {
  const btn = $('btn-geolocate-reporte');
  if (btn) { btn.textContent = '📡 Buscando ubicación...'; btn.disabled = true; }

  if (!navigator.geolocation) {
    mostrarToast('Tu navegador no soporta geolocalización.', 'error');
    if (btn) { btn.innerHTML = getGeoIcon() + ' Usar mi ubicación actual'; btn.disabled = false; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      // obtenerCoordenadas() exitoso — retornar coordenadas
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // Encontrar localidad más cercana
      const localidadKey = encontrarLocalidadCercana(lat, lng);
      const localidadNombre = LOC_NOMBRES[localidadKey] || localidadKey;

      // Actualizar campo de ubicación con coordenadas aproximadas
      const ubicInput = $('ubicacion');
      if (ubicInput && !ubicInput.value.trim()) {
        ubicInput.value = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        ubicInput.classList.add('valid');
      }

      // Autoseleccionar la localidad más cercana
      const locSelect = $('localidad');
      if (locSelect) { locSelect.value = localidadKey; }

      mostrarToast(`📍 Localidad detectada: ${localidadNombre}`, 'info');
      if (btn) {
        btn.innerHTML = `📍 ${localidadNombre}`;
        btn.classList.add('btn-geo-active');
        btn.disabled = false;
      }
    },
    err => {
      // E-2: Ubicación no disponible
      let msg = 'No se pudo obtener la ubicación.';
      if (err.code === 1) msg = 'Permiso denegado. Ingresa la dirección manualmente.';
      if (err.code === 2) msg = 'Ubicación no disponible. Intenta más tarde.';
      mostrarToast(msg, 'error');
      if (btn) { btn.innerHTML = getGeoIcon() + ' Usar mi ubicación actual'; btn.disabled = false; }
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

function getGeoIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" opacity=".3"/></svg>`;
}

function encontrarLocalidadCercana(lat, lng) {
  let minDist = Infinity, localidadCercana = 'chapinero';
  Object.entries(COORDS_LOCALIDADES).forEach(([key, coords]) => {
    const dist = Math.sqrt(Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2));
    if (dist < minDist) { minDist = dist; localidadCercana = key; }
  });
  return localidadCercana;
}

/* ══════════════════════════════════════════════════════════════════
   Gestión dinámica de inputs de fotos
══════════════════════════════════════════════════════════════════ */
function addFotoInput() {
  const list = $('foto-url-list');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'foto-url-item';
  div.innerHTML = `
    <input type="text" class="foto-url-input" placeholder="Ej. https://i.imgur.com/foto.jpg"/>
    <button type="button" class="btn-remove-foto" onclick="removeFotoInput(this)" title="Quitar">✕</button>
  `;
  list.appendChild(div);
}

function removeFotoInput(btn) {
  const item = btn.closest('.foto-url-item');
  const list = $('foto-url-list');
  // Mantener al menos un campo
  if (list && list.children.length > 1) {
    item.remove();
  } else {
    // Solo limpiar el valor
    const inp = item.querySelector('input');
    if (inp) inp.value = '';
  }
}

function obtenerFotosUrls() {
  const inputs = document.querySelectorAll('.foto-url-input');
  return Array.from(inputs)
    .map(i => i.value.trim())
    .filter(Boolean);
}

/* ══════════════════════════════════════════════════════════════════
   validarFormato() — InterfazReporteAnimal (Frontera)
   Validación del lado del cliente antes de enviar al controlador.
   Diagrama de actividad: valididos → enviarReporte() | invalidos → mostrarError()
══════════════════════════════════════════════════════════════════ */
function validarFormato() {
  let valido = true;

  // Limpiar errores previos
  ['descripcion_fisica','estado_animal','ubicacion','localidad'].forEach(campo => {
    const errEl = $(`error-${campo}`);
    if (errEl) errEl.textContent = '';
    const input = $(campo);
    if (input) { input.classList.remove('invalid','valid'); }
  });
  ocultarAlertaGlobal();


  // Descripción física
  const desc = $('descripcion_fisica');
  if (!desc || desc.value.trim().length < 10) {
    setFieldError('descripcion_fisica', 'Descripción requerida (mínimo 10 caracteres).');
    valido = false;
  } else {
    setFieldValid('descripcion_fisica');
  }

  // Estado animal
  const estado = $('estado_animal');
  if (!estado || !estado.value) {
    const errEl = $('error-estado_animal');
    if (errEl) errEl.textContent = 'Selecciona el estado aparente del animal.';
    if (estado) estado.classList.add('invalid');
    valido = false;
  } else {
    if (estado) estado.classList.add('valid');
  }

  // Ubicación
  const ubic = $('ubicacion');
  if (!ubic || ubic.value.trim().length < 5) {
    setFieldError('ubicacion', 'Ingresa la dirección o lugar donde encontraste el animal.');
    valido = false;
  } else {
    setFieldValid('ubicacion');
  }

  // Localidad
  const loc = $('localidad');
  if (!loc || !loc.value) {
    const errEl = $('error-localidad');
    if (errEl) errEl.textContent = 'Selecciona la localidad para notificar refugios cercanos.';
    if (loc) loc.classList.add('invalid');
    valido = false;
  } else {
    if (loc) loc.classList.add('valid');
  }

  return valido;
}

function setFieldError(id, msg) {
  const el  = $(id);
  const err = $(`error-${id}`);
  if (el)  { el.classList.add('invalid'); el.classList.remove('valid'); }
  if (err) err.textContent = msg;
}

function setFieldValid(id) {
  const el  = $(id);
  const err = $(`error-${id}`);
  if (el)  { el.classList.add('valid'); el.classList.remove('invalid'); }
  if (err) err.textContent = '';
}

/* ══════════════════════════════════════════════════════════════════
   enviarReporte() — InterfazReporteAnimal → ControladorReporteAnimal
   Diagrama de actividad 1: enviarReporte() — Frontera
   Estado: DatosIngresados → (validarFormato) → ConfirmacionVisible
══════════════════════════════════════════════════════════════════ */
async function enviarReporte(e) {
  e.preventDefault();

  // validarFormato() — lado cliente
  if (!validarFormato()) {
    mostrarToast('Completa los campos obligatorios antes de enviar.', 'error');
    return;
  }

  // Estado: enviando…
  setBtnLoading(true);

  // Armar el mapa de datos (d: Map)
  const fotosUrls = obtenerFotosUrls();

  const datos = {
    descripcion_fisica: $('descripcion_fisica').value.trim(),
    estado_animal:     $('estado_animal').value,
    ubicacion:         $('ubicacion').value.trim(),
    localidad:         $('localidad').value,
    fotos_urls:        fotosUrls.join(',')  // serializado para el body
  };

  try {
    // enviarReporte(d: Map) → POST /api/reportes
    const res  = await fetch('/api/reportes', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${tokenSesion}`
      },
      body: JSON.stringify(datos)
    });

    const json = await res.json();

    if (json.exito) {
      // reporteRegistrado() → mostrarConfirmacion()
      mostrarConfirmacion(json);
    } else {
      // E-1/E-3: mostrarError()
      manejarErrores(json.errores);
    }

  } catch (err) {
    console.error('[enviarReporte] Error de red:', err);
    mostrarAlertaGlobal('No se pudo conectar al servidor. ¿Está corriendo Node.js?');
    mostrarToast('Error de conexión. Intenta de nuevo.', 'error');
  } finally {
    setBtnLoading(false);
  }
}

/* ══════════════════════════════════════════════════════════════════
   mostrarConfirmacion() — Estado: ConfirmacionVisible
   Diagrama de estados: ConfirmacionVisible (estado final UI)
══════════════════════════════════════════════════════════════════ */
function mostrarConfirmacion(json) {
  const { reporte, refugios_notificados, refugios } = json;

  /* Info de refugios notificados */
  const refugiosInfoEl = $('success-refugios-info');
  if (refugiosInfoEl) {
    if (refugios_notificados > 0) {
      const lista = refugios.map(n => `<li>${n}</li>`).join('');
      refugiosInfoEl.innerHTML = `
        <div class="success-refugios">
          <strong>✅ ${refugios_notificados} refugio${refugios_notificados !== 1 ? 's' : ''} notificado${refugios_notificados !== 1 ? 's' : ''}:</strong>
          <ul>${lista}</ul>
        </div>
      `;
    } else {
      refugiosInfoEl.innerHTML = `
        <div class="success-no-refugios">
          ℹ️ No se encontraron refugios registrados en la localidad <strong>${LOC_NOMBRES[reporte.localidad] || reporte.localidad}</strong>.
          El reporte quedó guardado con estado <em>pendiente</em>.
        </div>
      `;
    }
  }

  /* Resumen del reporte */
  const dataEl = $('success-data');
  if (dataEl && reporte) {
    dataEl.innerHTML = `
      <div class="row"><span class="k">Estado</span><span class="v">${labelEstado(reporte.estado_animal)}</span></div>
      <div class="row"><span class="k">Localidad</span><span class="v">${LOC_NOMBRES[reporte.localidad] || reporte.localidad}</span></div>
      <div class="row"><span class="k">Ubicación</span><span class="v">${reporte.ubicacion}</span></div>
      <div class="row"><span class="k">Estado reporte</span><span class="v">🟡 Pendiente</span></div>
    `;
  }

  /* Transición de pantalla: FormularioVisible → ConfirmacionVisible */
  $('screen-form').style.display = 'none';
  const success = $('screen-success');
  if (success) { success.style.display = 'flex'; success.classList.add('active'); }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function labelEstado(estado) {
  const map = { herido: '🩹 Herido', perdido: '🔍 Perdido', abandonado: '😢 Abandonado', sano: '✅ Sano pero en riesgo' };
  return map[estado] || estado;
}

/* ══════════════════════════════════════════════════════════════════
   nuevoReporte() — Reiniciar formulario
   Estado: ConfirmacionVisible → FormularioVisible
══════════════════════════════════════════════════════════════════ */
function nuevoReporte() {
  // Resetear estado interno

  // Resetear formulario
  const form = $('form-reporte');
  if (form) form.reset();

  // Resetear lista de fotos a un solo campo vacío
  const lista = $('foto-url-list');
  if (lista) lista.innerHTML = `
    <div class="foto-url-item">
      <input type="text" class="foto-url-input" placeholder="Ej. https://i.imgur.com/foto.jpg"/>
      <button type="button" class="btn-remove-foto" onclick="removeFotoInput(this)" title="Quitar">✕</button>
    </div>
  `;

  // Resetear contador
  const counter = $('char-desc');
  if (counter) counter.textContent = '0 / 500';

  // Limpiar campos de validación
  ['descripcion_fisica','ubicacion'].forEach(id => {
    const el = $(id);
    if (el) { el.classList.remove('valid','invalid'); }
  });

  ocultarAlertaGlobal();

  // Volver a FormularioVisible
  const success = $('screen-success');
  if (success) { success.style.display = 'none'; success.classList.remove('active'); }
  $('screen-form').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Helpers de UI ── */
function setBtnLoading(loading) {
  const btn    = $('btn-submit');
  const text   = $('btn-text');
  const loader = $('btn-loader');
  if (!btn) return;
  btn.disabled = loading;
  if (text)   text.style.display   = loading ? 'none'         : '';
  if (loader) loader.style.display = loading ? 'inline-block' : 'none';
}

function manejarErrores(errores) {
  if (!errores) return;
  if (errores._global) {
    mostrarAlertaGlobal(errores._global);
    return;
  }
  const mapCampos = {
    descripcion_fisica:'error-descripcion_fisica',
    estado_animal:     'error-estado_animal',
    ubicacion:         'error-ubicacion',
    localidad:         'error-localidad'
  };
  Object.entries(errores).forEach(([campo, msg]) => {
    const errId = mapCampos[campo];
    if (errId) {
      const errEl = $(errId);
      if (errEl) errEl.textContent = msg;
      const input = $(campo);
      if (input) input.classList.add('invalid');
    }
  });
}

function mostrarAlertaGlobal(msg) {
  const el = $('alert-global');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function ocultarAlertaGlobal() {
  const el = $('alert-global');
  if (el) el.style.display = 'none';
}

function mostrarToast(msg, tipo = 'error') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = tipo === 'info' ? '#1B5E3B' : '#DC2626';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

/* ── Dropdown de perfil ── */
function toggleDropdown() {
  const dd = $('profile-dropdown');
  if (dd) dd.classList.toggle('open');
}

async function verificarMisRefugios() {
  try {
    const res  = await fetch('/api/mis-refugios', {
      headers: { 'Authorization': `Bearer ${tokenSesion}` }
    });
    const json = await res.json();
    if (json.exito && json.total > 0) {
      const item = $('item-mis-refugios');
      if (item) item.style.display = 'flex';
    }
  } catch (err) {
    console.warn('[verificarMisRefugios]', err);
  }
}

/* ── Cerrar sesión ── */
function cerrarSesion() {
  sessionStorage.removeItem('token'); sessionStorage.removeItem('usuario');
  localStorage.removeItem('token');   localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}
