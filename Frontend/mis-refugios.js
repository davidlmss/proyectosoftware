/**
 * mis-refugios.js — CU #5: Gestión de Perfil de Refugio
 * Lista los refugios creados por el usuario autenticado.
 */
'use strict';

const API = '/api';
const $   = id => document.getElementById(id);

const tokenSesion  = sessionStorage.getItem('token')   || localStorage.getItem('token');
const usuarioGuard = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');

if (!tokenSesion || !usuarioGuard) window.location.href = 'login.html';

let usuarioActual = {};
try { usuarioActual = JSON.parse(usuarioGuard || '{}'); } catch(e) {}

const LOC = {
  usaquen:'Usaquén', chapinero:'Chapinero', santa_fe:'Santa Fe', san_cristobal:'San Cristóbal',
  usme:'Usme', tunjuelito:'Tunjuelito', bosa:'Bosa', kennedy:'Kennedy', fontibon:'Fontibón',
  engativa:'Engativá', suba:'Suba', barrios_unidos:'Barrios Unidos', teusaquillo:'Teusaquillo',
  los_martires:'Los Mártires', antonio_narino:'Antonio Nariño', puente_aranda:'Puente Aranda',
  candelaria:'La Candelaria', rafael_uribe:'Rafael Uribe Uribe', ciudad_bolivar:'Ciudad Bolívar'
};
const fmtLoc = v => LOC[v] || v || '—';

document.addEventListener('DOMContentLoaded', () => {
  // Mostrar nombre en dropdown
  const greeting = $('user-greeting');
  const avatar   = $('profile-avatar');
  if (greeting && usuarioActual.nombre) greeting.textContent = usuarioActual.nombre;
  if (avatar   && usuarioActual.nombre) avatar.textContent   = usuarioActual.nombre.charAt(0).toUpperCase();

  cargarMisRefugios();

  document.addEventListener('click', e => {
    const dd = $('profile-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
  });
});

/* ── cargarMisRefugios() ─────────────────────────────────────────── */
async function cargarMisRefugios() {
  try {
    const res  = await fetch(`${API}/mis-refugios`, {
      headers: { 'Authorization': `Bearer ${tokenSesion}` }
    });
    const json = await res.json();

    const grid  = $('mr-grid');
    const empty = $('mr-empty');
    const sub   = $('mr-sub');

    if (!json.exito) {
      if (json.mensaje?.includes('esión')) {
        window.location.href = 'login.html';
        return;
      }
      if (grid) grid.innerHTML = '';
      mostrarToast('Error al cargar tus refugios.', 'error');
      return;
    }

    const refugios = json.refugios || [];

    if (sub) sub.textContent = refugios.length === 0
      ? 'No tienes refugios registrados aún'
      : `${refugios.length} refugio${refugios.length !== 1 ? 's' : ''} registrado${refugios.length !== 1 ? 's' : ''}`;

    if (refugios.length === 0) {
      if (grid)  grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';
    if (grid)  grid.innerHTML = refugios.map(r => renderCard(r)).join('');

  } catch (err) {
    console.error('[cargarMisRefugios]', err);
    mostrarToast('No se pudo conectar al servidor.', 'error');
    const grid = $('mr-grid');
    if (grid) grid.innerHTML = '';
  }
}

/* ── renderCard() ─────────────────────────────────────────────────── */
function renderCard(r) {
  return `
    <div class="mr-card">
      <div class="mr-card-icon">🏠</div>
      <div class="mr-card-body">
        <h3 class="mr-card-nombre">${r.nombre_refugio}</h3>
        <div class="mr-card-meta">
          <span>📍 ${fmtLoc(r.localidad)}</span>
          <span>📍 ${r.direccion}</span>
          <span>🐾 ${Number(r.capacidad_actual ?? 0)} perro${Number(r.capacidad_actual ?? 0) !== 1 ? 's' : ''} actualmente</span>
          ${r.capacidad !== null && r.capacidad !== undefined && r.capacidad !== '' ? `<span>📦 Capacidad máxima: ${Number(r.capacidad)}</span>` : '<span>📦 Capacidad máxima no especificada</span>'}
        </div>
        <p class="mr-card-desc">${r.descripcion}</p>
      </div>
      <div class="mr-card-actions">
        <a href="registrar-animal.html?refugio=${r.id_refugio}" class="btn-editar">🐶 Registrar perro</a>
        <a href="editar-refugio.html?id=${r.id_refugio}" class="btn-editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar
        </a>
      </div>
    </div>
  `;
}

/* ── Dropdown ─────────────────────────────────────────────────────── */
function toggleDropdown() {
  const dd = $('profile-dropdown');
  if (dd) dd.classList.toggle('open');
}

/* ── Sesión ───────────────────────────────────────────────────────── */
function cerrarSesion() {
  sessionStorage.clear();
  localStorage.clear();
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

window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 20);
});

let reportesRefugio = [];
let animalesRefugio = [];
let refugiosGestion = [];
let gestionActual = 'reportes';
let adopcionesRefugio = [];

async function cargarGestionRefugio() {
  const grid = $('gestion-grid');
  if (!grid) return;
  try {
    const [rr, aa, ak] = await Promise.all([
      fetch(`${API}/refugio/reportes`, {headers:{Authorization:`Bearer ${tokenSesion}`}}),
      fetch(`${API}/mis-animales`, {headers:{Authorization:`Bearer ${tokenSesion}`}}),
      fetch(`${API}/refugio/adopciones`, {headers:{Authorization:`Bearer ${tokenSesion}`}})
    ]);
    const jr = await rr.json(), ja = await aa.json(), jk = await ak.json();
    if (!jr.exito) { grid.innerHTML = '<p class="meta">No se pudieron cargar los reportes.</p>'; return; }
    reportesRefugio = jr.reportes || [];
    refugiosGestion = jr.refugios || [];
    animalesRefugio = ja.animales || [];
    adopcionesRefugio = jk.adopciones || [];
    renderGestion();
  } catch(e) {
    console.error('[cargarGestionRefugio]',e);
    grid.innerHTML='<p class="meta">No se pudo conectar al servidor.</p>';
  }
}

function mostrarGestion(tipo) {
  gestionActual = tipo;
  $('tab-reportes')?.classList.toggle('active', tipo === 'reportes');
  $('tab-animales')?.classList.toggle('active', tipo === 'animales');
  $('tab-adopciones')?.classList.toggle('active', tipo === 'adopciones');
  $('tab-adoptados')?.classList.toggle('active', tipo === 'adoptados');
  renderGestion();
}

function renderGestion() {
  const grid=$('gestion-grid'); if(!grid) return;
  if(gestionActual==='animales') {
    const refugioContexto=refugiosGestion[0]; const alta=`<a class="gestion-btn primary" href="registrar-animal.html${refugioContexto?`?refugio=${refugioContexto.id_refugio}`:''}">+ Registrar perro</a>`;
    if(!animalesRefugio.length){grid.innerHTML=`<div class="gestion-card"><div><h3>Aún no hay perros registrados</h3><div class="gestion-meta">Los perros que registres aparecerán aquí.</div></div><div class="gestion-actions">${alta}</div></div>`;return;}
    grid.innerHTML=`<div class="gestion-toolbar">${alta}</div>`+animalesRefugio.map(a=>`<div class="gestion-card"><div><h3>🐶 ${esc(a.nombre)} <span class="estado-pill">${esc(a.estado_adopcion)}</span></h3><div class="gestion-meta">${a.raza?esc(a.raza)+' · ':''}${esc(a.estado_salud)}${a.edad?' · '+esc(a.edad):''}<br>Refugio: ${esc(a.nombre_refugio||'—')}<br>${esc(a.descripcion||'')}</div></div><div class="gestion-actions">${a.estado_adopcion==='adoptado'?'<span class="gestion-meta">Ficha cerrada por adopción</span>':`<a class="gestion-btn" href="editar-animal.html?id=${a.id_animal}">Editar perro</a>`}</div></div>`).join('');
    return;
  }
  if(gestionActual==='adoptados') {
    const adoptados=animalesRefugio.filter(a=>a.estado_adopcion==='adoptado');
    grid.innerHTML=adoptados.length?adoptados.map(a=>`<div class="gestion-card"><div><h3>🐶 ${esc(a.nombre)} <span class="estado-pill">Adoptado</span></h3><div class="gestion-meta">${a.raza?esc(a.raza)+' · ':''}${esc(a.estado_salud)}<br>Este perro ya fue adoptado y su ficha está cerrada.</div></div></div>`).join(''):'<div class="gestion-card"><div><h3>No hay perros adoptados todavía</h3><div class="gestion-meta">Cuando una adopción se complete, el perro aparecerá aquí.</div></div></div>'; return;
  }
  if(gestionActual==='adopciones') {
    if(!adopcionesRefugio.length){grid.innerHTML='<div class="gestion-card"><div><h3>No hay solicitudes de adopción</h3><div class="gestion-meta">Las solicitudes enviadas sobre tus animales aparecerán aquí.</div></div></div>';return;}
    grid.innerHTML=adopcionesRefugio.map(a=>`<div class="gestion-card"><div><h3>🐾 ${esc(a.animal)} <span class="estado-pill">${esc(a.estado)}</span></h3><div class="gestion-meta">Solicitante: ${esc((a.adoptante_nombre||'')+' '+(a.adoptante_apellido||''))}<br>Correo: ${esc(a.adoptante_correo||'—')}<br>Refugio: ${esc(a.nombre_refugio)}<br>Solicitud: ${esc(a.fecha_solicitud)}${a.fecha_respuesta?'<br>Respuesta: '+esc(a.fecha_respuesta):''}${a.mensaje?'<br>Mensaje inicial: '+esc(a.mensaje):''}</div><div id="chat-${a.id_adopcion}"></div></div><div class="gestion-actions"><button class="gestion-btn" onclick="abrirChat(${a.id_adopcion})">💬 Conversación</button>${a.estado==='pendiente'?`<button class="gestion-btn primary" onclick="gestionarAdopcion(${a.id_adopcion},'aprobada')">Aprobar</button><button class="gestion-btn" onclick="gestionarAdopcion(${a.id_adopcion},'rechazada')">Rechazar</button>`:''}${a.estado==='aprobada'?`<button class="gestion-btn primary" onclick="gestionarAdopcion(${a.id_adopcion},'completada')">Marcar adopción realizada</button>`:''}</div></div>`).join('');
    return;
  }
  if(!reportesRefugio.length){grid.innerHTML='<div class="gestion-card"><div><h3>No hay reportes recibidos</h3><div class="gestion-meta">Cuando un usuario reporte un animal de tu localidad, aparecerá aquí.</div></div></div>';return;}
  grid.innerHTML=reportesRefugio.map(r=>{
    const opciones=refugiosGestion.map(f=>`<option value="${f.id_refugio}">${esc(f.nombre_refugio)}</option>`).join('');
    return `<div class="gestion-card"><div><h3>🐶 Reporte #${r.id_reporte} <span class="estado-pill">${esc(r.estado_reporte)}</span></h3><div class="gestion-meta">${esc(r.estado_animal)}<br>${esc(r.descripcion_fisica)}<br>📍 ${esc(r.ubicacion)} · ${esc(r.localidad)}<br>Reportado por: ${esc((r.reportante_nombre||'')+' '+(r.reportante_apellido||''))}</div></div><div class="gestion-actions"><select class="gestion-select" id="ref-${r.id_reporte}">${opciones}</select><button class="gestion-btn" onclick="cambiarEstadoReporte(${r.id_reporte},'en_proceso')">Atender</button><button class="gestion-btn primary" onclick="convertirReporte(${r.id_reporte})">Registrar como animal</button></div></div>`;
  }).join('');
}

async function cambiarEstadoReporte(id,estado){
  const res=await fetch(`${API}/refugio/reportes/${id}/estado`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokenSesion}`},body:JSON.stringify({estado})});
  const j=await res.json(); mostrarToast(j.mensaje || 'Actualizado',j.exito?'info':'error'); if(j.exito) cargarGestionRefugio();
}
async function convertirReporte(id){
  const sel=$(`ref-${id}`); const id_refugio=Number(sel?.value);
  if(!id_refugio){mostrarToast('Selecciona un refugio.','error');return;}
  const res=await fetch(`${API}/refugio/reportes/${id}/registrar-animal`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokenSesion}`},body:JSON.stringify({id_refugio})});
  const j=await res.json(); mostrarToast(j.mensaje || 'Proceso terminado',j.exito?'info':'error'); if(j.exito) cargarGestionRefugio();
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

// La API valida el acceso usando los refugios reales del usuario; no dependemos
// del rol guardado en sessionStorage para evitar sesiones antiguas después de una aprobación.
document.addEventListener('DOMContentLoaded', cargarGestionRefugio);

async function abrirChat(id){const box=$(`chat-${id}`);if(!box)return;box.innerHTML='<div class="chat-box">Cargando conversación...</div>';try{const r=await fetch(`${API}/adopciones/${id}/mensajes`,{headers:{Authorization:`Bearer ${tokenSesion}`}});const j=await r.json();if(!j.exito){box.innerHTML=`<div class="chat-box">${esc(j.mensaje||'Sin acceso')}</div>`;return;}box.innerHTML=`<div class="chat-box"><div class="chat-messages">${(j.mensajes||[]).map(m=>`<div class="chat-msg"><b>${esc(m.nombre||'Usuario')}</b>: ${esc(m.mensaje)}<small>${esc(m.fecha||'')}</small></div>`).join('')||'<div class="gestion-meta">Aún no hay mensajes.</div>'}</div><div class="chat-compose"><input id="chat-input-${id}" placeholder="Escribe un mensaje..." maxlength="1000"><button class="gestion-btn primary" onclick="enviarChat(${id})">Enviar</button></div></div>`;}catch(e){box.innerHTML='<div class="chat-box">No se pudo cargar la conversación.</div>';}}
async function enviarChat(id){const input=$(`chat-input-${id}`);const texto=input?.value.trim();if(!texto)return;try{const r=await fetch(`${API}/adopciones/${id}/mensajes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokenSesion}`},body:JSON.stringify({mensaje:texto})});const j=await r.json();if(!j.exito){mostrarToast(j.mensaje||'No se pudo enviar.','error');return;}await abrirChat(id);}catch(e){mostrarToast('No se pudo enviar el mensaje.','error');}}
async function gestionarAdopcion(id, estado){
  const accion = estado==='aprobada' ? 'aprobar' : estado==='rechazada' ? 'rechazar' : 'marcar como completada';
  if(!confirm(`¿Deseas ${accion} esta solicitud?`)) return;
  try {
    const res=await fetch(`${API}/adopciones/${id}/estado`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokenSesion}`},body:JSON.stringify({estado})});
    const j=await res.json();
    mostrarToast(j.mensaje || 'Solicitud actualizada',j.exito?'info':'error');
    if(j.exito) cargarGestionRefugio();
  } catch(e){ mostrarToast('No se pudo actualizar la solicitud.','error'); }
}
