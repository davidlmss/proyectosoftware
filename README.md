# RefugiosBogotá — actualización funcional

## Cambios incluidos

1. La plataforma trabaja únicamente con **perros**. Se eliminan registros históricos de gatos/otras especies de animales y reportes al iniciar la BD, y los formularios/API solo aceptan `perro`.
2. Los reportes ciudadanos son independientes de los refugios. Un usuario autenticado puede reportar un perro aunque no exista una fundación en la localidad.
3. Los reportes se notifican a los refugios de la localidad y los refugios aprobados pueden consultarlos por localidad o por notificación.
4. Un refugio aprobado puede registrar animales directamente desde `registrar-animal.html` o convertir un reporte en animal de su refugio.
5. En `Mis refugios` se añadieron:
   - Reportes recibidos
   - Mis animales
   - Solicitudes de adopción
6. Las solicitudes de adopción llegan al panel del refugio y pueden aprobarse, rechazarse o marcarse como completadas.
7. Los animales con una solicitud en proceso **siguen apareciendo** en la sección de adopción con el estado `Solicitud en proceso`.
8. Los reportes públicos ya no muestran el botón redundante de “Reportar un animal” dentro de cada tarjeta.

## Ejecución

### Backend
```bash
cd Backend
npm install
node server.js
```

### Frontend
Con el backend ejecutándose, abrir `http://localhost:3000`.

La base de datos incluida se actualizó para eliminar registros de especies distintas a perro.
