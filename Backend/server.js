require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { iniciarDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
// El registro de refugios puede incluir documentos codificados en Base64.
// Se permite un payload amplio, manteniendo un límite por archivo en el frontend.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../Frontend')));

app.use('/api', require('./routes/auth'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Ruta no encontrada.' });
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// Iniciar BD primero, luego el servidor
iniciarDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🐾 RefugiosBogotá corriendo en http://localhost:${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   API:      http://localhost:${PORT}/api/registro`);
    console.log(`   Usuarios: http://localhost:${PORT}/api/usuarios\n`);
  });
}).catch(err => {
  console.error('[ERROR] No se pudo iniciar la base de datos:', err);
});
