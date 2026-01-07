/**
 * Seed Script - Create Sample Admin User
 * Run with: node seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 6543,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

// Sample users to create
const sampleUsers = [
    {
        email: 'admin@esecretary.gmail.com',
        name: 'Admin User',
        password: '123456'  // Minimum 6 characters for bcrypt
    },
    {
        email: 'demo@esecretary.com',
        name: 'Demo User',
        password: 'demo123'
    }
];

async function seedUsers() {
    console.log('\n🌱 Starting database seed...\n');

    const client = await pool.connect();

    try {
        // First, ensure table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            );
        `);

        console.log('✓ Users table ready\n');

        for (const user of sampleUsers) {
            // Check if user already exists
            const existing = await client.query(
                'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
                [user.email]
            );

            if (existing.rows.length > 0) {
                console.log(`⚠ User ${user.email} already exists, skipping...`);
                continue;
            }

            // Hash password
            const passwordHash = await bcrypt.hash(user.password, 12);

            // Insert user
            const result = await client.query(`
                INSERT INTO users (email, name, password_hash, email_verified)
                VALUES (LOWER($1), $2, $3, true)
                RETURNING id, email, name, created_at
            `, [user.email, user.name, passwordHash]);

            console.log(`✓ Created user: ${result.rows[0].email}`);
            console.log(`  ID: ${result.rows[0].id}`);
            console.log(`  Password: ${user.password}`);
            console.log('');
        }

        // Show all users
        const allUsers = await client.query(`
            SELECT id, email, name, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);

        console.log('\n📋 All users in database:');
        console.log('─'.repeat(70));
        allUsers.rows.forEach(u => {
            console.log(`  ${u.email} | ${u.name} | Created: ${new Date(u.created_at).toLocaleString()}`);
        });
        console.log('─'.repeat(70));

        console.log('\n✅ Seed complete!\n');

    } catch (error) {
        console.error('❌ Seed error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

seedUsers();
