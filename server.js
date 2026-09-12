require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const pool = require('./db');
const routes = require('./routes');
const { errorHandler } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3005;

// Ensure upload directories exist
fs.mkdirSync(path.join(__dirname, 'uploads/parts'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads/commissions'), { recursive: true });

// Bulletproof CORS Configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Explicit fallback CORS middleware for all incoming requests and preflights
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Helper for serving uploads with fallback between commissions and parts
function handleUploadStatic(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  const { folder, filename } = req.params;
  const targetPath = path.join(__dirname, 'uploads', folder, filename);
  if (fs.existsSync(targetPath)) {
    return res.sendFile(targetPath);
  }
  // Fallback: If requested in commissions but saved in parts
  if (folder === 'commissions') {
    const fallbackPath = path.join(__dirname, 'uploads', 'parts', filename);
    if (fs.existsSync(fallbackPath)) {
      return res.sendFile(fallbackPath);
    }
  }
  next();
}

const staticOptions = {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
};

app.get('/uploads/:folder/:filename', handleUploadStatic);
app.get('/api/uploads/:folder/:filename', handleUploadStatic);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));

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
