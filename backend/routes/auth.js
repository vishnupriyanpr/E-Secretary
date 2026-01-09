/**
 * E-Secretary Backend - Authentication Routes
 * Handles signup, login, logout, and session management with Supabase
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// fetch is native in Node 18+
const { query, getOne, getMany } = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Validation
        if (!email || !name || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, name, password'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Password strength validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Check if user already exists
        const existingUser = await getOne(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new user
        const result = await query(`
            INSERT INTO users (email, name, password_hash)
            VALUES (LOWER($1), $2, $3)
            RETURNING id, email, name, created_at
        `, [email, name.trim(), password_hash]);

        const user = result.rows[0];

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Store session
        await createSession(user.id, token, req);

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
});



/**
 * POST /api/auth/google
 * Authenticate with Google (Sign-In / Sign-Up)
 */
router.post('/google', async (req, res) => {
    try {
        const { token, mode } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, error: 'Token required' });
        }

        // 1. Verify token with Google
        const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const googleData = await googleResponse.json();

        if (googleData.error || !googleData.email) {
            console.error('Google verification failed:', googleData);
            return res.status(401).json({ success: false, error: 'Invalid Google token' });
        }

        const { email, name, sub: googleId, picture } = googleData;

        // 2. Check if user exists
        let user = await getOne(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        // --- STRICT LOGIN MODE CHECK ---
        if (!user && mode === 'login') {
            return res.status(404).json({
                success: false,
                error: 'No account found with this email. Please sign up first.'
            });
        }
        // -------------------------------

        if (!user) {
            // 3. Create new user if not exists (only if NOT in strict login mode)
            // Generate a random password for Google users (they won't use it)
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const password_hash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

            const result = await query(`
                INSERT INTO users (email, name, password_hash, google_id, profile_picture, email_verified)
                VALUES (LOWER($1), $2, $3, $4, $5, TRUE)
                RETURNING id, email, name, profile_picture, created_at
            `, [email, name, password_hash, googleId, picture]);

            user = result.rows[0];
            user.email_verified = true;
            console.log(`Created new Google user: ${email}`);
        } else {
            // Update Google ID and mark email as verified (Google verifies emails)
            await query(`
                UPDATE users 
                SET google_id = COALESCE(google_id, $1), 
                    profile_picture = COALESCE($2, profile_picture),
                    email_verified = TRUE,
                    last_login = CURRENT_TIMESTAMP 
                WHERE id = $3
            `, [googleId, picture, user.id]);
        }

        // 4. Generate JWT & Session
        const jwtToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        await createSession(user.id, jwtToken, req);

        res.json({
            success: true,
            message: 'Google login successful',
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                profile_picture: user.profile_picture
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ success: false, error: 'Server error during Google auth' });
    }
});

/**
 * GET /api/auth/google/callback
 * OAuth2 callback handler for Google Calendar integration
 */
router.get('/google/callback', async (req, res) => {
    try {
        const { code, state: userId } = req.query;

        if (!code || !userId) {
            return res.redirect('/dashboard.html?error=missing_params');
        }

        // Import googleapis
        const { google } = require('googleapis');

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
        );

        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        // Store tokens in database
        await query(`
            UPDATE users 
            SET google_access_token = $1, 
                google_refresh_token = COALESCE($2, google_refresh_token),
                token_expires_at = $3
            WHERE id = $4
        `, [
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            userId
        ]);

        console.log(`Calendar connected for user: ${userId}`);

        // Redirect back to dashboard with success
        res.redirect('/dashboard.html?calendar=connected');

    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.redirect('/dashboard.html?error=oauth_failed');
    }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = await getOne(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Store session
        await createSession(user.id, token, req);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                profile_picture: user.profile_picture
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});

/**
 * GET /api/auth/verify
 * Verify JWT token and return user info
 */
router.get('/verify', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            valid: false,
            error: 'No token provided'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify user still exists in database
        const user = await getOne(
            'SELECT id, email, name, profile_picture FROM users WHERE id = $1',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                profile_picture: user.profile_picture
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            valid: false,
            error: 'Invalid or expired token'
        });
    }
});

/**
 * POST /api/auth/logout
 * Invalidate current session
 */
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const tokenHash = hashToken(token);

        // Remove session
        await query(
            'DELETE FROM sessions WHERE token_hash = $1',
            [tokenHash]
        );

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during logout'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await getOne(`
            SELECT id, email, name, email_verified, created_at, last_login
            FROM users WHERE id = $1
        `, [req.user.id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * Helper: Create session record
 */
async function createSession(userId, token, req) {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(`
        INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5)
    `, [
        userId,
        tokenHash,
        req.headers['user-agent'] || 'unknown',
        req.ip || req.connection?.remoteAddress || 'unknown',
        expiresAt
    ]);
}

/**
 * Helper: Hash token for storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Middleware: Verify authentication
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Invalid or expired token'
        });
    }
}

module.exports = { router, authMiddleware };
