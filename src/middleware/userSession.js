const { getCurrentUserFromToken } = require('../services/userAuthService');

const getBearerToken = (authorizationHeader = '') => {
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return '';
  return token;
};

const requireUserSession = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization || '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.currentUser = await getCurrentUserFromToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = {
  getBearerToken,
  requireUserSession,
};