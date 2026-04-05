const router = require('express').Router();
const oauth  = require('../services/oauthService');
const store  = require('../store/tokenStore');
const logger = require('../config/logger');

/**
 * OAuth Routes
 *
 * Step 1 — Redirect user to platform login:
 *   GET /api/auth/meta/connect
 *   GET /api/auth/tiktok/connect
 *   GET /api/auth/snapchat/connect
 *   GET /api/auth/google/connect
 *
 * Step 2 — Platform redirects back here with ?code=
 *   GET /api/auth/meta/callback
 *   GET /api/auth/tiktok/callback
 *   GET /api/auth/snapchat/callback
 *   GET /api/auth/google/callback
 *
 * After exchanging the code, you'd normally:
 *  - Store tokens in a DB linked to the user
 *  - Redirect back to your React frontend
 * For simplicity here, tokens are returned as JSON.
 */

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

// ── META ──────────────────────────────────────────────
router.get('/meta/connect', (req, res) => {
  res.redirect(oauth.meta.getAuthUrl());
});

router.get('/meta/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const tokens     = await oauth.meta.exchangeCode(code);
    const longLived  = await oauth.meta.getLongLivedToken(tokens.access_token);
    store.saveTokens('meta', {
      access_token: longLived.access_token,
      token_type:   longLived.token_type,
      expires_in:   longLived.expires_in,
    });
    logger.info('Meta OAuth success — token saved');
    // Send HTML that notifies the opener window and closes the popup
    res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'META_OAUTH_SUCCESS', platform: 'meta' }, '*');
      }
      window.close();
    </script><p>Connected! This window will close automatically.</p></body></html>`);
  } catch (err) {
    logger.error('Meta OAuth error: ' + err.message);
    res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'META_OAUTH_ERROR', platform: 'meta', error: 'OAuth failed' }, '*');
      }
      window.close();
    </script><p>Connection failed. This window will close automatically.</p></body></html>`);
  }
});

// ── TIKTOK ────────────────────────────────────────────
router.get('/tiktok/connect', (req, res) => {
  res.redirect(oauth.tiktok.getAuthUrl());
});

router.get('/tiktok/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const tokens = await oauth.tiktok.exchangeCode(code);
    store.saveTokens('tiktok', {
      access_token:  tokens.access_token,
      advertiser_id: tokens.advertiser_id,
      expires_in:    tokens.expires_in,
    });
    logger.info('TikTok OAuth success — token saved');
    res.redirect(`${FRONTEND}/connect-success?platform=tiktok`);
  } catch (err) {
    logger.error('TikTok OAuth error: ' + err.message);
    res.redirect(`${FRONTEND}/connect-error?platform=tiktok`);
  }
});

// ── SNAPCHAT ──────────────────────────────────────────
router.get('/snapchat/connect', (req, res) => {
  res.redirect(oauth.snapchat.getAuthUrl());
});

router.get('/snapchat/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const tokens = await oauth.snapchat.exchangeCode(code);
    store.saveTokens('snapchat', {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in:    tokens.expires_in,
    });
    logger.info('Snapchat OAuth success — token saved');
    res.redirect(`${FRONTEND}/connect-success?platform=snapchat`);
  } catch (err) {
    logger.error('Snapchat OAuth error: ' + err.message);
    res.redirect(`${FRONTEND}/connect-error?platform=snapchat`);
  }
});

// ── GOOGLE ────────────────────────────────────────────
router.get('/google/connect', (req, res) => {
  res.redirect(oauth.google.getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const tokens = await oauth.google.exchangeCode(code);
    store.saveTokens('google', {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in:    tokens.expires_in,
    });
    logger.info('Google OAuth success — token saved');
    res.redirect(`${FRONTEND}/connect-success?platform=google`);
  } catch (err) {
    logger.error('Google OAuth error: ' + err.message);
    res.redirect(`${FRONTEND}/connect-error?platform=google`);
  }
});

// ── Status — which platforms are connected ────────────
router.get('/status', (req, res) => {
  res.json({ platforms: store.getStatus() });
});

// ── Meta: list user's Facebook Pages ──────────────────
router.get('/meta/pages', async (req, res) => {
  try {
    const token = store.resolveToken('meta');
    if (!token) return res.status(401).json({ error: 'Meta not connected' });
    const axios = require('axios');

    // Always fetch the user's profile (works with public_profile)
    let user = null;
    try {
      const userResp = await axios.get('https://graph.facebook.com/v19.0/me', {
        params: { access_token: token, fields: 'id,name,picture{url}' },
      });
      user = userResp.data;
    } catch (e) {
      logger.warn('Meta user profile fetch failed: ' + e.message);
    }

    // Try to fetch pages (requires pages_show_list permission)
    let pages = [];
    try {
      const resp = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: token, fields: 'id,name,picture{url},category' },
      });
      pages = resp.data.data || [];
    } catch (e) {
      logger.warn('Meta pages fetch failed (may need pages_show_list permission): ' + e.message);
    }

    res.json({ user, pages });
  } catch (err) {
    logger.error('Meta pages error: ' + err.message);
    res.status(500).json({ error: 'Failed to fetch Facebook data' });
  }
});

// ── Meta: save selected page ──────────────────────────
router.post('/meta/select-page', (req, res) => {
  const { pageId, pageName } = req.body;
  if (!pageId) return res.status(400).json({ error: 'pageId is required' });
  const existing = store.getTokens('meta');
  if (!existing || existing.disconnected) {
    return res.status(401).json({ error: 'Meta not connected' });
  }
  store.saveTokens('meta', { ...existing, selectedPageId: pageId, selectedPageName: pageName });
  logger.info(`Meta page selected: ${pageName} (${pageId})`);
  res.json({ success: true, pageId, pageName });
});

// ── Meta: get ad accounts linked to user ──────────────
router.get('/meta/ad-accounts', async (req, res) => {
  try {
    const token = store.resolveToken('meta');
    if (!token) return res.status(401).json({ error: 'Meta not connected' });
    const axios = require('axios');
    const resp = await axios.get('https://graph.facebook.com/v19.0/me/adaccounts', {
      params: { access_token: token, fields: 'id,name,account_status,currency' },
    });
    res.json({ adAccounts: resp.data.data || [] });
  } catch (err) {
    logger.error('Meta ad-accounts error: ' + err.message);
    res.status(500).json({ error: 'Failed to fetch ad accounts' });
  }
});

// ── Meta: save selected ad account ────────────────────
router.post('/meta/select-ad-account', (req, res) => {
  const { adAccountId, adAccountName } = req.body;
  if (!adAccountId) return res.status(400).json({ error: 'adAccountId is required' });
  const existing = store.getTokens('meta');
  if (!existing || existing.disconnected) {
    return res.status(401).json({ error: 'Meta not connected' });
  }
  store.saveTokens('meta', { ...existing, selectedAdAccountId: adAccountId, selectedAdAccountName: adAccountName });
  logger.info(`Meta ad account selected: ${adAccountName} (${adAccountId})`);
  res.json({ success: true, adAccountId, adAccountName });
});

// ── Disconnect a platform ─────────────────────────────
router.delete('/disconnect/:platform', (req, res) => {
  const { platform } = req.params;
  const valid = ['meta', 'tiktok', 'snapchat', 'google'];
  if (!valid.includes(platform)) {
    return res.status(400).json({ error: `Invalid platform: ${platform}` });
  }
  store.removeTokens(platform);
  logger.info(`${platform} disconnected`);
  res.json({ success: true, platform });
});

module.exports = router;
