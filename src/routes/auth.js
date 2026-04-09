const router = require('express').Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const oauth  = require('../services/oauthService');
const store  = require('../store/tokenStore');
const logger = require('../config/logger');
const { requireUserSession } = require('../middleware/userSession');
const { getCurrentUserFromToken } = require('../services/userAuthService');
const {
  buildMetaStatus,
  createIntegration,
  getActiveIntegration,
  listIntegrations,
  removeIntegration,
  setActiveIntegration,
  updateSelectedAdAccount,
  updateSelectedPage,
} = require('../services/metaIntegrationService');

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

const issueMetaOauthState = (userId) => jwt.sign(
  { sub: userId, type: 'meta_oauth_state' },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

const readMetaOauthState = (value) => {
  const payload = jwt.verify(String(value || ''), process.env.JWT_SECRET);
  if (payload?.type !== 'meta_oauth_state' || !payload?.sub) {
    throw new Error('Invalid OAuth state');
  }
  return payload;
};

const fetchMetaProfile = async (accessToken) => {
  const response = await axios.get('https://graph.facebook.com/v19.0/me', {
    params: {
      access_token: accessToken,
      fields: 'id,name,picture{url}',
    },
  });

  return response.data;
};

// ── META ──────────────────────────────────────────────
router.get('/meta/connect', async (req, res) => {
  try {
    const user = await getCurrentUserFromToken(req.query.token);
    const state = issueMetaOauthState(user.id);
    res.redirect(oauth.meta.getAuthUrl({ state }));
  } catch (error) {
    res.status(401).send('Unauthorized');
  }
});

router.get('/meta/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    if (!state) return res.status(400).json({ error: 'Missing state' });
    const oauthState = readMetaOauthState(state);
    const tokens     = await oauth.meta.exchangeCode(code);
    const longLived  = await oauth.meta.getLongLivedToken(tokens.access_token);
    const profile = await fetchMetaProfile(longLived.access_token);

    await createIntegration(oauthState.sub, {
      metaUserId: profile.id,
      metaUserName: profile.name,
      metaUserPictureUrl: profile.picture?.data?.url || null,
      accessToken: longLived.access_token,
      tokenType: longLived.token_type,
      expiresIn: longLived.expires_in,
    });
    logger.info(`Meta OAuth success — integration saved for user ${oauthState.sub}`);
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
router.get('/status', requireUserSession, async (req, res, next) => {
  try {
    const status = store.getStatus();
    status.meta = await buildMetaStatus(req.currentUser.id);
    res.json({ platforms: status });
  } catch (error) {
    next(error);
  }
});

// ── Meta: list user's Facebook Pages ──────────────────
router.get('/meta/pages', requireUserSession, async (req, res) => {
  try {
    const integration = await getActiveIntegration(req.currentUser.id);
    if (!integration?.accessToken) return res.status(401).json({ error: 'Meta not connected' });

    // Always fetch the user's profile (works with public_profile)
    let user = null;
    try {
      const userResp = await axios.get('https://graph.facebook.com/v19.0/me', {
        params: { access_token: integration.accessToken, fields: 'id,name,picture{url}' },
      });
      user = userResp.data;
    } catch (e) {
      logger.warn('Meta user profile fetch failed: ' + e.message);
    }

    // Try to fetch pages (requires pages_show_list permission)
    let pages = [];
    try {
      const resp = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
        params: { access_token: integration.accessToken, fields: 'id,name,picture{url},category' },
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
router.post('/meta/select-page', requireUserSession, async (req, res) => {
  const { integrationId, pageId, pageName, pagePictureUrl, pageCategory } = req.body;
  if (!pageId) return res.status(400).json({ error: 'pageId is required' });
  const activeIntegration = integrationId
    ? await setActiveIntegration(req.currentUser.id, integrationId)
    : await getActiveIntegration(req.currentUser.id);

  if (!activeIntegration) {
    return res.status(401).json({ error: 'Meta not connected' });
  }

  await updateSelectedPage(req.currentUser.id, activeIntegration.id, {
    id: pageId,
    name: pageName,
    pictureUrl: pagePictureUrl,
    category: pageCategory,
  });
  logger.info(`Meta page selected: ${pageName} (${pageId})`);
  res.json({ success: true, pageId, pageName });
});

// ── Meta: get ad accounts linked to user ──────────────
router.get('/meta/ad-accounts', requireUserSession, async (req, res) => {
  try {
    const integrationId = req.query.integrationId ? Number(req.query.integrationId) : null;
    const integration = integrationId
      ? await setActiveIntegration(req.currentUser.id, integrationId)
      : await getActiveIntegration(req.currentUser.id);

    if (!integration?.accessToken) return res.status(401).json({ error: 'Meta not connected' });
    const resp = await axios.get('https://graph.facebook.com/v19.0/me/adaccounts', {
      params: { access_token: integration.accessToken, fields: 'id,name,account_status,currency' },
    });
    res.json({ adAccounts: resp.data.data || [] });
  } catch (err) {
    logger.error('Meta ad-accounts error: ' + err.message);
    res.status(500).json({ error: 'Failed to fetch ad accounts' });
  }
});

// ── Meta: save selected ad account ────────────────────
router.post('/meta/select-ad-account', requireUserSession, async (req, res) => {
  const { integrationId, adAccountId, adAccountName, currency } = req.body;
  if (!adAccountId) return res.status(400).json({ error: 'adAccountId is required' });
  const activeIntegration = integrationId
    ? await setActiveIntegration(req.currentUser.id, integrationId)
    : await getActiveIntegration(req.currentUser.id);

  if (!activeIntegration) {
    return res.status(401).json({ error: 'Meta not connected' });
  }

  await updateSelectedAdAccount(req.currentUser.id, activeIntegration.id, {
    id: adAccountId,
    name: adAccountName,
    currency,
  });
  logger.info(`Meta ad account selected: ${adAccountName} (${adAccountId})`);
  res.json({ success: true, adAccountId, adAccountName });
});

router.get('/meta/integrations', requireUserSession, async (req, res, next) => {
  try {
    const integrations = await listIntegrations(req.currentUser.id);
    res.json({ integrations });
  } catch (error) {
    next(error);
  }
});

router.post('/meta/integrations/:integrationId/activate', requireUserSession, async (req, res, next) => {
  try {
    const integrationId = Number(req.params.integrationId);
    const integration = await setActiveIntegration(req.currentUser.id, integrationId);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    res.json({ integration });
  } catch (error) {
    next(error);
  }
});

router.delete('/meta/integrations/:integrationId', requireUserSession, async (req, res, next) => {
  try {
    const integrationId = Number(req.params.integrationId);
    const integration = await removeIntegration(req.currentUser.id, integrationId);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    res.json({ success: true, integrationId });
  } catch (error) {
    next(error);
  }
});

// ── Disconnect a platform ─────────────────────────────
router.delete('/disconnect/:platform', requireUserSession, async (req, res) => {
  const { platform } = req.params;
  const valid = ['meta', 'tiktok', 'snapchat', 'google'];
  if (!valid.includes(platform)) {
    return res.status(400).json({ error: `Invalid platform: ${platform}` });
  }

  if (platform === 'meta') {
    const integrations = await listIntegrations(req.currentUser.id);
    await Promise.all(integrations.map((integration) => removeIntegration(req.currentUser.id, integration.id)));
    logger.info(`meta disconnected for user ${req.currentUser.id}`);
    return res.json({ success: true, platform });
  }

  store.removeTokens(platform);
  logger.info(`${platform} disconnected`);
  res.json({ success: true, platform });
});

module.exports = router;
