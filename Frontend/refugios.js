/**
 * refugios.js — Caso de Uso: Búsqueda de Refugios
 * Con geolocalización (S-1), vista mapa (Leaflet) y tipografía actualizada
 */
'use strict';

const $ = id => document.getElementById(id);

/* ── Verificar sesión ── */
const tokenSesion  = sessionStorage.getItem('token')   || localStorage.getItem('token');
const usuarioGuard = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
// Buscar refugios es una sección pública: no requiere iniciar sesión.
let usuarioActual = {};
try { usuarioActual = JSON.parse(usuarioGuard || '{}'); } catch (e) { usuarioActual = {}; }

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const pagina = window.location.pathname.split('/').pop();
  const tabBuscar    = $('tab-buscar');
  const tabReporte   = $('tab-reporte');
  const tabRegistrar = $('tab-registrar');

  if (tabBuscar)    tabBuscar.classList.toggle('active',    pagina === 'refugios.html' || pagina === '');
  if (tabReporte)   tabReporte.classList.toggle('active',   pagina === 'reporte-animal.html');
  if (tabRegistrar) tabRegistrar.classList.toggle('active', pagina === 'registro-refugio.html');

  // Mostrar nombre e inicial en el dropdown
  const greeting = $('user-greeting');
  const avatar   = $('profile-avatar');
  if (greeting && usuarioActual.nombre) greeting.textContent = usuarioActual.nombre;
  if (avatar   && usuarioActual.nombre) avatar.textContent   = usuarioActual.nombre.charAt(0).toUpperCase();

  // Verificar si tiene refugios para mostrar "Mis refugios"
  cargarMisRefugios();

  // Cargar refugios desde el backend
  cargarRefugios();

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', e => {
    const dd = $('profile-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  });
});

/* ── Coordenadas de localidades de Bogotá ── */
const COORDS_LOCALIDADES = {
  usaquen:        { lat: 4.7016,  lng: -74.0316, nombre: 'Usaquén'          },
  chapinero:      { lat: 4.6473,  lng: -74.0643, nombre: 'Chapinero'        },
  santa_fe:       { lat: 4.6097,  lng: -74.0817, nombre: 'Santa Fe'         },
  san_cristobal:  { lat: 4.5716,  lng: -74.0876, nombre: 'San Cristóbal'    },
  usme:           { lat: 4.4916,  lng: -74.1276, nombre: 'Usme'             },
  tunjuelito:     { lat: 4.5780,  lng: -74.1276, nombre: 'Tunjuelito'       },
  bosa:           { lat: 4.6197,  lng: -74.1876, nombre: 'Bosa'             },
  kennedy:        { lat: 4.6280,  lng: -74.1509, nombre: 'Kennedy'          },
  fontibon:       { lat: 4.6716,  lng: -74.1476, nombre: 'Fontibón'         },
  engativa:       { lat: 4.7016,  lng: -74.1109, nombre: 'Engativá'         },
  suba:           { lat: 4.7416,  lng: -74.0836, nombre: 'Suba'             },
  barrios_unidos: { lat: 4.6716,  lng: -74.0743, nombre: 'Barrios Unidos'   },
  teusaquillo:    { lat: 4.6473,  lng: -74.0976, nombre: 'Teusaquillo'      },
  los_martires:   { lat: 4.6080,  lng: -74.0943, nombre: 'Los Mártires'     },
  antonio_narino: { lat: 4.5916,  lng: -74.0943, nombre: 'Antonio Nariño'   },
  puente_aranda:  { lat: 4.6216,  lng: -74.1109, nombre: 'Puente Aranda'    },
  candelaria:     { lat: 4.5966,  lng: -74.0743, nombre: 'La Candelaria'    },
  rafael_uribe:   { lat: 4.5580,  lng: -74.1076, nombre: 'Rafael Uribe Uribe'},
  ciudad_bolivar: { lat: 4.5280,  lng: -74.1609, nombre: 'Ciudad Bolívar'   }
};




const LOC = Object.fromEntries(Object.entries(COORDS_LOCALIDADES).map(([k,v]) => [k, v.nombre]));

// Convierte cualquier forma de localidad del backend al identificador usado por los filtros.
function normalizarLocalidad(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
const TIPO_EMOJI = { perros:'🐶' };

let REFUGIOS     = []; // se carga desde el backend
let filtros      = { localidad:'', rating:0, nombre:'' };
let vistaActual  = 'grid'; // grid | lista | mapa
let mapaIniciado = false;
let mapaLeaflet  = null;
let marcadores   = [];
let ubicacionUsuario = null;
let marcadorUsuario  = null;

/* ── Geolocalización S-1 ── */
function usarMiUbicacion() {
  const btn = $('btn-geolocate');
  if (btn) { btn.textContent = '📡 Buscando...'; btn.disabled = true; }

  if (!navigator.geolocation) {
    mostrarToast('Tu navegador no soporta geolocalización.', 'error');
    if (btn) { btn.textContent = '📍 Usar mi ubicación'; btn.disabled = false; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      ubicacionUsuario = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const localidadCercana = encontrarLocalidadCercana(ubicacionUsuario.lat, ubicacionUsuario.lng);

      filtros.localidad = localidadCercana;
      if ($('filtro-localidad')) $('filtro-localidad').value = localidadCercana;

      mostrarToast(`📍 Ubicación detectada: ${LOC[localidadCercana] || localidadCercana}`, 'info');

      if (btn) { btn.textContent = `📍 ${LOC[localidadCercana]}`; btn.disabled = false; btn.classList.add('btn-geo-active'); }

      renderRefugios();

      if (vistaActual === 'mapa' && mapaLeaflet) {
        mapaLeaflet.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 13);
        if (marcadorUsuario) marcadorUsuario.remove();
        marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], {
          icon: L.divIcon({ className:'marker-usuario', html:'<div class="marker-yo">Tú</div>', iconSize:[40,40], iconAnchor:[20,20] })
        }).addTo(mapaLeaflet).bindPopup('Tu ubicación actual').openPopup();
        renderMarcadores();
      }
    },
    err => {
      let msg = 'No se pudo obtener la ubicación.';
      if (err.code === 1) msg = 'Permiso de ubicación denegado. Usa la búsqueda manual.';
      if (err.code === 2) msg = 'Ubicación no disponible. Intenta más tarde.';
      mostrarToast(msg, 'error');
      if (btn) { btn.textContent = '📍 Usar mi ubicación'; btn.disabled = false; }
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}

function encontrarLocalidadCercana(lat, lng) {
  let minDist = Infinity, localidadCercana = 'chapinero';
  Object.entries(COORDS_LOCALIDADES).forEach(([key, coords]) => {
    const dist = Math.sqrt(Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2));
    if (dist < minDist) { minDist = dist; localidadCercana = key; }
  });
  return localidadCercana;
}

/* ── Cambiar vista ── */
function cambiarVista(vista) {
  vistaActual = vista;
  ['grid','lista','mapa'].forEach(v => {
    $(`btn-${v}`)?.classList.toggle('active', v === vista);
  });

  const gridEl = $('refugios-grid');
  const mapaEl = $('mapa-container');

  if (vista === 'mapa') {
    if (gridEl) gridEl.style.display = 'none';
    if (mapaEl) mapaEl.style.display = 'block';
    iniciarMapa();
  } else {
    if (gridEl) { gridEl.style.display = 'grid'; }
    if (mapaEl) mapaEl.style.display = 'none';
    if (vista === 'lista') gridEl.classList.add('vista-lista');
    else gridEl.classList.remove('vista-lista');
    renderRefugios();
  }
}

/* ── Mapa Leaflet ── */
function iniciarMapa() {
  if (!mapaIniciado) {
    mapaLeaflet = L.map('mapa-leaflet').setView([4.6601, -74.0881], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(mapaLeaflet);
    mapaIniciado = true;
  }
  setTimeout(() => mapaLeaflet.invalidateSize(), 100);
  renderMarcadores();
  if (ubicacionUsuario) {
    mapaLeaflet.setView([ubicacionUsuario.lat, ubicacionUsuario.lng], 13);
    if (marcadorUsuario) marcadorUsuario.remove();
    marcadorUsuario = L.marker([ubicacionUsuario.lat, ubicacionUsuario.lng], {
      icon: L.divIcon({ className:'marker-usuario', html:'<div class="marker-yo">Tú</div>', iconSize:[40,40], iconAnchor:[20,20] })
    }).addTo(mapaLeaflet).bindPopup('Tu ubicación actual').openPopup();
  }
}

function renderMarcadores() {
  if (!mapaLeaflet) return;
  marcadores.forEach(m => m.remove());
  marcadores = [];

  const lista = filtrarRefugios();
  lista.forEach(r => {
    const coords = COORDS_LOCALIDADES[r.localidad];
    if (!coords) return;

    // Offset leve para que no se superpongan refugios de la misma localidad
    const jitter = (Math.random() - 0.5) * 0.01;
    const marker = L.marker([coords.lat + jitter, coords.lng + jitter], {
      icon: L.divIcon({
        className: 'marker-refugio',
        html: `<div class="marker-dot">${TIPO_EMOJI[r.tipo || 'perros']}</div>`,
        iconSize: [36,36],
        iconAnchor: [18,18]
      })
    })
      .addTo(mapaLeaflet)
      .bindPopup(`
        <div class="popup-refugio">
          <strong>${r.nombre}</strong><br/>
          <small>📍 ${LOC[r.localidad]} &nbsp;·&nbsp; ⭐ ${r.rating}</small><br/>
          <small>${r.animales} animales</small><br/>
          <button onclick="abrirModal(${r.id})" class="popup-btn">Ver detalles</button>
        </div>
      `);

    marcadores.push(marker);
  });
}

/* ── cargarRefugios() — GET /api/refugios ── */
async function cargarRefugios() {
  const grid  = $('refugios-grid');
  const count = $('resultado-count');
  if (grid)  grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--texto-3);grid-column:1/-1"><span class="spinner"></span> Cargando refugios...</div>';
  if (count) count.textContent = 'Cargando...';

  try {
    const res  = await fetch(`/api/refugios?_=${Date.now()}`, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || json.exito === false) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    // Normalizar los campos del backend al formato que espera el render
    REFUGIOS = (json.refugios || []).map(r => ({
      id:          r.id_refugio,
      nombre:      r.nombre_refugio,
      localidad:   normalizarLocalidad(r.localidad),
      tipo:        'perros',
      animales:    Number(r.capacidad_actual ?? 0),
      rating:      0,
      descripcion: r.descripcion,
      telefono:    r.telefono    || '',
      red_social:  r.red_social  || '',
      logo_url:    r.logo_url    || '',
      contacto:    r.responsable_correo || ''
      ,instagram:   r.instagram || ''
      ,facebook:    r.facebook || ''
      ,tiktok:      r.tiktok || ''
      ,youtube:     r.youtube || ''
      ,x_social:    r.x_social || ''
      ,whatsapp:    r.whatsapp || ''
    }));

    console.log('[cargarRefugios] Refugios recibidos:', REFUGIOS);
    renderRefugios();
  } catch (err) {
    console.error('[cargarRefugios]', err);
    if (grid) grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--error);grid-column:1/-1">No se pudieron cargar los refugios. Verifica que el servidor esté ejecutándose.</div>';
    if (count) count.textContent = 'Error al cargar refugios';
  }
}

/* ── Render grid/lista ── */
function renderRefugios() {
  if (vistaActual === 'mapa') { renderMarcadores(); return; }

  const lista  = filtrarRefugios();
  const grid   = $('refugios-grid');
  const empty  = $('empty-state');
  const count  = $('resultado-count');

  if (!grid) return;

  if (lista.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    if (count) count.textContent = 'No se encontraron refugios';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (count) count.textContent = `${lista.length} refugio${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`;

  grid.style.display = 'grid';
  grid.innerHTML = lista.map((r, i) => `
    <div class="refugio-app-card" onclick="abrirModal(${r.id})" style="animation-delay:${i * 0.05}s">
      <div class="rac-header">
        <div class="rac-emoji">${r.logo_url ? `<img src="${r.logo_url}" alt="logo" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : TIPO_EMOJI[r.tipo || 'perros']}</div>
        ${r.rating > 0 ? `<div class="rac-rating">⭐ ${r.rating}</div>` : ''}
      </div>
      <div class="rac-body">
        <h3 class="rac-nombre">${r.nombre}</h3>
        <span class="rac-loc">📍 ${LOC[r.localidad] || r.localidad}</span>
        <p class="rac-desc">${String(r.descripcion || '').substring(0, 90)}${String(r.descripcion || '').length > 90 ? '...' : ''}</p>
      </div>
      <div class="rac-footer">
        <span class="rac-animales">🐶 ${r.animales} perros actualmente</span>
        <button class="btn-ver-mas">Ver detalles →</button>
      </div>
    </div>
  `).join('');
}

/* ── Filtros ── */
function filtrarRefugios() {
  return REFUGIOS.filter(r => {
    if (filtros.localidad && normalizarLocalidad(r.localidad) !== normalizarLocalidad(filtros.localidad)) return false;
    if (r.rating < filtros.rating) return false;
    if (filtros.nombre && !r.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false;
    return true;
  });
}

function aplicarFiltros() {
  filtros.localidad = $('filtro-localidad')?.value || '';
  filtros.nombre    = $('filtro-nombre')?.value    || '';
  renderRefugios();
  if (vistaActual === 'mapa') renderMarcadores();
}


function seleccionarRating(btn) {
  document.querySelectorAll('[data-rating]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtros.rating = parseFloat(btn.dataset.rating);
  renderRefugios();
  if (vistaActual === 'mapa') renderMarcadores();
}

function limpiarFiltros() {
  filtros = { localidad:'', rating:0, nombre:'' };
  ubicacionUsuario = null;
  const btn = $('btn-geolocate');
  if (btn) { btn.textContent = '📍 Usar mi ubicación'; btn.classList.remove('btn-geo-active'); btn.disabled = false; }
  if ($('filtro-localidad')) $('filtro-localidad').value = '';
  if ($('filtro-nombre'))    $('filtro-nombre').value    = '';
  document.querySelectorAll('[data-rating]').forEach(b => b.classList.toggle('active', b.dataset.rating === '0'));
  if (marcadorUsuario) { marcadorUsuario.remove(); marcadorUsuario = null; }
  renderRefugios();
  if (vistaActual === 'mapa') renderMarcadores();
}

/* ── Modal ── */
function abrirModal(id) {
  const r = REFUGIOS.find(x => x.id === id);
  if (!r) return;
  const content = $('modal-content');
  if (content) {
    content.innerHTML = `
      <div class="modal-emoji">${r.logo_url ? `<img src="${r.logo_url}" alt="logo" style="width:56px;height:56px;border-radius:50%;object-fit:cover;">` : TIPO_EMOJI[r.tipo || 'perros']}</div>
      <div class="modal-header-info">
        <h2>${r.nombre}</h2>
        <div class="modal-meta">
          <span>📍 ${LOC[r.localidad] || r.localidad}</span>
          ${r.rating > 0 ? `<span>⭐ ${r.rating}</span>` : ''}
          ${r.animales ? `<span>${r.animales} animales</span>` : ''}
        </div>
      </div>
      <p class="modal-desc">${r.descripcion}</p>
      <div class="modal-contact">
        ${r.contacto   ? `<div class="contact-item"><span class="contact-icon">📧</span><span>${r.contacto}</span></div>` : ''}
        ${r.telefono   ? `<div class="contact-item"><span class="contact-icon">📞</span><span>${r.telefono}</span></div>` : ''}
        ${r.instagram ? `<div class="contact-item"><span class="contact-icon">📷</span><a href="${r.instagram}" target="_blank" style="color:var(--verde)">Instagram</a></div>` : ''}
        ${r.facebook ? `<div class="contact-item"><span class="contact-icon">📘</span><a href="${r.facebook}" target="_blank" style="color:var(--verde)">Facebook</a></div>` : ''}
        ${r.tiktok ? `<div class="contact-item"><span class="contact-icon">🎵</span><a href="${r.tiktok}" target="_blank" style="color:var(--verde)">TikTok</a></div>` : ''}
        ${r.youtube ? `<div class="contact-item"><span class="contact-icon">▶️</span><a href="${r.youtube}" target="_blank" style="color:var(--verde)">YouTube</a></div>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn-primary" onclick="verPerrosRefugio(${r.id})">🐶 Ver perros del refugio</button>
        <button class="btn-ghost" onclick="cerrarModal()">Cerrar</button>
      </div>
    `;
  }
  const modal = $('modal-refugio');
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function verPerrosRefugio(id) {
  window.location.href = `animales.html?refugio=${encodeURIComponent(id)}`;
}

function cerrarModal(e) {
  if (e && e.target !== $('modal-refugio')) return;
  const modal = $('modal-refugio');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

/* ── Dropdown de perfil ── */
function toggleDropdown() {
  const dd = $('profile-dropdown');
  if (dd) dd.classList.toggle('open');
}

async function cargarMisRefugios() {
  try {
    const res = await fetch('/api/mis-refugios', {
      headers: { 'Authorization': `Bearer ${tokenSesion}` }
    });
    const json = await res.json();
    if (json.exito && json.total > 0) {
      const item = $('item-mis-refugios');
      if (item) item.style.display = 'flex';
    }
  } catch (err) {
    console.warn('[cargarMisRefugios] No se pudo verificar refugios del usuario:', err);
  }
}

/* ── Sesión ── */
function cerrarSesion() {
  sessionStorage.removeItem('token'); sessionStorage.removeItem('usuario');
  localStorage.removeItem('token');   localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

function mostrarToast(msg, tipo = 'error') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = tipo === 'info' ? '#1B5E3B' : '#DC2626';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => navEl?.classList.toggle('scrolled', window.scrollY > 20));
