const router = require('express').Router();
const snapService = require('../services/snapchatService');
const { normalizeSnapchat } = require('../models/normalize');
const logger = require('../config/logger');

// GET /api/snapchat/campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const list = await snapService.getCampaigns();

    // Attach stats to each campaign
    const withStats = await Promise.all(
      list.map(async (c) => {
        try {
          const stats = await snapService.getCampaignStats(c.id);
          return { ...c, stats };
        } catch {
          return { ...c, stats: {} };
        }
      })
    );

    const data = withStats.map(normalizeSnapchat);
    res.json({ platform: 'snapchat', count: data.length, data });
  } catch (err) {
    logger.error('Snapchat getCampaigns error: ' + err.message);
    next(err);
  }
});

// POST /api/snapchat/campaigns
router.post('/campaigns', async (req, res, next) => {
  try {
    const { name, objective, daily_budget_micro, start_time, end_time, status } = req.body;
    if (!name || !objective || !daily_budget_micro) {
      return res.status(400).json({ error: 'name, objective and daily_budget_micro are required' });
    }
    const data = await snapService.createCampaign({ name, objective, daily_budget_micro, start_time, end_time, status });
    res.status(201).json({ platform: 'snapchat', data });
  } catch (err) { next(err); }
});

// PATCH /api/snapchat/campaigns/:id
router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const data = await snapService.updateCampaign(req.params.id, req.body);
    res.json({ platform: 'snapchat', data });
  } catch (err) { next(err); }
});

// PATCH /api/snapchat/campaigns/:id/status
router.patch('/campaigns/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE or PAUSED' });
    }
    const data = await snapService.setCampaignStatus(req.params.id, status);
    res.json({ platform: 'snapchat', data });
  } catch (err) { next(err); }
});

module.exports = router;
