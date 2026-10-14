'use strict';
const LOCALIDADES_BOGOTA = Object.freeze([
  'usaquen','chapinero','santa_fe','san_cristobal','usme','tunjuelito','bosa','kennedy','fontibon','engativa',
  'suba','barrios_unidos','teusaquillo','los_martires','antonio_narino','puente_aranda','candelaria','rafael_uribe',
  'ciudad_bolivar','sumapaz'
]);
function localidadValida(valor){ return LOCALIDADES_BOGOTA.includes(String(valor||'').trim().toLowerCase()); }
module.exports={LOCALIDADES_BOGOTA,localidadValida};
