/**
 * E-Secretary Backend - Webhook Routes (Supabase)
 */

const express = require('express');
const { query, getOne } = require('../db');

const router = express.Router();

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/fireflies-transcript';

/**
 * POST /api/webhook/meeting-end
 * Triggered when a meeting ends, forwards to n8n
 */
router.post('/meeting-end', async (req, res) => {
    try {
        const { meeting_id, title, host_email, attendees, transcript, user_id } = req.body;

        if (!meeting_id) {
            return res.status(400).json({
                success: false,
                error: 'meeting_id is required'
            });
        }

        // Forward to n8n workflow
        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    meeting_id,
                    title,
                    host_email,
                    attendees,
                    transcript,
                    callback_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/webhook/n8n-callback`
                })
            });

            const n8nResponse = await response.json();

            res.json({
                success: true,
                message: 'Webhook forwarded to n8n',
                n8n_response: n8nResponse
            });

        } catch (n8nError) {
            console.error('n8n forward error:', n8nError.message);
            res.status(202).json({
                success: true,
                message: 'Webhook received but n8n forward failed',
                error: n8nError.message
            });
        }

    } catch (error) {
        console.error('Meeting end webhook error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed'
        });
    }
});

/**
 * POST /api/webhook/n8n-callback
 * Called by n8n to update meeting status
 */
router.post('/n8n-callback', async (req, res) => {
    try {
        const { meeting_id, action, summary, action_items } = req.body;

        if (!meeting_id || !action) {
            return res.status(400).json({
                success: false,
                error: 'meeting_id and action are required'
            });
        }

        switch (action) {
            case 'summary_ready':
                await query(`
                    UPDATE meetings 
                    SET summary = $1, 
                        action_items = $2, 
                        status = 'pending_approval',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [summary, JSON.stringify(action_items || []), meeting_id]);
                break;

            case 'host_approved':
                await query(`
                    UPDATE meetings 
                    SET status = 'approved', 
                        approved_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [meeting_id]);
                break;

            case 'emails_sent':
                await query(`
                    UPDATE meetings 
                    SET status = 'sent',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [meeting_id]);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Unknown action'
                });
        }

        res.json({
            success: true,
            message: 'Callback processed',
            action
        });

    } catch (error) {
        console.error('n8n callback error:', error);
        res.status(500).json({
            success: false,
            error: 'Callback processing failed'
        });
    }
});

module.exports = router;
