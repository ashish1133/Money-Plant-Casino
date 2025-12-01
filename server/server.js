require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./config/database');
const logger = require('./config/logger');

const walletRoutes = require('./routes/wallet');
const gameRoutes = require('./routes/games');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');

const app = express();

// Security middleware
app.use(helmet());

// CORS: support multiple comma-separated origins (CORS_ORIGINS) or single legacy CORS_ORIGIN
const allowedOriginsRaw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:8000';
const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim()).filter(Boolean);
// Allow the server's own origin (useful when serving frontend from same host/port)
const serverPort = process.env.PORT || 3000;
const serverOrigin = `http://localhost:${serverPort}`;
if (!allowedOrigins.includes(serverOrigin)) allowedOrigins.push(serverOrigin);
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser / same-origin requests (no origin header)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));

// Payments webhook needs raw body; mount it before JSON parser
app.use('/api/payments/webhook', require('./routes/payments-webhook'));

// Body parsing
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Static frontend (serves index.html and assets if deployed together)
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.use('/api/wallet', walletRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Readiness probe (checks DB availability)
app.get('/ready', (req, res) => {
    try {
        // a lightweight DB check
        const row = require('./config/database').db.prepare('SELECT 1 as ok').get();
        if (row && row.ok === 1) {
            return res.json({ status: 'ready' });
        }
        return res.status(500).json({ status: 'not-ready' });
    } catch (e) {
        return res.status(500).json({ status: 'not-ready', error: e.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method 
    });
    
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Initialize database
initDatabase();

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
