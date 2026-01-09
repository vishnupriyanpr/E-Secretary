/**
 * E-Secretary Backend - Fireflies.ai Integration
 * Fetches meeting transcripts from Fireflies API
 */

const express = require('express');
const { authMiddleware } = require('./auth');

const router = express.Router();

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;
const FIREFLIES_GRAPHQL_URL = 'https://api.fireflies.ai/graphql';

/**
 * GraphQL query to fetch recent transcripts
 */
const TRANSCRIPTS_QUERY = `
    query RecentTranscripts($limit: Int) {
        transcripts(limit: $limit) {
            id
            title
            date
            duration
            transcript_url
            audio_url
            video_url
            participants
            summary {
                overview
                action_items
                keywords
            }
            sentences {
                text
                speaker_name
            }
            meeting_attendees {
                displayName
                email
                name
            }
        }
    }
`;

/**
 * GraphQL query to fetch a single transcript
 */
const TRANSCRIPT_DETAIL_QUERY = `
    query TranscriptDetail($id: String!) {
        transcript(id: $id) {
            id
            title
            date
            duration
            transcript_url
            audio_url
            video_url
            participants
            summary {
                overview
                action_items
                keywords
                outline
                shorthand_bullet
            }
            sentences {
                text
                speaker_name
                start_time
                end_time
            }
            meeting_attendees {
                displayName
                email
                name
            }
        }
    }
`;

/**
 * Helper: Execute GraphQL query against Fireflies API
 */
async function firefliesQuery(query, variables = {}) {
    const response = await fetch(FIREFLIES_GRAPHQL_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${FIREFLIES_API_KEY}`
        },
        body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors) {
        console.error('Fireflies API errors:', data.errors);
        throw new Error(data.errors[0]?.message || 'Fireflies API error');
    }

    return data.data;
}

/**
 * GET /api/fireflies/transcripts
 * Fetch recent meeting transcripts
 */
router.get('/transcripts', authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const data = await firefliesQuery(TRANSCRIPTS_QUERY, { limit });

        // Format transcripts for frontend
        const transcripts = (data.transcripts || []).map(t => ({
            id: t.id,
            title: t.title || 'Untitled Meeting',
            date: t.date,
            duration: t.duration, // in minutes
            durationFormatted: formatDuration(t.duration),
            transcriptUrl: t.transcript_url,
            audioUrl: t.audio_url,
            videoUrl: t.video_url,
            participants: t.participants || [],
            attendees: t.meeting_attendees || [],
            summary: t.summary?.overview || null,
            actionItems: t.summary?.action_items || [],
            keywords: t.summary?.keywords || [],
            sentenceCount: t.sentences?.length || 0
        }));

        res.json({
            success: true,
            transcripts,
            count: transcripts.length
        });

    } catch (error) {
        console.error('Fireflies transcripts error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch transcripts'
        });
    }
});

/**
 * GET /api/fireflies/transcript/:id
 * Fetch detailed transcript by ID
 */
router.get('/transcript/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const data = await firefliesQuery(TRANSCRIPT_DETAIL_QUERY, { id });

        if (!data.transcript) {
            return res.status(404).json({
                success: false,
                error: 'Transcript not found'
            });
        }

        const t = data.transcript;

        res.json({
            success: true,
            transcript: {
                id: t.id,
                title: t.title || 'Untitled Meeting',
                date: t.date,
                duration: t.duration,
                durationFormatted: formatDuration(t.duration),
                transcriptUrl: t.transcript_url,
                audioUrl: t.audio_url,
                videoUrl: t.video_url,
                participants: t.participants || [],
                attendees: t.meeting_attendees || [],
                summary: {
                    overview: t.summary?.overview || '',
                    actionItems: t.summary?.action_items || [],
                    keywords: t.summary?.keywords || [],
                    outline: t.summary?.outline || '',
                    bullets: t.summary?.shorthand_bullet || ''
                },
                sentences: (t.sentences || []).map(s => ({
                    text: s.text,
                    speaker: s.speaker_name,
                    startTime: s.start_time,
                    endTime: s.end_time
                }))
            }
        });

    } catch (error) {
        console.error('Fireflies transcript detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch transcript'
        });
    }
});

/**
 * GET /api/fireflies/status
 * Check if Fireflies API is configured and working
 */
router.get('/status', authMiddleware, async (req, res) => {
    try {
        if (!FIREFLIES_API_KEY) {
            return res.json({
                success: true,
                connected: false,
                message: 'Fireflies API key not configured'
            });
        }

        // Test the API with a minimal query
        const data = await firefliesQuery(`{ user { email name } }`);

        res.json({
            success: true,
            connected: true,
            user: data.user
        });

    } catch (error) {
        console.error('Fireflies status error:', error);
        res.json({
            success: true,
            connected: false,
            message: error.message
        });
    }
});

/**
 * Helper: Format duration in minutes to human-readable
 */
function formatDuration(minutes) {
    if (!minutes) return 'Unknown';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

module.exports = router;
