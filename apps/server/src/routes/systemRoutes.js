import express from 'express';
import { orchestrator } from '../providers/ProviderOrchestrator.js';
import { getCatalogStats } from '../db.js';

const router = express.Router();

router.get('/status', (req, res) => {
  try {
    const providers = orchestrator.getProviderStatus();
    const stats = getCatalogStats();

    res.json({
      success: true,
      service: 'OmniWatch Entertainment Hub Server',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      database: {
        engine: 'SQLite (node:sqlite WAL mode)',
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
