/**
 * E-Secretary Backend Server
 * Express.js API with Supabase PostgreSQL
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

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:5501',
        'http://127.0.0.1:5501',
        // Allow file:// protocol for local HTML files
        'null'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} | ${req.method} ${req.path}`);
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
