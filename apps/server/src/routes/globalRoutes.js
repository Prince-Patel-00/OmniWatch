import express from 'express';
import { orchestrator } from '../providers/ProviderOrchestrator.js';
import { addMediaSource, deleteMediaSource } from '../db.js';

const router = express.Router();

// GET /api/global/trending
router.get('/trending', async (req, res) => {
  try {
    const { type = 'All', sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All', character = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
    
    let items;
    if (character && character.trim()) {
      items = await orchestrator.search('', {
        character,
        type,
        sort,
        genre,
        animeFormat: animeFormat !== 'All' ? animeFormat : format,
        page: pageNum,
        limit: limitNum,
        mainCharOnly: true
      });
    } else {
      items = await orchestrator.getTrending({
        type,
        sort,
        animeFormat: animeFormat !== 'All' ? animeFormat : format,
        page: pageNum,
        limit: limitNum,
        genre
      });
    }

    res.json({
      success: true,
      data: items,
      count: items.length,
      page: pageNum,
      limit: limitNum,
      hasMore: items.length > 0
    });
  } catch (err) {
    console.error('Error fetching trending:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/global/upcoming
router.get('/upcoming', async (req, res) => {
  try {
    const { type = 'All', sort = 'release_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, genre = 'All' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
    const items = await orchestrator.getUpcoming({
      type,
      sort,
      animeFormat: animeFormat !== 'All' ? animeFormat : format,
      page: pageNum,
      limit: limitNum,
      genre
    });
    res.json({
      success: true,
      data: items,
      count: items.length,
      page: pageNum,
      limit: limitNum,
      hasMore: items.length > 0
    });
  } catch (err) {
    console.error('Error fetching upcoming:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/global/search
router.get('/search', async (req, res) => {
  try {
    const { q = '', type = 'All', genre = 'All', year = null, sort = 'popularity_desc', animeFormat = 'All', format = 'All', page = 1, limit = 24, character = '', searchMode = 'all', mainCharOnly = false } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 24));
    const items = await orchestrator.search(q, {
      type,
      genre,
      year,
      sort,
      animeFormat: animeFormat !== 'All' ? animeFormat : format,
      page: pageNum,
      limit: limitNum,
      character,
      searchMode,
      mainCharOnly: mainCharOnly === 'true' || mainCharOnly === true
    });
    res.json({
      success: true,
      data: items,
      count: items.length,
      page: pageNum,
      limit: limitNum,
      hasMore: items.length >= limitNum
    });
  } catch (err) {
    console.error('Error in search:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/global/characters (Discover leading and popular characters)
router.get('/characters', (req, res) => {
  try {
    const { type = 'All', search = '', limit = 30 } = req.query;
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));
    const characters = orchestrator.getPopularCharacters({
      type,
      search,
      limit: limitNum
    });
    res.json({
      success: true,
      data: characters,
      count: characters.length
    });
  } catch (err) {
    console.error('Error in characters endpoint:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/global/media/:id
router.get('/media/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await orchestrator.getDetail(id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('Error fetching media detail:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/global/media/:id/refresh
router.post('/media/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await orchestrator.getDetail(id, { forceRefresh: true });
    res.json({ success: true, data: item, message: 'Refreshed from upstream providers' });
  } catch (err) {
    console.error('Error refreshing media:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/global/media/:id/sources (Add custom mirror link)
router.post('/media/:id/sources', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = addMediaSource(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    res.json({ success: true, data: updated, message: 'Mirror source link added' });
  } catch (err) {
    console.error('Error adding mirror source:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/global/media/:id/sources/:sourceId (Delete mirror link)
router.delete('/media/:id/sources/:sourceId', async (req, res) => {
  try {
    const { id, sourceId } = req.params;
    const updated = deleteMediaSource(id, sourceId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }
    res.json({ success: true, data: updated, message: 'Mirror source link deleted' });
  } catch (err) {
    console.error('Error deleting mirror source:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
