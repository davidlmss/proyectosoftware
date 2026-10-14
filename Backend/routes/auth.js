/**
 * routes/auth.js
 * Enrutador principal de la API
 * Sprint 2: rutas CU #4 y CU #5
 * Sprint 3: rutas CU #6 (Reportar Animal)
 *
 * IMPORTANTE: /mis-refugios debe declararse ANTES de /refugios/:id
 */

const express       = require('express');
const router        = express.Router();
const registro      = require('../controllers/registroController');
const loginCtrl     = require('../controllers/loginController');
const refugioCtrl   = require('../controllers/registroRefugioController');
const reporteCtrl   = require('../controllers/reporteAnimalController');   // CU #6
const animalCtrl    = require('../controllers/animalController');          // CU #7
const rolesCtrl     = require('../controllers/rolesController');
const verificacion  = require('../controllers/verificacionController');
const perfilCtrl     = require('../controllers/perfilController');
const adminCtrl      = require('../controllers/adminController');

// ── Sprint 1: Gestión de Usuarios ────────────────────────────────
router.post('/registro',        registro.registroManual);
router.post('/registro-social', registro.registroSocial);
router.post('/login',           loginCtrl.login);
router.get('/verificar-correo', verificacion.verificarCorreo);
router.get('/usuarios',         registro.listarUsuarios);
router.get('/perfil',            perfilCtrl.obtenerPerfil);
router.put('/perfil',            perfilCtrl.actualizarPerfil);

// ── Sprint 2 CU #4: Registro de Perfil de Refugio ────────────────
router.post('/registro-refugio', rolesCtrl.solicitarRefugio);
router.post('/solicitud-refugio', rolesCtrl.solicitarRefugio);
router.get('/mi-solicitud-refugio', rolesCtrl.miSolicitud);
router.get('/admin/solicitudes-refugio', rolesCtrl.listarSolicitudes);
router.patch('/admin/solicitudes-refugio/:id', rolesCtrl.resolverSolicitud);
router.get('/admin/usuarios', rolesCtrl.listarUsuariosAdmin);
router.get('/admin/usuarios-crud', adminCtrl.listarUsuarios);
router.post('/admin/usuarios-crud', adminCtrl.crearUsuario);
router.put('/admin/usuarios-crud/:id', adminCtrl.actualizarUsuario);
router.delete('/admin/usuarios-crud/:id', adminCtrl.eliminarUsuario);
router.post('/admin/usuarios-crud/:id/reenviar-verificacion', adminCtrl.reenviarVerificacion);
router.get('/admin/refugios-crud', adminCtrl.listarRefugios);
router.post('/admin/refugios-crud', adminCtrl.crearRefugio);
router.put('/admin/refugios-crud/:id', adminCtrl.actualizarRefugioAdmin);
router.delete('/admin/refugios-crud/:id', adminCtrl.eliminarRefugio);

// GET /api/refugios — listar todos (público)
router.get('/refugios',          refugioCtrl.listarRefugios);

// ── Sprint 2 CU #5: Gestión y Edición de Perfil de Refugio ───────
// /mis-refugios ANTES de /refugios/:id — orden obligatorio en Express
router.get('/mis-refugios',      refugioCtrl.getMisRefugios);
router.get('/refugios/:id',      refugioCtrl.getRefugioById);
router.put('/refugios/:id',      refugioCtrl.actualizarRefugio);

// ── Sprint 3 CU #6: Reportar Animal ──────────────────────────────
router.post('/reportes',         reporteCtrl.crearReporte);
router.get('/mis-reportes',      reporteCtrl.listarMisReportes);
router.get('/reportes/publicos', reporteCtrl.listarReportesPublicos);
router.get('/refugio/reportes', reporteCtrl.listarReportesRefugio);
router.patch('/refugio/reportes/:id/estado', reporteCtrl.actualizarEstadoReporte);
router.post('/refugio/reportes/:id/registrar-animal', reporteCtrl.registrarAnimalDesdeReporte);

// ── Sprint 4 CU #7: Gestión de animales y adopciones ─────────────
router.post('/animales',            animalCtrl.registrarAnimal);
router.get('/animales',             animalCtrl.listarAnimales);
router.get('/mis-animales',         animalCtrl.listarMisAnimales);
router.get('/mis-animales/:id',     animalCtrl.obtenerAnimalPropio);
router.put('/mis-animales/:id',     animalCtrl.actualizarAnimal);

router.post('/adopciones',          animalCtrl.solicitarAdopcion);
router.get('/mis-adopciones',       animalCtrl.listarMisAdopciones);
router.patch('/adopciones/:id/estado', animalCtrl.actualizarEstadoAdopcion);
router.get('/refugio/adopciones', animalCtrl.listarAdopcionesRefugio);
router.get('/adopciones/:id/mensajes', animalCtrl.listarMensajesAdopcion);
router.post('/adopciones/:id/mensajes', animalCtrl.enviarMensajeAdopcion);

module.exports = router;
