/**
 * E-Secretary Backend - Supabase PostgreSQL Database Connection
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 6543,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test connection on startup
pool.on('connect', () => {
    console.log('✓ Connected to Supabase PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Database pool error:', err);
});

/**
 * Initialize database tables
 */
async function initializeDatabase() {
    const client = await pool.connect();

    try {
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                google_id VARCHAR(255) UNIQUE,
                profile_picture TEXT,
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );
        `);

        // Create sessions table for tracking active sessions
        await client.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) NOT NULL,
                user_agent TEXT,
                ip_address VARCHAR(50),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create meetings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS meetings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(500) NOT NULL,
                meeting_date TIMESTAMP WITH TIME ZONE,
                transcript TEXT,
                summary TEXT,
                action_items JSONB,
                status VARCHAR(50) DEFAULT 'pending',
                host_email VARCHAR(255),
                attendees JSONB,
                approved_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes for faster lookups (run separately to avoid batch failures)
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id)'
        ];

        for (const indexQuery of indexes) {
            try {
                await client.query(indexQuery);
            } catch (indexError) {
                // Index might already exist or column might not exist yet - not fatal
                console.log('Index creation skipped:', indexError.message);
            }
        }

        // --- MIGRATION: Add missing columns for Google Auth if they don't exist ---
        try {
            console.log('Verifying users table schema...');

            // Add google_id
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE');
            console.log('✓ Verified google_id column');

            // Add profile_picture
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT');
            console.log('✓ Verified profile_picture column');

            // Add Google OAuth tokens for Calendar API
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT');
            await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE');
            console.log('✓ Verified Google OAuth token columns');

        } catch (migrationError) {
            console.error('Migration warning (non-fatal):', migrationError.message);
        }
        // --------------------------------------------------------------------------

        // --- MIGRATION: Add all required columns to meetings table ---
        try {
            console.log('Verifying meetings table schema...');

            // Core columns
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS title VARCHAR(500)');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_date TIMESTAMP WITH TIME ZONE');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcript TEXT');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS summary TEXT');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS action_items JSONB');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\'');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_email VARCHAR(255)');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS attendees JSONB');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');

            // Google Calendar integration
            await client.query('ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255)');

            console.log('✓ Verified all meetings table columns');
        } catch (meetingsMigrationError) {
            console.error('Meetings migration warning (non-fatal):', meetingsMigrationError.message);
        }
        // -------------------------------------------------------------------

        console.log('✓ Database tables initialized');

    } catch (error) {
        console.error('Database initialization error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Query helper with error handling
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.log('Slow query:', { text, duration, rows: res.rowCount });
        }
        return res;
    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
}

/**
 * Get a single row
 */
async function getOne(text, params) {
    const res = await query(text, params);
    return res.rows[0] || null;
}

/**
 * Get multiple rows
 */
async function getMany(text, params) {
    const res = await query(text, params);
    return res.rows;
}

module.exports = {
    pool,
    query,
    getOne,
    getMany,
    initializeDatabase
};
