const logger = require('../config/logger');

/**
 * Simple API key middleware.
 * Frontend must send header:  x-api-key: <API_KEY from .env>
 */
const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    logger.warn(`Unauthorized request to ${req.path} from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
  }
  next();
};

module.exports = { apiKeyAuth };
