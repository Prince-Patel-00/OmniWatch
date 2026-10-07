import express from 'express';
import {
  getAllMirrorSources,
  upsertMirrorSource,
  updateMirrorSourceDomain,
  deleteMirrorSourceItem
} from '../db.js';
import {
  checkAllMirrors,
  checkMirrorSource,
  probeDomain
} from '../services/mirrorHealthService.js';

const router = express.Router();

/**
 * GET /api/mirrors
 * Returns all configured streaming and download mirror sources
 */
router.get('/', async (req, res) => {
  try {
    const mirrors = await getAllMirrorSources();
    res.json({
      success: true,
      count: mirrors.length,
      data: mirrors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mirrors/check
 * Triggers on-demand health verification for all mirrors or a single mirror by ID
 */
router.post('/check', async (req, res) => {
  try {
    const { id } = req.body || {};

    if (id) {
      const all = await getAllMirrorSources();
      const mirror = all.find((m) => m.id === id);
      if (!mirror) {
        return res.status(404).json({ success: false, error: `Mirror source "${id}" not found` });
      }

      const result = await checkMirrorSource(mirror);
      const updatedList = await getAllMirrorSources();
      return res.json({
        success: true,
        result,
        data: updatedList
      });
    }

    // Check all mirrors
    const summary = await checkAllMirrors();
    const updatedList = await getAllMirrorSources();
    return res.json({
      success: true,
      summary,
      data: updatedList
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mirrors/probe
 * Tests a raw domain before saving
 */
router.post('/probe', async (req, res) => {
  try {
    const { domain } = req.body || {};
    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domain is required' });
    }
    const result = await probeDomain(domain);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/mirrors
 * Create or replace a mirror source
 */
router.post('/', async (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.name || !item.currentDomain || !item.searchTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required mirror fields (name, currentDomain, searchTemplate)'
      });
    }

    if (!item.id) {
      item.id = `custom_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    }

    await upsertMirrorSource(item);
    const all = await getAllMirrorSources();
    const updated = all.find((m) => m.id === item.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/mirrors/:id
 * Partial update for a mirror source (e.g., active domain, enabled status)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const all = await getAllMirrorSources();
    const existing = all.find((m) => m.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: `Mirror source "${id}" not found` });
    }

    const updates = req.body || {};
    const merged = {
      ...existing,
      ...updates,
      id
    };

    await upsertMirrorSource(merged);

    // If new domain was supplied, optionally re-probe it
    if (updates.currentDomain && updates.currentDomain !== existing.currentDomain) {
      await checkMirrorSource(merged);
    }

    const updatedList = await getAllMirrorSources();
    const updated = updatedList.find((m) => m.id === id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/mirrors/:id
 * Deletes a mirror source
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteMirrorSourceItem(id);
    res.json({ success: true, message: `Mirror source "${id}" removed` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
