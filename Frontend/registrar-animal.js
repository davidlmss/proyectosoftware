
let perfilAnimal={};
try{perfilAnimal=JSON.parse(sessionStorage.getItem('usuario')||localStorage.getItem('usuario')||'{}')}catch(e){}
const API='/api';
const token=sessionStorage.getItem('token')||localStorage.getItem('token');
if(!token) location.href='login.html';
const $=id=>document.getElementById(id);


async function verificarAccesoRefugio(){
 try{
  const r=await fetch(`${API}/mis-refugios`,{headers:{Authorization:`Bearer ${token}`}});
  const j=await r.json();
  if(!j.exito){alert(j.mensaje||'No se pudo verificar tu perfil.');window.location.href='animales.html';return false;}
  if(!(j.refugios||[]).length){alert('Esta función está disponible únicamente para refugios aprobados.');window.location.href='animales.html';return false;}
  return true;
 }catch(e){alert('No se pudo verificar el acceso al registro de animales.');window.location.href='animales.html';return false;}
}

async function cargarRefugioContexto(){
  try{
    const params=new URLSearchParams(location.search);
    const solicitado=Number(params.get('refugio'))||null;
    const r=await fetch(`${API}/mis-refugios`,{headers:{Authorization:`Bearer ${token}`}});
    const j=await r.json();
    const refugios=j.refugios||[];
    if(!refugios.length){showAlert('No tienes un refugio aprobado asociado a tu cuenta.');return false;}
    const refugio=solicitado ? refugios.find(x=>Number(x.id_refugio)===solicitado) : refugios[0];
    if(!refugio){showAlert('El refugio seleccionado no pertenece a tu cuenta.');return false;}
    $('id_refugio').value=refugio.id_refugio;
    $('refugio-contexto').innerHTML=`🏠 Registrando en <strong>${escapeHtml(refugio.nombre_refugio)}</strong> · ${escapeHtml(refugio.localidad)}`;
    return true;
  }catch(e){showAlert('No se pudo cargar el refugio asociado.');return false;}
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function showAlert(m){$('alert').textContent=m;$('alert').style.display='block';}
function clearErrors(){document.querySelectorAll('.error').forEach(e=>e.textContent='');$('alert').style.display='none';}
$('form-animal').addEventListener('submit',async e=>{
 e.preventDefault();clearErrors();
 const data={id_refugio:Number($('id_refugio').value),nombre:$('nombre').value,raza:$('raza').value,sexo:$('sexo').value,edad:$('edad').value,tamano:$('tamano').value,color:$('color').value,descripcion:$('descripcion').value,estado_salud:$('estado_salud').value,fotos_urls:$('fotos_urls').value};
 const btn=$('submit');btn.disabled=true;
 try{
  const r=await fetch(`${API}/animales`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)});
  const j=await r.json();
  if(!j.exito){if(j.errores)Object.entries(j.errores).forEach(([k,v])=>{if($(`e-${k}`))$(`e-${k}`).textContent=v});if(j.errores?._global)showAlert(j.errores._global);return;}
  $('form-animal').style.display='none';$('success').style.display='block';$('success-text').textContent=`${j.animal.nombre} fue registrado en ${j.animal.nombre_refugio} y ahora aparece como disponible para adopción.`;
 }catch(err){showAlert('No se pudo conectar con el servidor.');}finally{btn.disabled=false;}
});
function cerrarSesion(){sessionStorage.clear();localStorage.removeItem('token');localStorage.removeItem('usuario');location.href='login.html';}
verificarAccesoRefugio().then(ok=>{if(ok)cargarRefugioContexto();});
