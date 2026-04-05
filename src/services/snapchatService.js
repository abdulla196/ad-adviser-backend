const axios = require('axios');
const { resolveToken } = require('../store/tokenStore');

const BASE = 'https://adsapi.snapchat.com/v1';
const TOKEN = () => resolveToken('snapchat');
const ACCOUNT = () => process.env.SNAPCHAT_AD_ACCOUNT_ID;

const snapClient = () => axios.create({
  baseURL: BASE,
  headers: { Authorization: `Bearer ${TOKEN()}` },
});

// ── Campaigns ─────────────────────────────────────────
const getCampaigns = async () => {
  const res = await snapClient().get(`/adaccounts/${ACCOUNT()}/campaigns`);
  return (res.data.campaigns || []).map(c => c.campaign);
};

// ── Campaign stats ────────────────────────────────────
const getCampaignStats = async (campaignId, { startTime, endTime, granularity = 'TOTAL' } = {}) => {
  const now  = new Date();
  const ago  = new Date(now - 30 * 86400000);
  const res  = await snapClient().get(`/campaigns/${campaignId}/stats`, {
    params: {
      fields: 'impressions,swipes,spend,conversions,roas',
      granularity,
      start_time: startTime || ago.toISOString(),
      end_time:   endTime   || now.toISOString(),
    },
  });
  return res.data.total_stats?.[0]?.total_stat?.stats || {};
};

// ── Create campaign ───────────────────────────────────
const createCampaign = async ({ name, objective, status = 'PAUSED', daily_budget_micro, start_time, end_time }) => {
  const res = await snapClient().post(`/adaccounts/${ACCOUNT()}/campaigns`, {
    campaigns: [{ campaign: { name, objective, status, daily_budget_micro, start_time, end_time } }],
  });
  return res.data.campaigns?.[0]?.campaign;
};

// ── Update campaign ───────────────────────────────────
const updateCampaign = async (campaignId, updates) => {
  const res = await snapClient().put(`/adaccounts/${ACCOUNT()}/campaigns`, {
    campaigns: [{ campaign: { id: campaignId, ...updates } }],
  });
  return res.data.campaigns?.[0]?.campaign;
};

// ── Pause / Activate ──────────────────────────────────
const setCampaignStatus = async (campaignId, status) =>
  updateCampaign(campaignId, { status });

module.exports = { getCampaigns, getCampaignStats, createCampaign, updateCampaign, setCampaignStatus };
