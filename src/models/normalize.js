/**
 * normalize.js
 * Converts raw API responses from each platform into a single
 * unified data model so the React frontend only handles one shape.
 *
 * Unified campaign object:
 * {
 *   platform      : 'meta' | 'tiktok' | 'snapchat' | 'google'
 *   id            : string
 *   name          : string
 *   status        : 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN'
 *   objective     : string
 *   budget        : number   (daily budget in USD)
 *   startDate     : string   (ISO date)
 *   endDate       : string | null
 *   impressions   : number
 *   clicks        : number
 *   spend         : number   (USD)
 *   ctr           : number   (percentage)
 *   cpc           : number   (USD)
 *   conversions   : number
 *   roas          : number
 *   raw           : object   (original API response for debugging)
 * }
 */

const safe = (val, fallback = 0) => {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

const sumActionValues = (items = [], actionTypes = []) => {
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    if (!actionTypes.includes(item.action_type)) return total;
    return total + safe(item.value);
  }, 0);
};

const normStatus = (s = '') => {
  const normalized = String(s).replace(/\s+/g, '').toUpperCase();
  const map = {
    ACTIVE: 'ACTIVE', ENABLED: 'ACTIVE', RUNNING: 'ACTIVE',
    PAUSED: 'PAUSED', SUSPENDED: 'PAUSED',
    ARCHIVED: 'ARCHIVED', DELETED: 'ARCHIVED', COMPLETED: 'ARCHIVED',
  };
  return map[normalized] || 'UNKNOWN';
};

// ── Meta ──────────────────────────────────────────────
const normalizeMeta = (campaign) => {
  const ins = campaign.insights?.data?.[0] || {};
  const imp  = safe(ins.impressions);
  const clk  = safe(ins.clicks);
  const spnd = safe(ins.spend);
  const reach = safe(ins.reach);
  const revenue = sumActionValues(ins.action_values, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ]);
  const leads = sumActionValues(ins.actions, [
    'lead',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
  ]);
  const purchases = sumActionValues(ins.actions, [
    'purchase',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
  ]);
  const viewContent = sumActionValues(ins.actions, [
    'view_content',
    'offsite_conversion.fb_pixel_view_content',
  ]);
  const addToCart = sumActionValues(ins.actions, [
    'add_to_cart',
    'offsite_conversion.fb_pixel_add_to_cart',
  ]);
  const initiateCheckout = sumActionValues(ins.actions, [
    'initiate_checkout',
    'offsite_conversion.fb_pixel_initiate_checkout',
  ]);
  const roas = safe(ins.purchase_roas?.[0]?.value) || (spnd > 0 ? +(revenue / spnd).toFixed(2) : 0);
  return {
    platform:    'meta',
    id:          campaign.id,
    name:        campaign.name,
    status:      normStatus(campaign.status),
    effectiveStatus: normStatus(campaign.effective_status || campaign.configured_status || campaign.status),
    objective:   campaign.objective || '',
    budget:      safe(campaign.daily_budget) / 100,
    lifetimeBudget: safe(campaign.lifetime_budget) / 100,
    budgetRemaining: safe(campaign.budget_remaining) / 100,
    budgetType:  campaign.daily_budget ? 'CBO' : 'Lifetime',
    buyingType:  campaign.buying_type || '',
    startDate:   campaign.start_time || null,
    endDate:     campaign.stop_time  || null,
    lastUpdated: campaign.updated_time || campaign.created_time || campaign.start_time || null,
    impressions: imp,
    clicks:      clk,
    reach,
    spend:       spnd,
    revenue,
    ctr:         imp > 0 ? +((clk / imp) * 100).toFixed(2) : 0,
    cpc:         clk > 0 ? +(spnd / clk).toFixed(4) : 0,
    cpm:         imp > 0 ? +((spnd / imp) * 1000).toFixed(2) : 0,
    conversions: purchases,
    leads,
    purchases,
    viewContent,
    addToCart,
    initiateCheckout,
    cpl:         leads > 0 ? +(spnd / leads).toFixed(2) : 0,
    cpa:         purchases > 0 ? +(spnd / purchases).toFixed(2) : 0,
    aov:         purchases > 0 ? +(revenue / purchases).toFixed(2) : 0,
    roas,
    recommendationsCount: 0,
    raw:         campaign,
  };
};

// ── TikTok ────────────────────────────────────────────
const normalizeTikTok = (campaign) => {
  const m    = campaign.metrics || {};
  const imp  = safe(m.impression);
  const clk  = safe(m.click);
  const spnd = safe(m.spend);
  return {
    platform:    'tiktok',
    id:          campaign.campaign_id,
    name:        campaign.campaign_name,
    status:      normStatus(campaign.primary_status),
    objective:   campaign.objective_type || '',
    budget:      safe(campaign.budget),
    startDate:   campaign.create_time || null,
    endDate:     null,
    impressions: imp,
    clicks:      clk,
    spend:       spnd,
    ctr:         imp > 0 ? +((clk / imp) * 100).toFixed(2) : 0,
    cpc:         clk > 0 ? +(spnd / clk).toFixed(4) : 0,
    conversions: safe(m.conversion),
    roas:        safe(m.value_per_total_complete_payment_event),
    raw:         campaign,
  };
};

// ── Snapchat ──────────────────────────────────────────
const normalizeSnapchat = (campaign) => {
  const s    = campaign.stats || {};
  const imp  = safe(s.impressions);
  const clk  = safe(s.swipes);
  const spnd = safe(s.spend) / 1_000_000; // Snapchat returns microdollars
  return {
    platform:    'snapchat',
    id:          campaign.id,
    name:        campaign.name,
    status:      normStatus(campaign.status),
    objective:   campaign.objective || '',
    budget:      safe(campaign.daily_budget_micro) / 1_000_000,
    startDate:   campaign.start_time || null,
    endDate:     campaign.end_time   || null,
    impressions: imp,
    clicks:      clk,
    spend:       spnd,
    ctr:         imp > 0 ? +((clk / imp) * 100).toFixed(2) : 0,
    cpc:         clk > 0 ? +(spnd / clk).toFixed(4) : 0,
    conversions: safe(s.conversions),
    roas:        safe(s.roas),
    raw:         campaign,
  };
};

// ── Google Ads ────────────────────────────────────────
const normalizeGoogle = (campaign) => {
  const m    = campaign.metrics || {};
  const imp  = safe(m.impressions);
  const clk  = safe(m.clicks);
  const spnd = safe(m.cost_micros) / 1_000_000;
  return {
    platform:    'google',
    id:          String(campaign.campaign?.id || ''),
    name:        campaign.campaign?.name || '',
    status:      normStatus(campaign.campaign?.status),
    objective:   campaign.campaign?.advertising_channel_type || '',
    budget:      safe(campaign.campaign_budget?.amount_micros) / 1_000_000,
    startDate:   campaign.campaign?.start_date || null,
    endDate:     campaign.campaign?.end_date   || null,
    impressions: imp,
    clicks:      clk,
    spend:       spnd,
    ctr:         safe(m.ctr) * 100,
    cpc:         safe(m.average_cpc) / 1_000_000,
    conversions: safe(m.conversions),
    roas:        safe(m.conversions_value) > 0 && spnd > 0
                   ? +(safe(m.conversions_value) / spnd).toFixed(2) : 0,
    raw:         campaign,
  };
};

module.exports = { normalizeMeta, normalizeTikTok, normalizeSnapchat, normalizeGoogle };
