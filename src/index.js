require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const metaRoutes = require('./routes/meta');
const tiktokRoutes = require('./routes/tiktok');
const snapchatRoutes = require('./routes/snapchat');
const googleRoutes = require('./routes/google');
const unifiedRoutes = require('./routes/unified');
const authRoutes = require('./routes/auth');
const { apiKeyAuth } = require('./middleware/auth');
const { errorMiddleware } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Middleware ────────────────────────────────────────
app.use(express.json());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Health check (no auth required) ──────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platforms: ['meta', 'tiktok', 'snapchat', 'google'],
  });
});

// ── API Routes (protected by API key) ────────────────
app.use('/api/auth',     authRoutes);           // no API key needed for OAuth
app.use('/api/meta',     apiKeyAuth, metaRoutes);
app.use('/api/tiktok',   apiKeyAuth, tiktokRoutes);
app.use('/api/snapchat', apiKeyAuth, snapchatRoutes);
app.use('/api/google',   apiKeyAuth, googleRoutes);
app.use('/api/unified',  apiKeyAuth, unifiedRoutes);

// ── 404 handler ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────
app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`Ad Adviser backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
