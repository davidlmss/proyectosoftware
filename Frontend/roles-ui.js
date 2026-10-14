'use strict';
(function(){
  let usuario={};
  try { usuario=JSON.parse(sessionStorage.getItem('usuario')||localStorage.getItem('usuario')||'{}'); } catch(e) {}
  const rol=usuario.rol||'adoptante';
  const nombres={administrador:'Administrador',refugio:'Refugio',adoptante:'Adoptante'};
  document.querySelectorAll('[data-rol]').forEach(el=>{
    const permitidos=el.dataset.rol.split(',').map(x=>x.trim());
    if(!permitidos.includes(rol)) el.style.display='none';
  });
  document.querySelectorAll('[data-estado-refugio]').forEach(el=>{
    if(el.dataset.estadoRefugio && el.dataset.estadoRefugio!==usuario.estado_refugio) el.style.display='none';
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const navs=document.querySelectorAll('.nav-user');
    navs.forEach(nav=>{
      if(nav.closest('.account-menu') || nav.querySelector('.account-menu')) return;
      if(nav.querySelector('.role-user-badge') || nav.querySelector('.profile-dropdown')) return;
      const badge=document.createElement('span'); badge.className='role-user-badge'; badge.title='Tipo de usuario'; badge.textContent=`${nombres[rol]||'Usuario'}`;
      badge.style.cssText='display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#eef6f0;color:#1b5e3b;font-size:.78rem;font-weight:700;margin-right:8px;';
      const perfil=document.createElement('a'); perfil.href='perfil.html'; perfil.className='btn-ghost'; perfil.textContent='Mi perfil'; perfil.style.marginRight='8px';
      nav.insertBefore(perfil,nav.firstChild); nav.insertBefore(badge,perfil);
    });
  });
})();
