/**
 * E-Secretary Backend - Meetings Routes (Supabase)
 */

const express = require('express');
const { query, getOne, getMany } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

/**
 * GET /api/meetings
 * Get all meetings for the authenticated user
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const meetings = await getMany(`
            SELECT id, title, meeting_date, status, host_email, created_at
            FROM meetings 
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user.id]);

        res.json({
            success: true,
            meetings
        });
    } catch (error) {
        console.error('Get meetings error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch meetings'
        });
    }
});

/**
 * GET /api/meetings/stats
 * Get dashboard statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const stats = await getOne(`
            SELECT 
                COUNT(*)::int as total_meetings,
                COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
                COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
                COUNT(*) FILTER (WHERE status = 'sent')::int as sent
            FROM meetings 
            WHERE user_id = $1
        `, [req.user.id]);

        res.json({
            success: true,
            stats: stats || { total_meetings: 0, pending: 0, approved: 0, sent: 0 }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

/**
 * GET /api/meetings/:id
 * Get a specific meeting with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const meeting = await getOne(`
            SELECT * FROM meetings 
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.id]);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        res.json({
            success: true,
            meeting
        });
    } catch (error) {
        console.error('Get meeting error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch meeting'
        });
    }
});

/**
 * POST /api/meetings
 * Create a new meeting
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, meeting_date, host_email, attendees, transcript } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title is required'
            });
        }

        const result = await query(`
            INSERT INTO meetings (user_id, title, meeting_date, host_email, attendees, transcript, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
            RETURNING id, title, status, created_at
        `, [
            req.user.id,
            title,
            meeting_date || new Date().toISOString(),
            host_email || req.user.email,
            attendees ? JSON.stringify(attendees) : null,
            transcript || null
        ]);

        res.status(201).json({
            success: true,
            message: 'Meeting created',
            meeting: result.rows[0]
        });
    } catch (error) {
        console.error('Create meeting error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create meeting'
        });
    }
});

/**
 * POST /api/meetings/:id/approve
 * Approve a meeting summary
 */
router.post('/:id/approve', authMiddleware, async (req, res) => {
    try {
        const { suggestions } = req.body;

        const meeting = await getOne(`
            SELECT * FROM meetings 
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.user.id]);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found'
            });
        }

        await query(`
            UPDATE meetings 
            SET status = 'approved', 
                approved_at = CURRENT_TIMESTAMP,
                summary = COALESCE(summary, '') || CASE WHEN $1 IS NOT NULL THEN E'\n\n---\nHost Suggestions: ' || $1 ELSE '' END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [suggestions, req.params.id]);

        res.json({
            success: true,
            message: 'Meeting approved',
            status: 'approved'
        });
    } catch (error) {
        console.error('Approve meeting error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve meeting'
        });
    }
});

module.exports = router;
