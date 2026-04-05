const logger = require('../config/logger');

/**
 * Wraps platform API errors into clean, consistent error messages
 * so the React frontend always gets the same error shape.
 */
const handlePlatformError = (err, platform) => {
  // Meta Graph API error
  if (err.response?.data?.error) {
    const e = err.response.data.error;
    const status = err.response.status >= 400 && err.response.status < 600
      ? err.response.status
      : 400;
    return { status, message: `[Meta] ${e.message}`, type: e.type, metaCode: e.code };
  }
  // TikTok error
  if (err.response?.data?.message) {
    return { status: err.response.status || 400, message: `[TikTok] ${err.response.data.message}` };
  }
  // Snapchat error
  if (err.response?.data?.request_status) {
    return { status: err.response.status || 400, message: `[Snapchat] ${err.response.data.request_status}` };
  }
  // Google Ads error
  if (err.response?.data?.error?.details) {
    const detail = err.response.data.error.details[0];
    return { status: err.response.status || 400, message: `[Google] ${detail?.message || err.message}` };
  }
  // Network/timeout
  if (err.code === 'ECONNABORTED') {
    return { status: 504, message: `[${platform}] Request timed out` };
  }
  // Auth errors
  if (err.response?.status === 401 || err.response?.status === 403) {
    return { status: 401, message: `[${platform}] Access token expired or invalid — re-authenticate` };
  }
  return { status: err.response?.status || 500, message: err.message };
};

// Express error middleware (4 args = error handler)
const errorMiddleware = (err, req, res, next) => {
  const parsed = handlePlatformError(err, 'API');
  logger.error(`${parsed.status} ${parsed.message} — ${req.method} ${req.originalUrl}`);
  res.status(parsed.status).json({
    error:   parsed.message,
    type:    parsed.type || 'SERVER_ERROR',
    path:    req.originalUrl,
    ...(parsed.metaCode && { metaCode: parsed.metaCode }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorMiddleware, handlePlatformError };
