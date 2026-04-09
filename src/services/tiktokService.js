const axios = require('axios');
const { resolveToken, getTokens } = require('../store/tokenStore');

const BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const TOKEN = () => resolveToken('tiktok');
const ADVERTISER = () => {
  const stored = getTokens('tiktok');
  return stored?.advertiser_id || process.env.TIKTOK_ADVERTISER_ID;
};

const tiktokClient = () => axios.create({
  baseURL: BASE,
  headers: { 'Access-Token': TOKEN() },
}); 

// ── Campaigns ─────────────────────────────────────────
const getCampaigns = async ({ page = 1, pageSize = 20 } = {}) => {
  const res = await tiktokClient().get('/campaign/get/', {
    params: {
      advertiser_id: ADVERTISER(),
      page, page_size: pageSize,
      fields: JSON.stringify(['campaign_id','campaign_name','primary_status','objective_type','budget','create_time']),
    },
  });
  return res.data.data?.list || [];
};

// ── Campaign metrics ──────────────────────────────────
const getCampaignMetrics = async (campaignIds, { startDate, endDate } = {}) => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const res = await tiktokClient().get('/report/integrated/get/', {
    params: {
      advertiser_id: ADVERTISER(),
      report_type: 'BASIC',
      dimensions: JSON.stringify(['campaign_id']),
      data_level: 'AUCTION_CAMPAIGN',
      start_date: startDate || thirtyDaysAgo,
      end_date:   endDate   || today,
      metrics: JSON.stringify(['impression','click','spend','conversion','value_per_total_complete_payment_event']),
      filtering: JSON.stringify([{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify(campaignIds) }]),
    },
  });
  return res.data.data?.list || [];
};

// ── Create campaign ───────────────────────────────────
const createCampaign = async ({ name, objectiveType, budget, budgetMode = 'BUDGET_MODE_DAY' }) => {
  const res = await tiktokClient().post('/campaign/create/', {
    advertiser_id: ADVERTISER(),
    campaign_name: name,
    objective_type: objectiveType,
    budget,
    budget_mode: budgetMode,
  });
  return res.data.data;
};

// ── Update campaign ───────────────────────────────────
const updateCampaign = async (campaignId, updates) => {
  const res = await tiktokClient().post('/campaign/update/', {
    advertiser_id: ADVERTISER(),
    campaign_id: campaignId,
    ...updates,
  });
  return res.data.data;
};

// ── Pause / Enable ────────────────────────────────────
const setCampaignStatus = async (campaignId, operationType) => {
  const res = await tiktokClient().post('/campaign/status/update/', {
    advertiser_id: ADVERTISER(),
    campaign_ids: [campaignId],
    operation_status: operationType, // 'ENABLE' | 'DISABLE'
  });
  return res.data.data;
};

module.exports = { getCampaigns, getCampaignMetrics, createCampaign, updateCampaign, setCampaignStatus };
