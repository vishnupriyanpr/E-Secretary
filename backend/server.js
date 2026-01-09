/**
 * E-Secretary Backend Server
 * Express.js API with Supabase PostgreSQL
 * Production-Ready with Security Headers
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Import database and initialize
const { initializeDatabase } = require('./db');

// Import routes
const { router: authRouter } = require('./routes/auth');
const meetingsRouter = require('./routes/meetings');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3001;

// --- PRODUCTION SECURITY MIDDLEWARE ---

// Security headers (inline implementation - no external dependency)
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Remove Express fingerprint
    res.removeHeader('X-Powered-By');
    next();
});

// Rate limiting for auth endpoints (only in production, more lenient in dev)
const authRateLimiter = (() => {
    const attempts = new Map();
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_ATTEMPTS = process.env.NODE_ENV === 'production' ? 20 : 100; // More lenient in dev

    return (req, res, next) => {
        if (!req.path.startsWith('/api/auth')) return next();

        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const record = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

        if (now > record.resetAt) {
            record.count = 0;
            record.resetAt = now + WINDOW_MS;
        }

        record.count++;
        attempts.set(ip, record);

        if (record.count > MAX_ATTEMPTS) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.'
            });
        }

        next();
    };
})();

app.use(authRateLimiter);

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Allowed domains
        const allowedDomains = [
            'localhost',
            '127.0.0.1',
            'vercel.app',
            'onrender.com'
        ];

        const isAllowed = allowedDomains.some(domain => origin.includes(domain));
        if (isAllowed) return callback(null, true);

        // Block unknown origins in production
        if (process.env.NODE_ENV === 'production') {
            return callback(new Error('Not allowed by CORS'));
        }

        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (minimal in production)
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} | ${req.method} ${req.path}`);
    }
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'E-Secretary Backend',
        database: 'Supabase PostgreSQL'
    });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/webhook', webhookRouter);

// Calendar routes (Google Calendar integration)
const calendarRouter = require('./routes/calendar');
app.use('/api/calendar', calendarRouter);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/dashboard', express.static(path.join(__dirname, '..')));

// Catch-all for SPA routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
async function startServer() {
    try {
        // Initialize database tables
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════╗
║        E-Secretary Backend Server Started            ║
╠══════════════════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}                    ║
║  Health:   http://localhost:${PORT}/api/health         ║
║  Database: Supabase PostgreSQL                       ║
╠══════════════════════════════════════════════════════╣
║  Auth Endpoints:                                     ║
║  POST /api/auth/register  - Create account           ║
║  POST /api/auth/login     - Sign in                  ║
║  GET  /api/auth/verify    - Verify token             ║
║  POST /api/auth/logout    - Sign out                 ║
║  GET  /api/auth/me        - Get profile              ║
╚══════════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
