const API='/api';
const token=sessionStorage.getItem('token')||localStorage.getItem('token');
if(!token) location.href='login.html';
const $=id=>document.getElementById(id);
const idAnimal=Number(new URLSearchParams(location.search).get('id'));
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function showAlert(m){$('alert').textContent=m;$('alert').style.display='block';}
function clearErrors(){document.querySelectorAll('.error').forEach(e=>e.textContent='');$('alert').style.display='none';}
async function cargar(){
 if(!idAnimal){showAlert('Animal inválido.');return;}
 try{
  const r=await fetch(`${API}/mis-animales/${idAnimal}`,{headers:{Authorization:`Bearer ${token}`}}),j=await r.json();
  if(!j.exito){showAlert(j.mensaje||'No se pudo cargar el perro.');return;}
  const a=j.animal;
  $('id_refugio').value=a.id_refugio;
  $('refugio-contexto').textContent=`🏠 ${a.nombre_refugio || 'Refugio asociado'}`;$('nombre').value=a.nombre||'';$('raza').value=a.raza||'';$('sexo').value=a.sexo||'no_determinado';$('edad').value=a.edad||'';$('tamano').value=a.tamano||'';$('color').value=a.color||'';$('descripcion').value=a.descripcion||'';$('estado_salud').value=a.estado_salud||'estable';
  try{$('fotos_urls').value=JSON.parse(a.fotos_urls||'[]').join(', ')}catch(e){$('fotos_urls').value=a.fotos_urls||''}
 }catch(e){showAlert('No se pudo conectar con el servidor.');}
}
$('form-animal').addEventListener('submit',async e=>{e.preventDefault();clearErrors();const data={id_refugio:Number($('id_refugio').value),nombre:$('nombre').value,raza:$('raza').value,sexo:$('sexo').value,edad:$('edad').value,tamano:$('tamano').value,color:$('color').value,descripcion:$('descripcion').value,estado_salud:$('estado_salud').value,fotos_urls:$('fotos_urls').value};const btn=$('submit');btn.disabled=true;try{const r=await fetch(`${API}/mis-animales/${idAnimal}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(data)}),j=await r.json();if(!j.exito){if(j.errores)Object.entries(j.errores).forEach(([k,v])=>{if($(`e-${k}`))$(`e-${k}`).textContent=v});if(j.errores?._global)showAlert(j.errores._global);return;}$('form-animal').style.display='none';$('success').style.display='block';$('success-text').textContent=`${j.animal.nombre} fue actualizado correctamente.`}catch(e){showAlert('No se pudo conectar con el servidor.')}finally{btn.disabled=false}});
function cerrarSesion(){sessionStorage.clear();localStorage.clear();location.href='login.html';}
cargar();
