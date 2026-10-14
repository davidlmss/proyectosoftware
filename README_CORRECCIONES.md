# Correcciones solicitadas — RefugiosBogotá

## Cambios implementados

1. **Administrador identificable**
   - La cuenta inicial ahora aparece como **Administrador General**.
   - El panel muestra nombre y correo del administrador.
   - El tipo de usuario se muestra en la interfaz.

2. **Creación de administradores**
   - Primera cuenta: se crea automáticamente al iniciar una base nueva.
   - Script adicional: `Backend/crear-admin.js`.
   - Un administrador también puede crear otra cuenta con rol Administrador desde `admin.html`.

3. **CRUD de administración**
   - Usuarios: crear, consultar, editar y desactivar.
   - Refugios: consultar, editar y eliminar.
   - Solicitudes de refugio: consultar, aprobar y rechazar.
   - Un administrador no puede desactivar o eliminar su propia cuenta desde el panel.

4. **Tipo de usuario**
   - Adoptante, Refugio y Administrador.
   - Se muestra mediante una etiqueta visible y en `Mi perfil`.

5. **Edición de perfil personal**
   - Nuevo `perfil.html`.
   - Permite modificar nombre, apellido, localidad y contraseña.
   - El correo se mantiene como identificador de la cuenta.

6. **Registro de refugio sin perros iniciales**
   - Se eliminó el registro de perros durante la solicitud/creación del refugio.
   - Un refugio aprobado comienza con 0 perros registrados.
   - Los perros se agregan posteriormente desde `Registrar animal`.

7. **Equipo Humano**
   - Se reemplazó la denominación “Equipo de trabajo” por **Equipo Humano**.

8. **Estabilidad económica eliminada**
   - Se retiraron de la interfaz y lógica activa los campos de estabilidad económica, ingresos y egresos.
   - Las columnas antiguas que puedan existir en una base previamente creada no se utilizan por el sistema nuevo; esto evita perder datos históricos durante una migración de SQLite.

9. **Permisos y autorizaciones explícitos**
   - Se muestran opciones concretas para evitar interpretaciones ambiguas:
     - Permiso de funcionamiento.
     - Autorización sanitaria.
     - Registro o documento de constitución.
     - Autorización relacionada con protección animal.
     - Otro documento o autorización.
   - Se pueden adjuntar documentos de respaldo.

10. **Correo verificable desde otro computador**
    - El frontend dejó de depender de `http://localhost:3000/api` y utiliza rutas relativas `/api`.
    - El enlace enviado por correo utiliza `PUBLIC_URL`.
    - Para otra computadora, `PUBLIC_URL` debe ser una dirección que esa computadora pueda alcanzar.

## Crear administrador

Desde `Backend`:

```bash
node crear-admin.js "Nombre" "Apellido" "correo@ejemplo.com" "ContraseñaSegura123"
```

Ejemplo:

```bash
node crear-admin.js "Carlos" "Administrador" "carlos.admin@ejemplo.com" "AdminSeguro123!"
```

## Correo desde otro computador

En `Backend/.env` configurar, por ejemplo:

```env
PUBLIC_URL=http://192.168.1.20:3000
```

donde `192.168.1.20` es la IP del computador que ejecuta Node.js dentro de la red.

Si se publica en Internet:

```env
PUBLIC_URL=https://tu-dominio.com
```

Después de cambiar `.env`, reiniciar Node.js.

Para una red local, los dos computadores deben estar en la misma red y el firewall del computador servidor debe permitir el puerto 3000. Para Internet se necesita un dominio/hosting o una configuración de acceso público.

## Permisos y autorizaciones de la API

| Función | Acceso |
|---|---|
| Registro | Público |
| Inicio de sesión | Público |
| Verificación de correo | Público mediante token |
| Ver perros | Público |
| Ver refugios | Público |
| Editar perfil | Usuario autenticado |
| Solicitar refugio | Usuario autenticado |
| Registrar/editar perros | Refugio aprobado |
| Gestionar adopciones | Refugio aprobado |
| Aprobar/rechazar refugios | Administrador |
| CRUD de usuarios | Administrador |
| CRUD de refugios | Administrador |

## Solución del error de correo de confirmación

Si aparece el mensaje **“No se pudo enviar el correo de confirmación”**, el problema normalmente está en la configuración SMTP y no en el formulario de registro.

Configura en `Backend/.env`:

```env
EMAIL_USER=tu_cuenta@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion
```

La contraseña debe ser una **contraseña de aplicación de Google**. No se debe usar la contraseña normal de Gmail.

Antes de probar el registro se puede comprobar el servicio con:

```powershell
cd Backend
node test-correo.js correo_destino@gmail.com
```

El sistema ahora devuelve un mensaje específico cuando Gmail rechaza la autenticación, cuando no están configuradas las credenciales o cuando existe un problema de conexión.

## Reenvío de verificación de correo desde Administración

El panel `admin.html` ahora permite gestionar la verificación de correo de los usuarios.

### Cómo funciona

1. Entrar al panel con una cuenta cuyo rol sea `administrador`.
2. Abrir la pestaña **Usuarios — CRUD**.
3. Cada usuario muestra el estado **Correo confirmado** o **Correo pendiente de confirmación**.
4. Cuando el correo está pendiente y la cuenta está activa aparece el botón **Reenviar verificación**.
5. Al pulsarlo, el backend genera un token nuevo con vigencia de 24 horas y envía nuevamente el correo.
6. Si el envío falla, el token nuevo se elimina para no dejar un enlace pendiente que no haya sido enviado.

### Ruta agregada

```text
POST /api/admin/usuarios-crud/:id/reenviar-verificacion
```

La ruta solamente puede ser utilizada por un administrador autenticado.

### Requisito de correo

El reenvío utiliza la misma configuración SMTP de Gmail del registro normal:

```env
EMAIL_USER=tu_cuenta@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion
PUBLIC_URL=http://IP_DEL_SERVIDOR:3000
```

`EMAIL_PASSWORD` debe ser una contraseña de aplicación de Google y no la contraseña normal de Gmail.


## Versión 24 — ajustes de navegación y administración
- Se añadieron estilos explícitos al menú desplegable del administrador: oculto por defecto y visible al pulsar el botón.
- Se corrigió un error JavaScript en `admin.html`: se intentaba acceder a un elemento `admin-name` inexistente, deteniendo el resto del script antes de cargar los registros.
- Se inicia la carga de solicitudes, usuarios y refugios al abrir administración.
- El logo RefugiosBogotá lleva a `index.html` sin borrar token ni usuario almacenados.
- El menú de Adoptar muestra el nombre de la sesión cuando está disponible.
