const path = require('path');
const express = require('express');
require('./src/db'); // garante que o banco/tabelas existam antes de subir o servidor

const bookingRoutes = require('./src/routes/booking');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', bookingRoutes);

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'NOT_FOUND' });
  next();
});

app.listen(PORT, () => {
  console.log(`Essence Pause rodando em http://localhost:${PORT}`);
});
