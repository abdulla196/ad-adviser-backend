const axios = require('axios');
const logger = require('../config/logger');
const { getActiveIntegration } = require('./metaIntegrationService');

const BASE = 'https://graph.facebook.com/v19.0';

const metaClient = axios.create({ baseURL: BASE });

const getActiveMetaContext = async (userId) => {
  const integration = await getActiveIntegration(userId);
  if (!integration?.accessToken) {
    const error = new Error('Meta is not connected');
    error.response = {
      status: 401,
      data: {
        error: {
          message: 'Connect a Meta integration before loading campaigns',
          type: 'META_NOT_CONNECTED',
        },
      },
    };
    throw error;
  }

  return integration;
};

const requireAdAccount = async (userId) => {
  const integration = await getActiveMetaContext(userId);
  if (!integration.selectedAdAccountId) {
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

  return integration;
};

// ── Campaigns ─────────────────────────────────────────
const getCampaigns = async (userId, { dateRange = '30d', status = 'ACTIVE', startDate, endDate } = {}) => {
  const integration = await requireAdAccount(userId);
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

  const res = await metaClient.get(`/${integration.selectedAdAccountId}/campaigns`, {
    params: {
      fields,
      access_token: integration.accessToken,
    },
  });
  const campaigns = res.data.data || [];

  if (statuses.length === 0) {
    return campaigns;
  }

  return campaigns.filter((campaign) => statuses.includes(campaign.status));
};

// ── Single campaign ───────────────────────────────────
const getCampaign = async (userId, campaignId) => {
  const integration = await getActiveMetaContext(userId);
  const fields = [
    'id', 'name', 'status', 'effective_status', 'configured_status', 'objective',
    'buying_type', 'daily_budget', 'lifetime_budget', 'budget_remaining',
    'created_time', 'updated_time', 'start_time', 'stop_time',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}`, {
    params: { fields, access_token: integration.accessToken },
  });
  return res.data;
};

// ── Ad sets ───────────────────────────────────────────
const getAdSets = async (userId, campaignId) => {
  const integration = await getActiveMetaContext(userId);
  const fields = [
    'id', 'name', 'status', 'effective_status', 'daily_budget', 'lifetime_budget',
    'bid_amount', 'optimization_goal', 'billing_event', 'targeting',
    'created_time', 'updated_time', 'start_time', 'end_time',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}/adsets`, {
    params: { fields, access_token: integration.accessToken },
  });
  return res.data.data || [];
};

// ── Ads ──────────────────────────────────────────────
const getAds = async (userId, campaignId) => {
  const integration = await getActiveMetaContext(userId);
  const fields = [
    'id', 'name', 'status', 'effective_status', 'created_time', 'updated_time',
    'adset{id,name}', 'campaign{id,name}',
    'creative{id,name,title,body,image_url,thumbnail_url,object_story_spec}',
    'insights{impressions,reach,clicks,spend,cpm,ctr,cpc,actions,action_values,purchase_roas}',
  ].join(',');
  const res = await metaClient.get(`/${campaignId}/ads`, {
    params: { fields, access_token: integration.accessToken, limit: 100 },
  });
  return res.data.data || [];
};

// ── Create campaign ───────────────────────────────────
const createCampaign = async (userId, { name, objective, status = 'PAUSED', daily_budget }) => {
  const integration = await requireAdAccount(userId);
  const res = await metaClient.post(`/${integration.selectedAdAccountId}/campaigns`, {
    name, objective, status,
    daily_budget: Math.round(daily_budget * 100), // cents
    special_ad_categories: [],
    access_token: integration.accessToken,
  });
  return res.data;
};

// ── Update campaign ───────────────────────────────────
const updateCampaign = async (userId, campaignId, updates) => {
  const integration = await getActiveMetaContext(userId);
  const res = await metaClient.post(`/${campaignId}`, { ...updates, access_token: integration.accessToken });
  return res.data;
};

// ── Pause / Activate ──────────────────────────────────
const setCampaignStatus = async (userId, campaignId, status) =>
  updateCampaign(userId, campaignId, { status });

// ── Get ads promoted on a specific Page ───────────────
const getAdsByPage = async (userId, pageId) => {
  const integration = await getActiveMetaContext(userId);
  // Fetch ads that promote this page across all ad accounts
  const res = await metaClient.get(`/${pageId}/ads`, {
    params: {
      fields: 'id,name,status,creative{id,name,title,body,image_url,thumbnail_url},insights{impressions,clicks,spend,conversions}',
      access_token: integration.accessToken,
      limit: 100,
    },
  });
  return res.data.data || [];
};

module.exports = { getCampaigns, getCampaign, getAdSets, getAds, createCampaign, updateCampaign, setCampaignStatus, getAdsByPage };
