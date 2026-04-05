const router = require('express').Router();
const metaService     = require('../services/metaService');
const tiktokService   = require('../services/tiktokService');
const snapService     = require('../services/snapchatService');
const googleService   = require('../services/googleService');
const { normalizeMeta, normalizeTikTok, normalizeSnapchat, normalizeGoogle } = require('../models/normalize');
const logger = require('../config/logger');

/**
 * GET /api/unified/campaigns
 * Fetches all platforms in parallel and returns one merged array.
 * Query params:
 *   platforms=meta,tiktok,snapchat,google  (default: all)
 */
router.get('/campaigns', async (req, res, next) => {
  const requested = req.query.platforms
    ? req.query.platforms.split(',').map(s => s.trim().toLowerCase())
    : ['meta', 'tiktok', 'snapchat', 'google'];

  const jobs = [];

  if (requested.includes('meta')) {
    jobs.push(
      metaService.getCampaigns()
        .then(r => r.map(normalizeMeta))
        .catch(e => { logger.error('Unified meta error: ' + e.message); return []; })
    );
  }

  if (requested.includes('tiktok')) {
    jobs.push(
      tiktokService.getCampaigns()
        .then(async (list) => {
          const ids = list.map(c => c.campaign_id);
          const metrics = ids.length ? await tiktokService.getCampaignMetrics(ids) : [];
          const metricsMap = Object.fromEntries(metrics.map(m => [m.dimensions?.campaign_id, m.metrics]));
          return list.map(c => normalizeTikTok({ ...c, metrics: metricsMap[c.campaign_id] || {} }));
        })
        .catch(e => { logger.error('Unified tiktok error: ' + e.message); return []; })
    );
  }

  if (requested.includes('snapchat')) {
    jobs.push(
      snapService.getCampaigns()
        .then(async (list) => {
          const withStats = await Promise.all(
            list.map(async c => {
              const stats = await snapService.getCampaignStats(c.id).catch(() => ({}));
              return { ...c, stats };
            })
          );
          return withStats.map(normalizeSnapchat);
        })
        .catch(e => { logger.error('Unified snapchat error: ' + e.message); return []; })
    );
  }

  if (requested.includes('google')) {
    jobs.push(
      googleService.getCampaigns()
        .then(r => r.map(normalizeGoogle))
        .catch(e => { logger.error('Unified google error: ' + e.message); return []; })
    );
  }

  try {
    const results = await Promise.all(jobs);
    const data    = results.flat();

    // Summary totals
    const summary = data.reduce((acc, c) => ({
      totalSpend:       +(acc.totalSpend + c.spend).toFixed(2),
      totalImpressions: acc.totalImpressions + c.impressions,
      totalClicks:      acc.totalClicks + c.clicks,
      totalConversions: acc.totalConversions + c.conversions,
    }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 });

    summary.averageCtr = summary.totalImpressions > 0
      ? +((summary.totalClicks / summary.totalImpressions) * 100).toFixed(2) : 0;
    summary.averageCpc = summary.totalClicks > 0
      ? +(summary.totalSpend / summary.totalClicks).toFixed(4) : 0;

    res.json({
      platforms: requested,
      count: data.length,
      summary,
      data,
    });
  } catch (err) { next(err); }
});

module.exports = router;
