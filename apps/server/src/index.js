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

import { initDB } from './db.js';
import globalRoutes from './routes/globalRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import mirrorRoutes from './routes/mirrorRoutes.js';
import { startPeriodicMirrorChecks } from './services/mirrorHealthService.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize SQLite Relational Database
initDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// API Routes
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
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🎬 OmniWatch Server 2.0 running at http://localhost:${PORT}`);
  console.log(`🌍 Global API: http://localhost:${PORT}/api/global`);
  console.log(`📚 Catalog API: http://localhost:${PORT}/api/catalog`);
  console.log(`⚙️ System API: http://localhost:${PORT}/api/system`);
  console.log(`🌐 Mirrors API: http://localhost:${PORT}/api/mirrors`);
  
  // Start non-blocking periodic health check for mirror domains
  startPeriodicMirrorChecks();
});
