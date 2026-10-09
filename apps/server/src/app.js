import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

// Load .env environment variables (native Node 20+)
if (typeof process.loadEnvFile === 'function') {
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'apps/server/.env')
  ];
  for (const envPath of envCandidates) {
    try {
      if (fs.existsSync(envPath)) {
        process.loadEnvFile(envPath);
        break;
      }
    } catch (e) {}
  }
}

import { initDB, isNeon } from './db.js';
import authRoutes from './routes/authRoutes.js';
import globalRoutes from './routes/globalRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import mirrorRoutes from './routes/mirrorRoutes.js';

const app = express();

let dbInitPromise = null;
export async function ensureDB() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const dbType = isNeon() ? 'Neon PostgreSQL (Serverless)' : 'Local SQLite';
      console.log(`[DB] Initializing database engine: ${dbType}`);
      return initDB();
    })();
  }
  return dbInitPromise;
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Ensure DB is initialized before processing API routes
app.use(async (req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (err) {
    console.error('Failed to initialize database connection:', err);
    res.status(500).json({ success: false, error: 'Database initialization failed: ' + err.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/global', globalRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/mirrors', mirrorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OmniWatch Unified Hub API',
    version: '2.0.0',
    database: isNeon() ? 'Neon Serverless PostgreSQL' : 'SQLite (node:sqlite WAL mode)',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

export default app;
