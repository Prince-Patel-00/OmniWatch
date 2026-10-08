import express from 'express';
import {
  getCatalogItems,
  getCatalogItem,
  getCatalogItemByCanonicalId,
  upsertCatalogItem,
  deleteCatalogItem,
  toggleEpisodeProgress,
  batchSetSeasonProgress,
  setSeasonsCompleted,
  getCatalogStats,
  exportCatalogData,
  importCatalogData,
  getCanonicalMedia,
  getCatalogCharacters
} from '../db.js';
import { authMiddleware } from '../auth.js';

const router = express.Router();

// Apply auth middleware to resolve authenticated user or fallback
router.use(authMiddleware);

// GET /api/catalog
router.get('/', async (req, res) => {
  try {
    const { status, type, sort, favorite, search, genre, animeFormat, format, character, page, limit, excludeIds = '' } = req.query;
    const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : undefined;
    const limitNum = limit ? Math.max(1, Math.min(100, parseInt(limit, 10) || 24)) : undefined;

    const items = await getCatalogItems({
      status: status || 'All',
      type: type || 'All',
      sort: sort || 'updated_desc',
      favoriteOnly: favorite === 'true',
      search: search || '',
      character: character || '',
      genre: genre || 'All',
      animeFormat: animeFormat || format || 'All',
      page: pageNum,
      limit: limitNum,
      excludeIds,
      userId: req.userId
    });
    res.json({
      success: true,
      data: items,
      count: items.length,
      page: pageNum || 1,
      limit: limitNum || items.length,
      hasMore: limitNum ? items.length >= limitNum : false
    });
  } catch (err) {
    console.error('Error fetching catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/characters
router.get('/characters', async (req, res) => {
  try {
    const { limit = 25 } = req.query;
    const characters = await getCatalogCharacters({ limit: parseInt(limit, 10) || 25 });
    res.json({ success: true, data: characters });
  } catch (err) {
    console.error('Error fetching catalog characters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCatalogStats(req.userId);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching catalog stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/check/:canonicalId
router.get('/check/:canonicalId', async (req, res) => {
  try {
    const { canonicalId } = req.params;
    const item = await getCatalogItemByCanonicalId(canonicalId, req.userId);
    res.json({
      success: true,
      inCatalog: Boolean(item),
      catalogItem: item || null
    });
  } catch (err) {
    console.error('Error checking catalog item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/export
router.get('/backup/export', async (req, res) => {
  try {
    const backup = await exportCatalogData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=omniwatch-backup-${Date.now()}.json`);
    res.json(backup);
  } catch (err) {
    console.error('Error exporting catalog backup:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog/import
router.post('/backup/import', async (req, res) => {
  try {
    const result = await importCatalogData(req.body);
    res.json({ success: true, message: `Successfully restored ${result.importedCount || result.count} items.` });
  } catch (err) {
    console.error('Error importing catalog backup:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/:id
router.get('/:id', async (req, res) => {
  try {
    const item = await getCatalogItem(req.params.id, req.userId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Catalog item not found' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('Error fetching catalog item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog - Add or update title in catalog
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.canonicalId || !payload.title) {
      return res.status(400).json({ success: false, error: 'canonicalId and title are required.' });
    }

    // Try to enrich from canonical media if missing poster or backdrop
    if (!payload.posterUrl || !payload.backdropUrl) {
      const canonical = await getCanonicalMedia(payload.canonicalId);
      if (canonical) {
        payload.posterUrl = payload.posterUrl || canonical.posterUrl;
        payload.backdropUrl = payload.backdropUrl || canonical.backdropUrl;
        payload.releaseYear = payload.releaseYear || canonical.releaseYear;
        payload.mediaType = payload.mediaType || canonical.mediaType;
        payload.totalEpisodes = payload.totalEpisodes || canonical.totalEpisodes;
      }
    }

    const saved = await upsertCatalogItem({ ...payload, userId: req.userId }, req.userId);
    res.json({ success: true, data: saved, message: `Saved "${saved.title}" to catalog.` });
  } catch (err) {
    console.error('Error saving to catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/catalog/:id - Update status, rating, notes, favorite
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getCatalogItem(id, req.userId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Catalog item not found' });
    }

    const updated = await upsertCatalogItem({
      ...existing,
      ...req.body,
      id,
      userId: req.userId
    }, req.userId);

    res.json({ success: true, data: updated, message: 'Updated catalog item.' });
  } catch (err) {
    console.error('Error updating catalog item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/catalog/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await deleteCatalogItem(id, req.userId);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Item not found in catalog.' });
    }
    res.json({ success: true, message: 'Removed title from catalog.' });
  } catch (err) {
    console.error('Error deleting catalog item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog/:id/progress - Toggle or set episode progress
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { seasonNumber = 1, episodeNumber, isWatched = true } = req.body;

    if (!episodeNumber) {
      return res.status(400).json({ success: false, error: 'episodeNumber is required.' });
    }

    const updated = await toggleEpisodeProgress(id, parseInt(seasonNumber, 10), parseInt(episodeNumber, 10), Boolean(isWatched), req.userId);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating episode progress:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog/:id/batch-progress - Mark whole season as watched / unwatched
router.post('/:id/batch-progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { seasonNumber = 1, episodeCount = 12, isWatched = true } = req.body;

    const updated = await batchSetSeasonProgress(
      id,
      parseInt(seasonNumber, 10),
      parseInt(episodeCount, 10),
      Boolean(isWatched),
      req.userId
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error in batch progress update:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog/:id/seasons - Update completed seasons count and optional status
router.post('/:id/seasons', async (req, res) => {
  try {
    const { id } = req.params;
    const { seasonsCompleted, userStatus, syncEpisodes = true, currentSeason, totalSeasons } = req.body;

    if (seasonsCompleted === undefined || seasonsCompleted === null) {
      return res.status(400).json({ success: false, error: 'seasonsCompleted is required.' });
    }

    const updated = await setSeasonsCompleted(
      id,
      parseInt(seasonsCompleted, 10),
      {
        userStatus,
        syncEpisodes: Boolean(syncEpisodes),
        currentSeason: currentSeason ? parseInt(currentSeason, 10) : undefined,
        totalSeasons: totalSeasons ? parseInt(totalSeasons, 10) : undefined,
        userId: req.userId
      }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Catalog item not found.' });
    }

    res.json({ success: true, data: updated, message: `Updated completed seasons to ${seasonsCompleted}.` });
  } catch (err) {
    console.error('Error updating seasons completed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
