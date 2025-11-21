require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./config/database');
const logger = require('./config/logger');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const gameRoutes = require('./routes/games');
const userRoutes = require('./routes/users');

const app = express();

// Security middleware
app.use(helmet());

// CORS: support multiple comma-separated origins (CORS_ORIGINS) or single legacy CORS_ORIGIN
const allowedOriginsRaw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:8000';
const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser / same-origin requests (no origin header)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
}));

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
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
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
