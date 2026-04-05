const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

/**
 * tokenStore.js
 * Simple file-based token persistence for OAuth tokens.
 * Stores tokens in backend/data/tokens.json.
 * Falls back to process.env values when no stored token exists.
 */

const DATA_DIR  = path.join(__dirname, '..', '..', 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Read / Write helpers ──────────────────────────────
const readStore = () => {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    }
  } catch (err) {
    logger.error('Failed to read token store: ' + err.message);
  }
  return {};
};

const writeStore = (data) => {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.error('Failed to write token store: ' + err.message);
  }
};

// ── Public API ────────────────────────────────────────

/**
 * Save tokens for a platform.
 * @param {'meta'|'tiktok'|'snapchat'|'google'} platform
 * @param {object} tokens - Token data (access_token, refresh_token, etc.)
 */
const saveTokens = (platform, tokens) => {
  const store = readStore();
  store[platform] = {
    ...tokens,
    connectedAt: new Date().toISOString(),
  };
  writeStore(store);
  logger.info(`Tokens saved for ${platform}`);
};

/**
 * Get stored tokens for a platform.
 * @param {'meta'|'tiktok'|'snapchat'|'google'} platform
 * @returns {object|null}
 */
const getTokens = (platform) => {
  const store = readStore();
  return store[platform] || null;
};

/**
 * Remove tokens for a platform (disconnect).
 * @param {'meta'|'tiktok'|'snapchat'|'google'} platform
 */
const removeTokens = (platform) => {
  const store = readStore();
  store[platform] = { disconnected: true };
  writeStore(store);
  logger.info(`Tokens removed for ${platform}`);
};

/**
 * Check if an env value is a real token (not a placeholder).
 */
const isRealToken = (val) =>
  !!val && !val.startsWith('your_') && val !== '' && val.length > 10;

/**
 * Get connection status for all platforms.
 * A platform is "connected" if it has stored tokens OR a real env-var token.
 */
const getStatus = () => {
  const store = readStore();
  const isConnected = (entry, envToken) =>
    entry?.disconnected ? false : !!(entry?.access_token || isRealToken(envToken));
  const isConnectedRefresh = (entry, envToken) =>
    entry?.disconnected ? false : !!(entry?.refresh_token || isRealToken(envToken));
  return {
    meta: {
      connected: isConnected(store.meta, process.env.META_ACCESS_TOKEN),
      connectedAt: store.meta?.connectedAt || null,
      selectedPageId: store.meta?.selectedPageId || null,
      selectedPageName: store.meta?.selectedPageName || null,
      selectedAdAccountId: store.meta?.selectedAdAccountId || null,
      selectedAdAccountName: store.meta?.selectedAdAccountName || null,
    },
    tiktok: {
      connected: isConnected(store.tiktok, process.env.TIKTOK_ACCESS_TOKEN),
      connectedAt: store.tiktok?.connectedAt || null,
    },
    snapchat: {
      connected: isConnected(store.snapchat, process.env.SNAPCHAT_ACCESS_TOKEN),
      connectedAt: store.snapchat?.connectedAt || null,
    },
    google: {
      connected: isConnectedRefresh(store.google, process.env.GOOGLE_REFRESH_TOKEN),
      connectedAt: store.google?.connectedAt || null,
    },
  };
};

/**
 * Resolve the active access token for a platform.
 * Prefers stored token, falls back to env var.
 */
const resolveToken = (platform) => {
  const stored = getTokens(platform);
  if (stored?.disconnected) return null;
  switch (platform) {
    case 'meta':
      return stored?.access_token || (isRealToken(process.env.META_ACCESS_TOKEN) ? process.env.META_ACCESS_TOKEN : null);
    case 'tiktok':
      return stored?.access_token || (isRealToken(process.env.TIKTOK_ACCESS_TOKEN) ? process.env.TIKTOK_ACCESS_TOKEN : null);
    case 'snapchat':
      return stored?.access_token || (isRealToken(process.env.SNAPCHAT_ACCESS_TOKEN) ? process.env.SNAPCHAT_ACCESS_TOKEN : null);
    case 'google':
      return stored?.refresh_token || (isRealToken(process.env.GOOGLE_REFRESH_TOKEN) ? process.env.GOOGLE_REFRESH_TOKEN : null);
    default:
      return null;
  }
};

module.exports = { saveTokens, getTokens, removeTokens, getStatus, resolveToken };
