const axios = require('axios');
const { resolveToken } = require('../store/tokenStore');

const BASE = 'https://googleads.googleapis.com/v15';
const CUSTOMER = () => process.env.GOOGLE_CUSTOMER_ID?.replace(/-/g, '');
const DEV_TOKEN = () => process.env.GOOGLE_DEVELOPER_TOKEN;

// Get a fresh access token using the stored or env refresh token
const getAccessToken = async () => {
  const refreshToken = resolveToken('google');
  if (!refreshToken) throw new Error('Google not connected — no refresh token');
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  });
  return res.data.access_token;
};

const googleClient = async () => {
  const token = await getAccessToken();
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization:            `Bearer ${token}`,
      'developer-token':        DEV_TOKEN(),
      'login-customer-id':      CUSTOMER(),
    },
  });
};

// ── Campaigns ─────────────────────────────────────────
const getCampaigns = async ({ startDate, endDate } = {}) => {
  const today = new Date().toISOString().split('T')[0];
  const ago   = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const query = `
    SELECT
      campaign.id, campaign.name, campaign.status,
      campaign.advertising_channel_type, campaign.start_date, campaign.end_date,
      campaign_budget.amount_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.ctr, metrics.average_cpc, metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate || ago}' AND '${endDate || today}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  const client = await googleClient();
  const res = await client.post(`/customers/${CUSTOMER()}/googleAds:searchStream`, { query });
  return (res.data || []).flatMap(batch => batch.results || []);
};

// ── Create campaign ───────────────────────────────────
const createCampaign = async ({ name, channelType = 'SEARCH', status = 'PAUSED', budgetAmountMicros, startDate, endDate }) => {
  const client = await googleClient();

  // 1. Create budget first
  const budgetRes = await client.post(`/customers/${CUSTOMER()}/campaignBudgets:mutate`, {
    operations: [{ create: { amountMicros: budgetAmountMicros, deliveryMethod: 'STANDARD' } }],
  });
  const budgetResourceName = budgetRes.data.results[0].resourceName;

  // 2. Create campaign with that budget
  const res = await client.post(`/customers/${CUSTOMER()}/campaigns:mutate`, {
    operations: [{
      create: {
        name, status,
        advertisingChannelType: channelType,
        campaignBudget: budgetResourceName,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate,
        networkSettings: { targetGoogleSearch: true, targetSearchNetwork: true },
      },
    }],
  });
  return res.data.results[0];
};

// ── Update campaign ───────────────────────────────────
const updateCampaign = async (campaignId, updates) => {
  const client = await googleClient();
  const res = await client.post(`/customers/${CUSTOMER()}/campaigns:mutate`, {
    operations: [{
      update: { resourceName: `customers/${CUSTOMER()}/campaigns/${campaignId}`, ...updates },
      updateMask: Object.keys(updates).join(','),
    }],
  });
  return res.data.results[0];
};

// ── Pause / Enable ────────────────────────────────────
const setCampaignStatus = async (campaignId, status) =>
  updateCampaign(campaignId, { status });

module.exports = { getCampaigns, createCampaign, updateCampaign, setCampaignStatus };
