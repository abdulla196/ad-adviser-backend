const axios = require('axios');
const logger = require('../config/logger');
const { resolveToken, getTokens } = require('../store/tokenStore');

const BASE = 'https://graph.facebook.com/v19.0';
const TOKEN = () => resolveToken('meta');

const isRealAdAccountId = (value) =>
  !!value && value !== '' && value !== 'act_your_ad_account_id';

const AD_ACCOUNT = () => {
  const stored = getTokens('meta');
  if (isRealAdAccountId(stored?.selectedAdAccountId)) {
    return stored.selectedAdAccountId;
  }

  if (isRealAdAccountId(process.env.META_AD_ACCOUNT_ID)) {
    return process.env.META_AD_ACCOUNT_ID;
  }

  return null;
};

const metaClient = axios.create({ baseURL: BASE });

const requireAdAccount = () => {
  const adAccountId = AD_ACCOUNT();
  if (!adAccountId) {
    const error = new Error('Meta ad account is not selected');
    error.response = {
      status: 400,
      data: {
        error: {
          message: 'Select a Meta ad account before loading campaigns',
          type: 'META_AD_ACCOUNT_REQUIRED',
        },
      },
    };
    throw error;
  }

  return adAccountId;
};

// ── Campaigns ─────────────────────────────────────────
const getCampaigns = async ({ dateRange = '30d', status = 'ACTIVE', startDate, endDate } = {}) => {
  const adAccountId = requireAdAccount();
  const statuses = String(status)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const insightsRange = startDate && endDate
    ? `time_range({"since":"${startDate}","until":"${endDate}"})`
    : `date_preset(last_${dateRange})`;

  const fields = [
    'id', 'name', 'status', 'effective_status', 'configured_status', 'objective',
    'buying_type', 'daily_budget', 'lifetime_budget', 'budget_remaining',
    'created_time', 'updated_time', 'start_time', 'stop_time',
    `insights.${insightsRange}{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}`,
  ].join(',');

  const res = await metaClient.get(`/${adAccountId}/campaigns`, {
    params: {
      fields,
      access_token: TOKEN(),
    },
  });
  const campaigns = res.data.data || [];

  if (statuses.length === 0) {
    return campaigns;
  }

  return campaigns.filter((campaign) => statuses.includes(campaign.status));
};

// ── Single campaign ───────────────────────────────────
const getCampaign = async (campaignId) => {
  const fields = [
    'id', 'name', 'status', 'effective_status', 'configured_status', 'objective',
    'buying_type', 'daily_budget', 'lifetime_budget', 'budget_remaining',
    'created_time', 'updated_time', 'start_time', 'stop_time',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}`, {
    params: { fields, access_token: TOKEN() },
  });
  return res.data;
};

// ── Ad sets ───────────────────────────────────────────
const getAdSets = async (campaignId) => {
  const fields = [
    'id', 'name', 'status', 'effective_status', 'daily_budget', 'lifetime_budget',
    'bid_amount', 'optimization_goal', 'billing_event', 'targeting',
    'created_time', 'updated_time', 'start_time', 'end_time',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}/adsets`, {
    params: { fields, access_token: TOKEN() },
  });
  return res.data.data || [];
};

// ── Ads ──────────────────────────────────────────────
const getAds = async (campaignId) => {
  const fields = [
    'id', 'name', 'status', 'effective_status', 'created_time', 'updated_time',
    'adset{id,name}', 'campaign{id,name}',
    'creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}/ads`, {
    params: { fields, access_token: TOKEN(), limit: 100 },
  });
  return res.data.data || [];
};

// ── Create campaign ───────────────────────────────────
const createCampaign = async ({ name, objective, status = 'PAUSED', daily_budget }) => {
  const res = await metaClient.post(`/${requireAdAccount()}/campaigns`, {
    name, objective, status,
    daily_budget: Math.round(daily_budget * 100), // cents
    special_ad_categories: [],
    access_token: TOKEN(),
  });
  return res.data;
};

// ── Update campaign ───────────────────────────────────
const updateCampaign = async (campaignId, updates) => {
  const res = await metaClient.post(`/${campaignId}`, { ...updates, access_token: TOKEN() });
  return res.data;
};

// ── Pause / Activate ──────────────────────────────────
const setCampaignStatus = async (campaignId, status) =>
  updateCampaign(campaignId, { status });

// ── Get ads promoted on a specific Page ───────────────
const getAdsByPage = async (pageId) => {
  const token = TOKEN();
  // Fetch ads that promote this page across all ad accounts
  const res = await metaClient.get(`/${pageId}/ads`, {
    params: {
      fields: 'id,name,status,creative{id,name,title,body,image_url,thumbnail_url},insights{impressions,clicks,spend,conversions}',
      access_token: token,
      limit: 100,
    },
  });
  return res.data.data || [];
};

module.exports = { getCampaigns, getCampaign, getAdSets, getAds, createCampaign, updateCampaign, setCampaignStatus, getAdsByPage };
