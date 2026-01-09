/**
 * E-Secretary Backend - Google Calendar Routes
 * Handles calendar sync and event retrieval using Google Calendar API
 */

const express = require('express');
const { google } = require('googleapis');
const { query, getOne } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// Google OAuth2 Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Dynamic redirect URI - supports both local and production (Render)
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ||
    (process.env.BACKEND_URL
        ? `${process.env.BACKEND_URL}/api/auth/google/callback`
        : 'http://localhost:3001/api/auth/google/callback');

// OAuth2 Scopes for Calendar - FULL ACCESS for creating events
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar' // Full read/write access
];

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );
}

/**
 * GET /api/calendar/auth-url
 * Generate Google OAuth URL for calendar permission
 */
router.get('/auth-url', authMiddleware, (req, res) => {
    console.log('=== OAuth Debug ===');
    console.log('GOOGLE_REDIRECT_URI from env:', process.env.GOOGLE_REDIRECT_URI);
    console.log('Using redirect URI:', GOOGLE_REDIRECT_URI);

    const oauth2Client = createOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to get refresh token
        state: req.user.id // Pass user ID to callback
    });

    console.log('Generated Auth URL:', authUrl);
    res.json({ success: true, authUrl });
});

/**
 * GET /api/calendar/events
 * Fetch user's calendar events
 */
router.get('/events', authMiddleware, async (req, res) => {
    try {
        // Get user's tokens from database
        const user = await getOne(
            'SELECT google_access_token, google_refresh_token, token_expires_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user || !user.google_refresh_token) {
            return res.status(401).json({
                success: false,
                error: 'Calendar not connected. Please authorize calendar access.',
                needsAuth: true
            });
        }

        // Create OAuth2 client with user's tokens
        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
            access_token: user.google_access_token,
            refresh_token: user.google_refresh_token
        });

        // Check if token is expired and refresh if needed
        const tokenExpiry = new Date(user.token_expires_at);
        if (tokenExpiry < new Date()) {
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                await query(
                    'UPDATE users SET google_access_token = $1, token_expires_at = $2 WHERE id = $3',
                    [credentials.access_token, new Date(credentials.expiry_date), req.user.id]
                );
                oauth2Client.setCredentials(credentials);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                return res.status(401).json({
                    success: false,
                    error: 'Calendar authorization expired. Please re-authorize.',
                    needsAuth: true
                });
            }
        }

        // Fetch calendar events
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const now = new Date();
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: oneMonthFromNow.toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items.map(event => ({
            id: event.id,
            title: event.summary || 'No title',
            description: event.description || '',
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            location: event.location || '',
            attendees: event.attendees?.map(a => a.email) || [],
            meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || null,
            status: event.status
        }));

        res.json({
            success: true,
            events,
            count: events.length
        });

    } catch (error) {
        console.error('Calendar fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch calendar events'
        });
    }
});

/**
 * GET /api/calendar/status
 * Check if user has connected their calendar
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        const user = await getOne(
            'SELECT google_refresh_token FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            connected: !!user?.google_refresh_token
        });
    } catch (error) {
        console.error('Calendar status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check calendar status'
        });
    }
});

/**
 * POST /api/calendar/disconnect
 * Remove calendar connection
 */
router.post('/disconnect', authMiddleware, async (req, res) => {
    try {
        await query(
            'UPDATE users SET google_access_token = NULL, google_refresh_token = NULL, token_expires_at = NULL WHERE id = $1',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Calendar disconnected successfully'
        });
    } catch (error) {
        console.error('Calendar disconnect error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to disconnect calendar'
        });
    }
});

/**
 * POST /api/calendar/create-event
 * Create a new Google Calendar event (with optional Google Meet link)
 */
router.post('/create-event', authMiddleware, async (req, res) => {
    try {
        const { title, description, startTime, endTime, attendees, addMeetLink, meetingId } = req.body;

        // Validation
        if (!title || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                error: 'Title, startTime, and endTime are required'
            });
        }

        // Get user's tokens from database
        const user = await getOne(
            'SELECT google_access_token, google_refresh_token, token_expires_at, email FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user || !user.google_refresh_token) {
            return res.status(401).json({
                success: false,
                error: 'Calendar not connected. Please authorize calendar access.',
                needsAuth: true
            });
        }

        // Create OAuth2 client with user's tokens
        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
            access_token: user.google_access_token,
            refresh_token: user.google_refresh_token
        });

        // Refresh token if expired
        const tokenExpiry = new Date(user.token_expires_at);
        if (tokenExpiry < new Date()) {
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();
                await query(
                    'UPDATE users SET google_access_token = $1, token_expires_at = $2 WHERE id = $3',
                    [credentials.access_token, new Date(credentials.expiry_date), req.user.id]
                );
                oauth2Client.setCredentials(credentials);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                return res.status(401).json({
                    success: false,
                    error: 'Calendar authorization expired. Please re-authorize.',
                    needsAuth: true
                });
            }
        }

        // Create calendar event
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const eventData = {
            summary: title,
            description: description || '',
            start: {
                dateTime: new Date(startTime).toISOString(),
                timeZone: 'Asia/Kolkata' // Use IST for India
            },
            end: {
                dateTime: new Date(endTime).toISOString(),
                timeZone: 'Asia/Kolkata'
            },
            attendees: attendees?.map(email => ({ email })) || [],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 30 }       // 30 min before
                ]
            }
        };

        // Add Google Meet link if requested
        if (addMeetLink) {
            eventData.conferenceData = {
                createRequest: {
                    requestId: `esec-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            };
        }

        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: eventData,
            conferenceDataVersion: addMeetLink ? 1 : 0,
            sendUpdates: 'all' // Send invites to attendees
        });

        const createdEvent = response.data;
        const meetLink = createdEvent.hangoutLink || createdEvent.conferenceData?.entryPoints?.[0]?.uri || null;

        // If meetingId provided, link the Google event to the E-Secretary meeting
        if (meetingId) {
            await query(
                'UPDATE meetings SET google_event_id = $1 WHERE id = $2 AND user_id = $3',
                [createdEvent.id, meetingId, req.user.id]
            );
        }

        console.log(`Created Google Calendar event: ${createdEvent.id}`);

        res.json({
            success: true,
            event: {
                id: createdEvent.id,
                title: createdEvent.summary,
                start: createdEvent.start.dateTime,
                end: createdEvent.end.dateTime,
                meetLink,
                htmlLink: createdEvent.htmlLink // Link to view in Google Calendar
            }
        });

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create calendar event'
        });
    }
});

/**
 * DELETE /api/calendar/event/:eventId
 * Delete a Google Calendar event
 */
router.delete('/event/:eventId', authMiddleware, async (req, res) => {
    try {
        const { eventId } = req.params;

        // Get user's tokens
        const user = await getOne(
            'SELECT google_access_token, google_refresh_token FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user || !user.google_refresh_token) {
            return res.status(401).json({
                success: false,
                error: 'Calendar not connected'
            });
        }

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
            access_token: user.google_access_token,
            refresh_token: user.google_refresh_token
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
        });

        // Remove link from meetings table
        await query(
            'UPDATE meetings SET google_event_id = NULL WHERE google_event_id = $1 AND user_id = $2',
            [eventId, req.user.id]
        );

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete calendar event'
        });
    }
});

module.exports = router;

