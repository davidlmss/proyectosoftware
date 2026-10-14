# Confirmación de correo con Gmail

El registro de usuarios necesita enviar un correo de confirmación. El proyecto usa Gmail por SMTP seguro.

## 1. Configurar Gmail

1. Usa una cuenta Gmail para el proyecto.
2. Activa la verificación en dos pasos de esa cuenta.
3. En la seguridad de Google crea una **contraseña de aplicación**.
4. Abre `Backend/.env`.
5. Configura:

```env
EMAIL_USER=tu_cuenta@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

`EMAIL_PASSWORD` debe ser la contraseña de aplicación de Google. **No uses la contraseña normal de Gmail.**

## 2. Configurar el enlace que recibirá el usuario

Si el usuario abrirá el correo desde otro computador de la misma red, coloca la IP del computador donde corre Node.js:

```env
PUBLIC_URL=http://192.168.1.20:3000
```

Reemplaza `192.168.1.20` por la IP real del servidor.

Si el sistema estará publicado en Internet:

```env
PUBLIC_URL=https://tudominio.com
```

No uses `localhost` si el enlace debe abrirse desde otro computador.

## 3. Probar el correo antes de registrar usuarios

Desde `Backend`:

```powershell
node test-correo.js correo_destino@gmail.com
```

Si funciona aparecerá:

```text
Correo enviado correctamente.
```

Si falla, el mensaje indicará si el problema es la autenticación de Gmail, la conexión o la configuración de `.env`.

## 4. Ejecutar el sistema

```powershell
node server.js
```

Después registra un usuario.

## 5. Importante para otros computadores

El computador que recibe el correo debe poder abrir `PUBLIC_URL`. Si usas una IP local, ambos equipos deben estar en una red que permita la comunicación y el firewall de Windows debe permitir el puerto 3000.
