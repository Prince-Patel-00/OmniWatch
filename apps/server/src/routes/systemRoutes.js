import express from 'express';
import { orchestrator } from '../providers/ProviderOrchestrator.js';
import { getCatalogStats } from '../db.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const providers = orchestrator.getProviderStatus();
    const stats = await getCatalogStats();
    const isNeon = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

    res.json({
      success: true,
      service: 'OmniWatch Entertainment Hub Server',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      database: {
        engine: isNeon ? 'Neon Serverless PostgreSQL' : 'SQLite (node:sqlite WAL mode)',
        status: 'online',
        trackedTitlesCount: stats.totalTitles,
        watchedEpisodesCount: stats.watchedEpisodesCount
      },
      providers,
      tmdbConfigured: providers.tmdb.active
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
