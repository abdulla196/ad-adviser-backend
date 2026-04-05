const axios = require('axios');
const logger = require('../config/logger');

const META_BASIC_SCOPES = ['public_profile', 'email'];

function resolveMetaScopes() {
  const configuredScopes = (process.env.META_OAUTH_SCOPES || META_BASIC_SCOPES.join(','))
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  const allowAdvancedScopes = String(process.env.META_ENABLE_ADVANCED_SCOPES).toLowerCase() === 'true';
  if (allowAdvancedScopes) {
    return configuredScopes.join(',');
  }

  const ignoredScopes = configuredScopes.filter((scope) => !META_BASIC_SCOPES.includes(scope));
  if (ignoredScopes.length > 0) {
    logger.warn(
      `Ignoring advanced Meta OAuth scopes until META_ENABLE_ADVANCED_SCOPES=true: ${ignoredScopes.join(', ')}`
    );
  }

  return META_BASIC_SCOPES.join(',');
}

/**
 * oauthService.js
 * Handles OAuth 2.0 token exchange & refresh for all 4 platforms.
 * Use this when you want users to connect their OWN ad accounts.
 *
 * Flow per platform:
 *  1. Redirect user to platform login URL  → getAuthUrl()
 *  2. Platform redirects back with ?code=  → exchangeCode()
 *  3. Store access_token + refresh_token securely
 *  4. When token expires                   → refreshToken()
 */

// ── META ──────────────────────────────────────────────
const meta = {
  getAuthUrl: () => {
    const params = new URLSearchParams({
      client_id:     process.env.META_APP_ID,
      redirect_uri:  process.env.META_REDIRECT_URI,
      response_type: 'code',
    });

    const configId = (process.env.META_CONFIG_ID || '').trim();
    if (configId) {
      params.set('config_id', configId);
      return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
    }

    const scopes = resolveMetaScopes();
    params.set('scope', scopes);
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },

  exchangeCode: async (code) => {
    const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id:     process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri:  process.env.META_REDIRECT_URI,
        code,
      },
    });
    return res.data; // { access_token, token_type, expires_in }
  },

  // Exchange short-lived token for long-lived (60 days)
  getLongLivedToken: async (shortToken) => {
    const res = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type:        'fb_exchange_token',
        client_id:         process.env.META_APP_ID,
        client_secret:     process.env.META_APP_SECRET,
        fb_exchange_token: shortToken,
      },
    });
    return res.data;
  },
};

// ── TIKTOK ────────────────────────────────────────────
const tiktok = {
  getAuthUrl: () => {
    const params = new URLSearchParams({
      app_id:        process.env.TIKTOK_APP_ID,
      redirect_uri:  process.env.TIKTOK_REDIRECT_URI,
      scope:         'campaign.read,campaign.write,adgroup.read,adgroup.write,ad.read,ad.write',
      response_type: 'code',
      state:         'tiktok_oauth',
    });
    return `https://business-api.tiktok.com/portal/auth?${params}`;
  },

  exchangeCode: async (code) => {
    const res = await axios.post('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      app_id:     process.env.TIKTOK_APP_ID,
      secret:     process.env.TIKTOK_APP_SECRET,
      auth_code:  code,
      grant_type: 'authorization_code',
    });
    return res.data.data; // { access_token, advertiser_id, expires_in }
  },

  refreshToken: async (refreshToken) => {
    const res = await axios.post('https://business-api.tiktok.com/open_api/v1.3/oauth2/refresh_token/', {
      app_id:        process.env.TIKTOK_APP_ID,
      secret:        process.env.TIKTOK_APP_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    });
    return res.data.data;
  },
};

// ── SNAPCHAT ──────────────────────────────────────────
const snapchat = {
  getAuthUrl: () => {
    const params = new URLSearchParams({
      client_id:     process.env.SNAPCHAT_CLIENT_ID,
      redirect_uri:  process.env.SNAPCHAT_REDIRECT_URI,
      scope:         'snapchat-marketing-api',
      response_type: 'code',
    });
    return `https://accounts.snapchat.com/login/oauth2/authorize?${params}`;
  },

  exchangeCode: async (code) => {
    const res = await axios.post('https://accounts.snapchat.com/login/oauth2/access_token', {
      client_id:     process.env.SNAPCHAT_CLIENT_ID,
      client_secret: process.env.SNAPCHAT_CLIENT_SECRET,
      redirect_uri:  process.env.SNAPCHAT_REDIRECT_URI,
      code,
      grant_type:    'authorization_code',
    });
    return res.data; // { access_token, refresh_token, expires_in }
  },

  refreshToken: async (refreshToken) => {
    const res = await axios.post('https://accounts.snapchat.com/login/oauth2/access_token', {
      client_id:     process.env.SNAPCHAT_CLIENT_ID,
      client_secret: process.env.SNAPCHAT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    });
    return res.data;
  },
};

// ── GOOGLE ────────────────────────────────────────────
const google = {
  getAuthUrl: () => {
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      scope:         'https://www.googleapis.com/auth/adwords',
      response_type: 'code',
      access_type:   'offline',
      prompt:        'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  exchangeCode: async (code) => {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      code,
      grant_type:    'authorization_code',
    });
    return res.data; // { access_token, refresh_token, expires_in }
  },

  refreshToken: async (refreshToken) => {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    });
    return res.data;
  },
};

module.exports = { meta, tiktok, snapchat, google };
