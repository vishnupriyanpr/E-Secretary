/**
 * E-Secretary Dashboard JavaScript
 * Connects to Backend API (Supabase) and n8n
 */

// Configuration - Read from global config.js (DO NOT redeclare)
const DASHBOARD_CONFIG = window.E_SECRETARY_CONFIG || {};
const API_URL = DASHBOARD_CONFIG.API_URL || 'http://localhost:3001/api';
const N8N_URL = DASHBOARD_CONFIG.N8N_URL || 'http://localhost:5678';
const REFRESH_INTERVAL = DASHBOARD_CONFIG.REFRESH_INTERVAL || 30000;

// DOM Elements
const elements = {
    n8nStatus: document.getElementById('n8nStatus'),
    totalMeetings: document.getElementById('totalMeetings'),
    pendingApproval: document.getElementById('pendingApproval'),
    completedMeetings: document.getElementById('completedMeetings'),
    emailsSent: document.getElementById('emailsSent'),
    meetingsList: document.getElementById('meetingsList'),
    workflowExecutions: document.getElementById('workflowExecutions'),
    workflowSuccess: document.getElementById('workflowSuccess'),
    refreshBtn: document.getElementById('refreshBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    userAvatar: document.getElementById('userAvatar')
};

// State
let meetings = [];
let currentUser = null;
let calendarConnected = false;

/**
 * Get time-based greeting
 */
function getGreeting(name) {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    return name ? `${greeting}, ${name.split(' ')[0]}!` : greeting;
}

/**
 * Initialize Dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();

    if (!isAuthenticated) {
        window.location.href = 'login.html';
        return;
    }

    // Set time-based greeting
    const greetingEl = document.getElementById('greeting');
    if (greetingEl && currentUser) {
        greetingEl.textContent = getGreeting(currentUser.name);
    }

    // Check for calendar connection callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('calendar') === 'connected') {
        showNotification('Google Calendar connected successfully!', 'success');
        window.history.replaceState({}, '', '/dashboard.html');
    }
    if (urlParams.get('error')) {
        showNotification('Failed to connect calendar. Please try again.', 'error');
        window.history.replaceState({}, '', '/dashboard.html');
    }

    checkN8nStatus();
    checkCalendarStatus();
    loadMeetings();
    setupEventListeners();

    // Auto-refresh
    setInterval(() => {
        checkN8nStatus();
        loadMeetings();
    }, REFRESH_INTERVAL);
});

/**
 * Check Authentication with Backend API
 */
async function checkAuth() {
    const token = localStorage.getItem('e_secretary_token');
    const userData = localStorage.getItem('e_secretary_user');

    if (!token) {
        return false;
    }

    try {
        // Verify token with backend
        const response = await fetch(`${API_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!data.success || !data.valid) {
            // Token invalid, clear storage
            localStorage.removeItem('e_secretary_token');
            localStorage.removeItem('e_secretary_user');
            return false;
        }

        // Update UI with user data
        currentUser = data.user;

        // Critical: Update localStorage with fresh data
        localStorage.setItem('e_secretary_user', JSON.stringify(currentUser));

        // Update Text
        elements.userName.textContent = currentUser.name; // strict: no fallback
        elements.userEmail.textContent = currentUser.email;

        // Avatar logic - Clean implementation
        if (currentUser.profile_picture) {
            elements.userAvatar.textContent = ''; // Clear initial text
            elements.userAvatar.style.padding = '0';
            elements.userAvatar.style.background = 'transparent';

            const img = document.createElement('img');
            img.src = currentUser.profile_picture;
            img.alt = currentUser.name;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '50%';
            elements.userAvatar.innerHTML = ''; // Start clean
            elements.userAvatar.appendChild(img);
        } else {
            // Default avatar
            elements.userAvatar.innerHTML = '';
            elements.userAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
            elements.userAvatar.style.padding = '';
            elements.userAvatar.style.background = ''; // Revert to CSS default
        }

        return true;

    } catch (error) {
        console.error('Auth check failed:', error);

        // If auth fails, DO NOT show stale data. Force re-login.
        // This prevents the "User" confusion.
        if (error.message !== 'Failed to fetch') {
            localStorage.removeItem('e_secretary_token');
            localStorage.removeItem('e_secretary_user');
            window.location.href = 'login.html';
            return false;
        }
        return false;
    }
}

/**
 * Check n8n Status
 */
async function checkN8nStatus() {
    const statusDot = elements.n8nStatus.querySelector('.status-dot');
    const statusText = elements.n8nStatus.querySelector('span:last-child');

    try {
        const response = await fetch(`${N8N_URL}/healthz`, {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusText.textContent = 'n8n: Online';
        } else {
            throw new Error('Not OK');
        }
    } catch (error) {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = 'n8n: Offline';
    }
}

/**
 * Load Meetings from Backend API (Supabase)
 */
async function loadMeetings() {
    const token = localStorage.getItem('e_secretary_token');

    try {
        const response = await fetch(`${API_URL}/meetings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.meetings) {
            meetings = data.meetings;
        } else {
            meetings = [];
        }

        // Also fetch stats
        const statsResponse = await fetch(`${API_URL}/meetings/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const statsData = await statsResponse.json();
        if (statsData.success && statsData.stats) {
            updateStatsFromAPI(statsData.stats);
        } else {
            updateStats();
        }

    } catch (error) {
        console.error('Failed to load meetings:', error);
        // Fallback to localStorage
        const storedMeetings = localStorage.getItem('e_secretary_meetings');
        if (storedMeetings) {
            try {
                meetings = JSON.parse(storedMeetings);
            } catch (e) {
                meetings = [];
            }
        }
        updateStats();
    }

    renderMeetings();
}

/**
 * Update stats from API response
 */
function updateStatsFromAPI(stats) {
    animateNumber(elements.totalMeetings, stats.total_meetings || 0);
    animateNumber(elements.pendingApproval, stats.pending || 0);
    animateNumber(elements.completedMeetings, stats.approved || 0);
    animateNumber(elements.emailsSent, stats.sent || 0);

    elements.workflowExecutions.textContent = stats.total_meetings || 0;
    const successRate = stats.total_meetings > 0
        ? Math.round(((stats.approved || 0) / stats.total_meetings) * 100)
        : 0;
    elements.workflowSuccess.textContent = successRate + '%';
}

/**
 * Update Stats Display
 */
function updateStats() {
    const total = meetings.length;
    const pending = meetings.filter(m => m.status === 'pending' || m.status === 'pending_approval').length;
    const completed = meetings.filter(m => m.status === 'approved' || m.status === 'sent').length;
    const sent = meetings.filter(m => m.status === 'sent').length;

    animateNumber(elements.totalMeetings, total);
    animateNumber(elements.pendingApproval, pending);
    animateNumber(elements.completedMeetings, completed);
    animateNumber(elements.emailsSent, sent);

    // Workflow stats
    elements.workflowExecutions.textContent = total;
    elements.workflowSuccess.textContent = total > 0
        ? Math.round((completed / total) * 100) + '%'
        : '0%';
}

/**
 * Animate Number Change
 */
function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const duration = 500;
    const steps = 20;
    const increment = (target - current) / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        element.textContent = Math.round(current + increment * step);

        if (step >= steps) {
            clearInterval(timer);
            element.textContent = target;
        }
    }, duration / steps);
}

/**
 * Render Meetings List
 */
function renderMeetings() {
    if (meetings.length === 0) {
        elements.meetingsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <path d="M12 14v.01M12 17v.01" />
                </svg>
                <h3>No meetings yet</h3>
                <p>When Fireflies sends meeting transcripts, they'll appear here.</p>
            </div>
        `;
        return;
    }

    elements.meetingsList.innerHTML = meetings
        .sort((a, b) => new Date(b.meeting_date || b.created_at) - new Date(a.meeting_date || a.created_at))
        .slice(0, 10)
        .map(meeting => `
            <div class="meeting-row" data-id="${meeting.id}">
                <div class="meeting-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    </svg>
                </div>
                <div class="meeting-info">
                    <div class="meeting-title">${meeting.title}</div>
                    <div class="meeting-meta">${formatDate(meeting.meeting_date || meeting.created_at)} • ${getAttendeeCount(meeting.attendees)} attendees</div>
                </div>
                <span class="meeting-status ${meeting.status}">${formatStatus(meeting.status)}</span>
            </div>
        `)
        .join('');
}

/**
 * Format Date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000) { // Less than 24 hours
        return 'Today';
    } else if (diff < 172800000) { // Less than 48 hours
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Format Status
 */
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'pending_approval': 'Awaiting Approval',
        'approved': 'Approved',
        'sent': 'Sent',
        'rejected': 'Rejected'
    };
    return statusMap[status] || status;
}

/**
 * Get attendee count from various formats
 */
function getAttendeeCount(attendees) {
    if (!attendees) return 0;
    if (Array.isArray(attendees)) return attendees.length;
    if (typeof attendees === 'string') {
        try {
            const parsed = JSON.parse(attendees);
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    }
    return 0;
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Refresh button
    elements.refreshBtn?.addEventListener('click', () => {
        checkN8nStatus();
        loadMeetings();

        // Animate button
        elements.refreshBtn.querySelector('svg').style.animation = 'spin 0.5s ease';
        setTimeout(() => {
            elements.refreshBtn.querySelector('svg').style.animation = '';
        }, 500);
    });

    // Logout
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('e_secretary_token');
                localStorage.removeItem('e_secretary_user');
                window.location.href = 'index.html'; // Redirect to Landing Page
            }
        });
    }
}

/**
 * Add spin animation
 */
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

/**
 * Webhook listener for real-time updates
 * This simulates receiving updates from n8n
 */
window.addEventListener('message', (event) => {
    if (event.data?.type === 'n8n_update') {
        const { meeting } = event.data;

        // Update or add meeting
        const existingIndex = meetings.findIndex(m => m.id === meeting.id);
        if (existingIndex >= 0) {
            meetings[existingIndex] = meeting;
        } else {
            meetings.unshift(meeting);
        }

        // Save and refresh
        localStorage.setItem('e_secretary_meetings', JSON.stringify(meetings));
        updateStats();
        renderMeetings();
    }
});

/**
 * Debug: Add test meeting (for development)
 */
window.addTestMeeting = () => {
    const testMeeting = {
        id: 'test-' + Date.now(),
        title: 'Test Meeting ' + new Date().toLocaleTimeString(),
        date: new Date().toISOString(),
        status: 'pending',
        attendees: [
            { email: 'user1@example.com' },
            { email: 'user2@example.com' }
        ],
        host_email: 'host@example.com'
    };

    meetings.unshift(testMeeting);
    localStorage.setItem('e_secretary_meetings', JSON.stringify(meetings));
    updateStats();
    renderMeetings();

    console.log('Test meeting added:', testMeeting);
};

/**
 * Check Google Calendar connection status
 */
async function checkCalendarStatus() {
    const connectBtn = document.getElementById('connectCalendarBtn');
    const statusBadge = document.getElementById('calendarStatus');

    try {
        const token = localStorage.getItem('e_secretary_token');
        if (!token) return;

        const response = await fetch(API_URL + '/calendar/status', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            calendarConnected = data.connected;

            // Update header UI
            if (data.connected) {
                // Show "Connected" badge, hide button
                if (connectBtn) connectBtn.style.display = 'none';
                if (statusBadge) statusBadge.style.display = 'flex';
            } else {
                // Show "Connect" button, hide badge
                if (connectBtn) connectBtn.style.display = 'flex';
                if (statusBadge) statusBadge.style.display = 'none';
            }

            // Update nav item
            const calendarNav = document.querySelector('[data-section="calendar"]');
            if (calendarNav && data.connected) {
                calendarNav.classList.add('connected');
            }
        }
    } catch (error) {
        console.error('Calendar status check failed:', error);
        // On error, show connect button as fallback
        if (connectBtn) connectBtn.style.display = 'flex';
        if (statusBadge) statusBadge.style.display = 'none';
    }
}

/**
 * Connect Google Calendar
 */
async function connectCalendar() {
    try {
        const token = localStorage.getItem('e_secretary_token');
        const response = await fetch(API_URL + '/calendar/auth-url', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            window.location.href = data.authUrl;
        } else {
            showNotification('Failed to start calendar connection', 'error');
        }
    } catch (error) {
        console.error('Calendar connection error:', error);
        showNotification('Failed to connect calendar', 'error');
    }
}

/**
 * Show notification toast
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification-toast').forEach(n => n.remove());

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);
}

// Add notification animation
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    .nav-item.connected::after {
        content: '✓';
        margin-left: auto;
        color: #22c55e;
        font-size: 0.75rem;
    }
`;
document.head.appendChild(notificationStyle);

// Expose for debugging
window.connectCalendar = connectCalendar;
