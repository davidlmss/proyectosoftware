const API='/api';
const token=sessionStorage.getItem('token')||localStorage.getItem('token');
if(!token)location.href='login.html';
const $=id=>document.getElementById(id);
const paramsPagina=new URLSearchParams(window.location.search);
const filtroRefugio=Number(paramsPagina.get('refugio'))||null;
let nombreRefugioFiltro='';
let misRefugioIds=new Set();
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function foto(v){try{const a=JSON.parse(v||'[]');return a[0]||null}catch{return null}}
function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),4000)}
function formatearSexo(v){return ({macho:'Macho',hembra:'Hembra',no_determinado:'No determinado'}[v]||'No especificado')}
function formatearTamano(v){return ({pequeno:'Pequeño',mediano:'Mediano',grande:'Grande'}[v]||'No especificado')}
function formatearSalud(v){return ({estable:'Estable',en_tratamiento:'En tratamiento',recuperacion:'En recuperación',especial:'Requiere cuidados especiales',embarazo:'En embarazo'}[v]||'No especificado')}
async function cargarAnimales(){
 try {
   const mr=await fetch(`${API}/mis-refugios`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
   if(mr.ok){const jm=await mr.json();misRefugioIds=new Set((jm.refugios||[]).map(r=>Number(r.id_refugio)));}
 } catch(e) {}
 const qs=new URLSearchParams();
 if($('localidad').value)qs.set('localidad',$('localidad').value);
 if(filtroRefugio)qs.set('refugio',filtroRefugio);
 try{const r=await fetch(`${API}/animales?${qs}`,{cache:'no-store'});const j=await r.json();
   if(!r.ok||j.exito===false)throw new Error(j.mensaje||'Error');
   if(filtroRefugio&&j.animales?.length)nombreRefugioFiltro=j.animales[0].nombre_refugio||'';
   render(j.animales||[]);
 }catch(e){toast('No se pudieron cargar los animales.')}}
function render(items){
 const grid=$('animals-grid');grid.innerHTML='';$('empty').style.display=items.length?'none':'block';
 const titulo=document.querySelector('.adop-head h1'),subtitulo=document.querySelector('.adop-head p');
 if(titulo)titulo.textContent=filtroRefugio?`Perros de ${nombreRefugioFiltro||'este refugio'}`:'Animales en adopción';
 if(subtitulo)subtitulo.textContent=filtroRefugio?'Consulta los perros registrados por este refugio y revisa su información.':'Conoce los perros registrados por los refugios y solicita una adopción responsable.';
 items.forEach(a=>{
  const img=foto(a.fotos_urls),card=document.createElement('article');card.className='animal-item';
  const esPropio=misRefugioIds.has(Number(a.id_refugio));
  const accion=esPropio ? '<div class="report-help">Este perro pertenece a uno de tus refugios y no puede ser solicitado en adopción desde esta cuenta.</div>' : `<button class="btn-primary" style="width:100%" onclick="solicitar(${a.id_animal},'${esc(a.nombre).replace(/'/g,"\\'")}')">Solicitar adopción</button>`;
  card.innerHTML=`<div class="animal-photo">${img?`<img src="${esc(img)}" alt="${esc(a.nombre)}" onerror="this.parentElement.innerHTML='🐶'">`:'🐶'}</div><div class="animal-body"><span class="badge">${a.estado_adopcion==='en_proceso'?'Solicitud en proceso':'Disponible'}</span><h3>${esc(a.nombre)}</h3><div class="meta"><div><strong>Raza:</strong> ${esc(a.raza||'No especificada')}</div><div><strong>Sexo:</strong> ${formatearSexo(a.sexo)}</div><div><strong>Edad:</strong> ${esc(a.edad||'No especificada')}</div><div><strong>Tamaño:</strong> ${formatearTamano(a.tamano)}</div><div><strong>Color:</strong> ${esc(a.color||'No especificado')}</div><div><strong>Estado de salud:</strong> ${formatearSalud(a.estado_salud)}</div><div><strong>Refugio:</strong> ${esc(a.nombre_refugio||'No especificado')}</div><div><strong>Localidad:</strong> ${esc(a.localidad||'No especificada')}</div></div><p class="desc"><strong>Descripción:</strong> ${esc(a.descripcion)}</p>${accion}</div>`;
  grid.appendChild(card);
 });
}
let adopcionPendiente=null;
function solicitar(id,nombre){
 adopcionPendiente={id,nombre};
 const modal=document.getElementById('adoption-modal'),desc=document.getElementById('adoption-description'),msg=document.getElementById('adoption-message'),count=document.getElementById('adoption-count');
 if(desc)desc.textContent=`Estás solicitando adoptar a ${nombre}. El refugio recibirá esta solicitud y podrás darle seguimiento desde “Mis adopciones”.`;
 if(msg){msg.value='';msg.oninput=()=>{if(count)count.textContent=msg.value.length};}
 if(count)count.textContent='0';modal?.classList.add('open');setTimeout(()=>msg?.focus(),80);
}
function cerrarSolicitud(){adopcionPendiente=null;document.getElementById('adoption-modal')?.classList.remove('open');}
async function confirmarSolicitud(){
 if(!adopcionPendiente)return;
 const id=adopcionPendiente.id,nombre=adopcionPendiente.nombre,msg=document.getElementById('adoption-message'),mensaje=(msg?.value||'').trim();
 try{
  const r=await fetch(`${API}/adopciones`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({id_animal:id,mensaje})});
  const j=await r.json();
  if(j.exito){
   const idAdopcion=Number(j.adopcion?.id_adopcion||0);
   if(idAdopcion){sessionStorage.setItem('ultima_adopcion_id',String(idAdopcion));localStorage.setItem('ultima_adopcion_id',String(idAdopcion));localStorage.setItem('ultima_adopcion_registro',JSON.stringify(j.adopcion||{}));}
   cerrarSolicitud();
   window.location.href=`mis-adopciones.html?solicitud=${encodeURIComponent(idAdopcion)}`;
  }else toast(j.errores?._global||j.mensaje||'No se pudo enviar la solicitud.');
 }catch(e){toast('No se pudo conectar con el servidor.');}
}
(function actualizarNombreMenu(){try{const u=JSON.parse(sessionStorage.getItem('usuario')||localStorage.getItem('usuario')||'{}');const el=document.getElementById('account-user-name');if(el)el.textContent=([u.nombre,u.apellido].filter(Boolean).join(' ')||'Mi cuenta');}catch(e){}})();
function toggleAccountMenu(){document.getElementById('account-menu')?.classList.toggle('open')}
document.addEventListener('click',e=>{const m=document.getElementById('account-menu');if(m&&!m.contains(e.target))m.classList.remove('open')});
function cerrarSesion(){sessionStorage.clear();localStorage.removeItem('token');localStorage.removeItem('usuario');location.href='login.html'}
cargarAnimales();


function mostrarSeccion(tipo){
 const adop=document.getElementById('seccion-adopcion'), rep=document.getElementById('seccion-reportes');
 const ba=document.getElementById('switch-adopcion'), br=document.getElementById('switch-reportes');
 const esAdop=tipo==='adopcion';
 if(adop) adop.style.display=esAdop?'block':'none';
 if(rep) rep.style.display=esAdop?'none':'block';
 ba?.classList.toggle('active',esAdop); br?.classList.toggle('active',!esAdop);
 if(!esAdop) cargarReportesPublicos();
}
async function cargarReportesPublicos(){
 const grid=document.getElementById('reports-grid'), empty=document.getElementById('reports-empty'); if(!grid)return;
 const qs=new URLSearchParams(); const loc=document.getElementById('reporte-localidad')?.value; if(loc)qs.set('localidad',loc);
 try{const r=await fetch(`${API}/reportes/publicos?${qs}`),j=await r.json();const items=j.reportes||[];grid.innerHTML='';if(empty)empty.style.display=items.length?'none':'block';items.forEach(x=>{const c=document.createElement('article');c.className='report-card';c.innerHTML=`<h3>🐶 Reporte <span class="badge">${esc(x.estado_reporte)}</span></h3><div class="report-meta">${esc(x.estado_animal)} · ${esc(x.localidad)}<br>📍 ${esc(x.ubicacion)}<br>Reportado el ${esc(x.fecha_creacion||'')}</div><p class="report-desc">${esc(x.descripcion_fisica)}</p><div class="report-help">Este reporte aún no está vinculado a una fundación. Un refugio de la localidad podrá atenderlo.</div>`;grid.appendChild(c)})}catch(e){grid.innerHTML='<div class="empty">No se pudieron cargar los reportes.</div>';if(empty)empty.style.display='none'}
}
