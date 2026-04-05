const router = require('express').Router();
const tiktokService = require('../services/tiktokService');
const { normalizeTikTok } = require('../models/normalize');
const logger = require('../config/logger');

// GET /api/tiktok/campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const { page, pageSize } = req.query;
    const list    = await tiktokService.getCampaigns({ page, pageSize });
    const ids     = list.map(c => c.campaign_id);
    const metrics = ids.length ? await tiktokService.getCampaignMetrics(ids) : [];

    // Merge metrics into each campaign
    const metricsMap = Object.fromEntries(metrics.map(m => [m.dimensions?.campaign_id, m.metrics]));
    const merged = list.map(c => ({ ...c, metrics: metricsMap[c.campaign_id] || {} }));
    const data   = merged.map(normalizeTikTok);

    res.json({ platform: 'tiktok', count: data.length, data });
  } catch (err) {
    logger.error('TikTok getCampaigns error: ' + err.message);
    next(err);
  }
});

// POST /api/tiktok/campaigns
router.post('/campaigns', async (req, res, next) => {
  try {
    const { name, objectiveType, budget, budgetMode } = req.body;
    if (!name || !objectiveType || !budget) {
      return res.status(400).json({ error: 'name, objectiveType and budget are required' });
    }
    const data = await tiktokService.createCampaign({ name, objectiveType, budget, budgetMode });
    res.status(201).json({ platform: 'tiktok', data });
  } catch (err) { next(err); }
});

// PATCH /api/tiktok/campaigns/:id
router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const data = await tiktokService.updateCampaign(req.params.id, req.body);
    res.json({ platform: 'tiktok', data });
  } catch (err) { next(err); }
});

// PATCH /api/tiktok/campaigns/:id/status
router.patch('/campaigns/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body; // 'ENABLE' | 'DISABLE'
    if (!['ENABLE', 'DISABLE'].includes(status)) {
      return res.status(400).json({ error: 'status must be ENABLE or DISABLE' });
    }
    const data = await tiktokService.setCampaignStatus(req.params.id, status);
    res.json({ platform: 'tiktok', data });
  } catch (err) { next(err); }
});

module.exports = router;
