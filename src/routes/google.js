const router = require('express').Router();
const googleService = require('../services/googleService');
const { normalizeGoogle } = require('../models/normalize');
const logger = require('../config/logger');

// GET /api/google/campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const raw  = await googleService.getCampaigns({ startDate, endDate });
    const data = raw.map(normalizeGoogle);
    res.json({ platform: 'google', count: data.length, data });
  } catch (err) {
    logger.error('Google getCampaigns error: ' + err.message);
    next(err);
  }
});

// POST /api/google/campaigns
router.post('/campaigns', async (req, res, next) => {
  try {
    const { name, channelType, status, budgetAmountMicros, startDate, endDate } = req.body;
    if (!name || !budgetAmountMicros) {
      return res.status(400).json({ error: 'name and budgetAmountMicros are required' });
    }
    const data = await googleService.createCampaign({ name, channelType, status, budgetAmountMicros, startDate, endDate });
    res.status(201).json({ platform: 'google', data });
  } catch (err) { next(err); }
});

// PATCH /api/google/campaigns/:id
router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const data = await googleService.updateCampaign(req.params.id, req.body);
    res.json({ platform: 'google', data });
  } catch (err) { next(err); }
});

// PATCH /api/google/campaigns/:id/status
router.patch('/campaigns/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ENABLED', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ENABLED or PAUSED' });
    }
    const data = await googleService.setCampaignStatus(req.params.id, status);
    res.json({ platform: 'google', data });
  } catch (err) { next(err); }
});

module.exports = router;
