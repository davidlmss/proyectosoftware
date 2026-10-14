# RefugiosBogotá — Instrucciones de instalación

## Estructura del repositorio

```
refugios-bogota/
├── frontend/
│   ├── index.html        ← landing page
│   ├── registro.html     ← formulario de registro
│   ├── styles.css        ← estilos compartidos
│   ├── registro.js       ← lógica del formulario (fetch al backend)
│   └── landing.js        ← animaciones de la landing
└── backend/
    ├── server.js         ← servidor Express
    ├── db.js             ← conexión SQLite + creación de tablas
    ├── schema.sql        ← referencia del diseño lógico
    ├── package.json      ← dependencias
    ├── .env              ← variables de entorno
    ├── routes/
    │   └── auth.js       ← rutas /api/registro
    └── controllers/
        └── registroController.js  ← lógica de negocio
```

---

## Instalación (una sola vez)

### 1. Instalar Node.js
Descargar desde https://nodejs.org (versión LTS)
Verificar en terminal: `node --version`

### 2. Instalar dependencias del backend
```bash
cd backend
npm install
```

Esto instala: express, better-sqlite3, bcrypt, cors, dotenv

---

## Correr el proyecto

### Terminal en VS Code (Ctrl + `)
```bash
cd backend
node server.js
```

Verás:
```
🐾 RefugiosBogotá corriendo en http://localhost:3000
   API: http://localhost:3000/api/registro
```

### Abrir en el navegador
http://localhost:3000

---

## Verificar que los registros se guardan

Después de registrar un usuario, abre:
http://localhost:3000/api/usuarios

Verás todos los usuarios guardados en la base de datos.

---

## Notas

- La base de datos `database.db` se crea automáticamente la primera vez
- El archivo `database.db` está en `.gitignore` (no se sube a GitHub)
- Para desarrollo con recarga automática: `npx nodemon server.js`

## Confirmación de correo electrónico

El registro requiere confirmar el correo antes de iniciar sesión. El enlace tiene un token válido durante 24 horas y se envía mediante SMTP de Gmail.

Configura en `Backend/.env`:

```env
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion
APP_URL=http://localhost:3000
PUBLIC_URL=http://192.168.1.20:3000
```

`EMAIL_PASSWORD` debe ser una contraseña de aplicación de Google, no la contraseña normal de Gmail. `PUBLIC_URL` debe ser una dirección accesible desde el computador donde se abrirá el correo.

## Administración y permisos

La cuenta inicial es **Administrador General** (`admin@refugiosbogota.local`). Para crear otra cuenta administrativa: `node crear-admin.js "Nombre" "Apellido" "correo@ejemplo.com" "ContraseñaSegura123"`. También se puede crear un administrador desde `admin.html` → **Usuarios — CRUD**.

El sistema distingue **Adoptante**, **Refugio** y **Administrador**. Los permisos de API se controlan mediante sesión y rol. El detalle completo de permisos, CRUD y configuración está en `../README_CORRECCIONES.md`.
