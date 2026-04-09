const router = require('express').Router();
const metaService = require('../services/metaService');
const { normalizeMeta } = require('../models/normalize');
const logger = require('../config/logger');
const { requireUserSession } = require('../middleware/userSession');

router.use(requireUserSession);

// GET /api/meta/campaigns
router.get('/campaigns', async (req, res, next) => {
  try {
    const { status = 'ACTIVE', dateRange = '30d', startDate, endDate } = req.query;
    const raw  = await metaService.getCampaigns(req.currentUser.id, { status, dateRange, startDate, endDate });
    const data = raw.map(normalizeMeta);
    res.json({ platform: 'meta', count: data.length, data });
  } catch (err) {
    logger.error('Meta getCampaigns error: ' + err.message);
    next(err);
  }
});

// GET /api/meta/campaigns/:id
router.get('/campaigns/:id', async (req, res, next) => {
  try {
    const raw  = await metaService.getCampaign(req.currentUser.id, req.params.id);
    const data = normalizeMeta(raw);
    res.json({ platform: 'meta', data });
  } catch (err) { next(err); }
});

// GET /api/meta/campaigns/:id/adsets
router.get('/campaigns/:id/adsets', async (req, res, next) => {
  try {
    const data = await metaService.getAdSets(req.currentUser.id, req.params.id);
    res.json({ platform: 'meta', count: data.length, data });
  } catch (err) { next(err); }
});

// GET /api/meta/campaigns/:id/ads
router.get('/campaigns/:id/ads', async (req, res, next) => {
  try {
    const data = await metaService.getAds(req.currentUser.id, req.params.id);
    res.json({ platform: 'meta', count: data.length, data });
  } catch (err) { next(err); }
});

// POST /api/meta/campaigns
router.post('/campaigns', async (req, res, next) => {
  try {
    const { name, objective, daily_budget, status } = req.body;
    if (!name || !objective || !daily_budget) {
      return res.status(400).json({ error: 'name, objective and daily_budget are required' });
    }
    const data = await metaService.createCampaign(req.currentUser.id, { name, objective, daily_budget, status });
    res.status(201).json({ platform: 'meta', data });
  } catch (err) { next(err); }
});

// PATCH /api/meta/campaigns/:id
router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const data = await metaService.updateCampaign(req.currentUser.id, req.params.id, req.body);
    res.json({ platform: 'meta', data });
  } catch (err) { next(err); }
});

// PATCH /api/meta/campaigns/:id/status
router.patch('/campaigns/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be ACTIVE, PAUSED, or ARCHIVED' });
    }
    const data = await metaService.setCampaignStatus(req.currentUser.id, req.params.id, status);
    res.json({ platform: 'meta', data });
  } catch (err) { next(err); }
});

// GET /api/meta/pages/:pageId/ads
router.get('/pages/:pageId/ads', async (req, res, next) => {
  try {
    const data = await metaService.getAdsByPage(req.currentUser.id, req.params.pageId);
    res.json({ platform: 'meta', count: data.length, data });
  } catch (err) {
    logger.error('Meta getAdsByPage error: ' + err.message);
    next(err);
  }
});

module.exports = router;
