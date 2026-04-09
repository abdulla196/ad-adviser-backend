const router = require('express').Router();

const { isDatabaseConfigured } = require('../config/database');
const { requireUserSession } = require('../middleware/userSession');
const {
  getCurrentUser,
  verifyGoogleToken,
  registerBasic,
  loginBasic,
  registerSocial,
  loginSocial,
  updateCurrentUser,
} = require('../services/userAuthService');

router.use((req, res, next) => {
  if (!isDatabaseConfigured() || !process.env.JWT_SECRET) {
    return res.status(503).json({
      error: 'Auth APIs are not configured. Set MYSQL_DATABASE and JWT_SECRET in the backend .env first.',
    });
  }

  return next();
});

router.post('/register/basic', async (req, res, next) => {
  try {
    const result = await registerBasic(req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ token: result.token, user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.post('/login/basic', async (req, res, next) => {
  try {
    const result = await loginBasic(req.body);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ token: result.token, user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.post('/register/google', async (req, res, next) => {
  try {
    const profile = await verifyGoogleToken(req.body.idToken);
    const result = await registerSocial('google', profile);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ token: result.token, user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.post('/login/google', async (req, res, next) => {
  try {
    const profile = await verifyGoogleToken(req.body.idToken);
    const result = await loginSocial('google', profile);
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ token: result.token, user: result.user });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireUserSession, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.currentUser.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me', requireUserSession, async (req, res, next) => {
  try {
    const result = await updateCurrentUser(req.currentUser.id, req.body || {});
    if (result.error) return res.status(result.status).json({ error: result.error });
    return res.status(result.status).json({ user: result.user });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;