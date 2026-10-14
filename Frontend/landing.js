/* landing.js — animaciones e interacciones de la landing page */
'use strict';

// ── Nav scroll ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 20);
});


// ── Contador animado de estadísticas ──
function animarContador(el, final, duracion = 1800) {
  const inicio = performance.now();
  const update = (now) => {
    const t = Math.min((now - inicio) / duracion, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const valor = Math.round(ease * final);
    el.textContent = valor >= 1000
      ? (valor >= 10000 ? (valor / 1000).toFixed(0) + 'k' : valor.toLocaleString('es-CO'))
      : valor;
    if (t < 1) requestAnimationFrame(update);
    else el.textContent = final >= 1000
      ? (final >= 10000 ? (final / 1000).toFixed(0) + 'k' : final.toLocaleString('es-CO'))
      : final;
  };
  requestAnimationFrame(update);
}

// Observar cuando la sección de stats entra en viewport
const statsSection = document.querySelector('.stats-section');
if (statsSection) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.stat-item').forEach((item, i) => {
          const ids = ['s1','s2','s3','s4'];
          const vals = [128, 3400, 12000, 19];
          const el = document.getElementById(ids[i]);
          if (el) animarContador(el, vals[i], 1600 + i * 100);
        });
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(statsSection);
}

// ── Reveal on scroll ──
const revealEls = document.querySelectorAll('.step-card, .refugio-card, .stat-item');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      e.target.style.animation = `fadeUp 0.5s ${i * 0.07}s ease both`;
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
revealEls.forEach(el => revealObserver.observe(el));

// Vista previa pública por ubicación (no requiere iniciar sesión).
const LANDING_COORDS = {
  usaquen:[4.7016,-74.0316,'Usaquén'],chapinero:[4.6473,-74.0643,'Chapinero'],santa_fe:[4.6097,-74.0817,'Santa Fe'],san_cristobal:[4.5716,-74.0876,'San Cristóbal'],usme:[4.4916,-74.1276,'Usme'],tunjuelito:[4.578,-74.1276,'Tunjuelito'],bosa:[4.6197,-74.1876,'Bosa'],kennedy:[4.628,-74.1509,'Kennedy'],fontibon:[4.6716,-74.1476,'Fontibón'],engativa:[4.7016,-74.1109,'Engativá'],suba:[4.7416,-74.0836,'Suba'],barrios_unidos:[4.6716,-74.0743,'Barrios Unidos'],teusaquillo:[4.6473,-74.0976,'Teusaquillo'],los_martires:[4.608,-74.0943,'Los Mártires'],antonio_narino:[4.5916,-74.0943,'Antonio Nariño'],puente_aranda:[4.6216,-74.1109,'Puente Aranda'],candelaria:[4.5966,-74.0743,'La Candelaria'],rafael_uribe:[4.558,-74.1076,'Rafael Uribe Uribe'],ciudad_bolivar:[4.528,-74.1609,'Ciudad Bolívar']
};
function localidadLanding(lat,lng){let best='chapinero',d=Infinity;Object.entries(LANDING_COORDS).forEach(([k,v])=>{const x=(lat-v[0])**2+(lng-v[1])**2;if(x<d){d=x;best=k;}});return best;}
async function cargarCercanosLanding(loc){
  const rBox=document.getElementById('nearby-refugios'),aBox=document.getElementById('nearby-animales');
  try{
    const [rr,aa]=await Promise.all([fetch(`/api/refugios`),fetch(`/api/animales?localidad=${encodeURIComponent(loc)}`)]);
    const jr=await rr.json(),ja=await aa.json();
    const refugios=(jr.refugios||[]).filter(r=>r.localidad===loc).slice(0,3), animales=(ja.animales||[]).slice(0,3);
    rBox.innerHTML=refugios.length?refugios.map(r=>`<article class="nearby-card"><div><h4>🏠 ${escLanding(r.nombre_refugio)}</h4><div class="nearby-meta">📍 ${escLanding(r.localidad)}${r.capacidad_actual!=null?' · '+r.capacidad_actual+' perros actualmente':''}</div><div class="nearby-meta">${escLanding((r.descripcion||'').slice(0,100))}</div></div></article>`).join(''):'<div class="nearby-empty">No hay refugios registrados en esta localidad.</div>';
    aBox.innerHTML=animales.length?animales.map(a=>`<article class="nearby-card"><div><h4>🐶 ${escLanding(a.nombre)}</h4><div class="nearby-meta">${a.raza?escLanding(a.raza)+' · ':''}${a.edad?escLanding(a.edad)+' · ':''}📍 ${escLanding(a.nombre_refugio)}</div></div><a href="animales.html" class="btn-ghost btn-sm">Ver</a></article>`).join(''):'<div class="nearby-empty">No hay perros disponibles en esta localidad.</div>';
  }catch(e){rBox.innerHTML=aBox.innerHTML='<div class="nearby-empty">No se pudo cargar la vista previa. Verifica que el servidor esté activo.</div>';}
}
function escLanding(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function solicitarUbicacionLanding(){
  const btn=document.getElementById('btn-ubicacion-landing'),estado=document.getElementById('ubicacion-landing-estado');
  if(!navigator.geolocation){estado.textContent='Tu navegador no permite geolocalización.';return;}
  btn.disabled=true;btn.textContent='📡 Buscando ubicación...';
  navigator.geolocation.getCurrentPosition(async pos=>{const loc=localidadLanding(pos.coords.latitude,pos.coords.longitude);estado.textContent=`📍 Mostrando información de ${LANDING_COORDS[loc][2]}.`;btn.textContent='📍 Ubicación detectada';await cargarCercanosLanding(loc);},()=>{estado.textContent='No se pudo obtener la ubicación. Puedes volver a intentarlo.';btn.disabled=false;btn.textContent='📍 Mostrar cerca de mí';},{enableHighAccuracy:false,timeout:8000,maximumAge:60000});
}

// Mantener visible la sesión al volver a la página principal desde el logo.
(function actualizarAccionesSesionLanding(){
  let usuario = null;
  try { usuario = JSON.parse(sessionStorage.getItem('usuario') || localStorage.getItem('usuario') || 'null'); } catch (_) {}
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const acciones = document.querySelector('.nav-actions');
  if (!acciones || !token || !usuario) return;
  const destino = usuario.rol === 'administrador' ? 'admin.html' : (usuario.rol === 'refugio' ? 'mis-refugios.html' : 'animales.html');
  acciones.innerHTML = `<a href="${destino}" class="btn-nav-outline">Ir a la plataforma</a><a href="perfil.html" class="btn-nav-fill">Mi perfil</a>`;
})();
