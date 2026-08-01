require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const pool = require('./db');
const routes = require('./routes');
const { errorHandler } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
fs.mkdirSync(path.join(__dirname, 'uploads/parts'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads/commissions'), { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => res.json({ message: "Phone Parts Finder API is running" }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.use('/api', routes);
app.use(errorHandler);

pool.query('SELECT 1')
  .then(() => {
    console.log('Database connected successfully.');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  })
  .catch(error => {
    console.error('Database connection failed. Server startup aborted.', error);
    process.exit(1);
  });
