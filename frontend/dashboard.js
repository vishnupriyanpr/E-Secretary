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
 * Get current page name from URL
 */
function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop().replace('.html', '') || 'dashboard';
    return page;
}

/**
 * Initialize Dashboard (page-aware)
 */
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();

    if (!isAuthenticated) {
        window.location.href = 'login.html';
        return;
    }

    const currentPage = getCurrentPage();

    // Set time-based greeting (only on dashboard)
    const greetingEl = document.getElementById('greeting');
    if (greetingEl && currentUser) {
        greetingEl.textContent = getGreeting(currentUser.name);
    }

    // Check for calendar connection callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('calendar') === 'connected') {
        showNotification('Google Calendar connected successfully!', 'success');
        window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlParams.get('error')) {
        showNotification('Failed to connect calendar. Please try again.', 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Common initialization for all pages
    checkN8nStatus();
    setupSidebarActiveState(currentPage);
    setupEventListeners();

    // Page-specific initialization
    switch (currentPage) {
        case 'dashboard':
            checkCalendarStatus();
            loadMeetings();
            break;
        case 'meetings':
            checkCalendarStatus();
            loadMeetings();
            break;
        case 'transcripts':
            loadFirefliesTranscripts();
            break;
        case 'calendar':
            checkCalendarStatus();
            initCalendarPage();
            break;
        case 'settings':
            await checkCalendarStatus();
            updateSettingsCalendarStatus();
            if (currentUser) {
                const emailEl = document.getElementById('settingsUserEmail');
                if (emailEl) emailEl.textContent = currentUser.email;
            }
            break;
        case 'workflow':
            // No specific init needed
            break;
    }

    // Auto-refresh only on relevant pages
    if (['meetings', 'dashboard'].includes(currentPage)) {
        setInterval(() => {
            checkN8nStatus();
            loadMeetings();
        }, REFRESH_INTERVAL);
    }
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
/**
 * Show notification toast with professional UI
 */
function showNotification(message, type = 'info') {
    // Remove existing notifications to prevent stacking overflow
    document.querySelectorAll('.notification-toast').forEach(n => {
        n.style.animation = 'toastSlideOut 0.2s ease forwards';
        setTimeout(() => n.remove(), 200);
    });

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;

    // Select Icon
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <div class="notification-icon">${iconSvg}</div>
        <div class="notification-content">${message}</div>
        <button class="notification-close" onclick="closeNotification(this.parentElement)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        closeNotification(toast);
    }, 5000);
}

function closeNotification(toast) {
    if (!toast) return;
    toast.style.animation = 'toastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 400);
}

// Remove the old inline style injection since it's now in CSS

// Expose for debugging
window.connectCalendar = connectCalendar;

/**
 * Load Google Calendar Events
 */
async function loadCalendarEvents() {
    const calendarSection = document.getElementById('calendarSection');
    const eventsGrid = document.getElementById('calendarEventsGrid');

    if (!calendarConnected || !calendarSection) return;

    // Show section
    calendarSection.style.display = 'block';

    try {
        const token = localStorage.getItem('e_secretary_token');
        const response = await fetch(`${API_URL}/calendar/events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success && data.events) {
            renderCalendarEvents(data.events);
        } else if (data.needsAuth) {
            // Token expired, need to reconnect
            calendarConnected = false;
            calendarSection.style.display = 'none';
            document.getElementById('connectCalendarBtn').style.display = 'flex';
            document.getElementById('calendarStatus').style.display = 'none';
        } else {
            renderCalendarEvents([]);
        }
    } catch (error) {
        console.error('Failed to load calendar events:', error);
        eventsGrid.innerHTML = `
            <div class="calendar-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <h3>Failed to load events</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

/**
 * Render Calendar Events with Premium UI
 */
function renderCalendarEvents(events) {
    const eventsGrid = document.getElementById('calendarEventsGrid');

    if (!events || events.length === 0) {
        eventsGrid.innerHTML = `
            <div class="calendar-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <h3>No upcoming events</h3>
                <p>Your calendar is clear for the next 30 days.</p>
            </div>
        `;
        return;
    }

    eventsGrid.innerHTML = events.map(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const now = new Date();
        const isToday = startDate.toDateString() === now.toDateString();
        const isWithinHour = (startDate - now) < 3600000 && (startDate - now) > 0;

        // Format date/time
        const dateStr = startDate.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = startDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const endTimeStr = endDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Duration
        const durationMs = endDate - startDate;
        const durationMins = Math.round(durationMs / 60000);
        const durationStr = durationMins >= 60
            ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
            : `${durationMins}m`;

        // Card class
        let cardClass = 'event-card';
        if (isToday) cardClass += ' today';
        if (isWithinHour) cardClass += ' urgent';

        // Time badge
        let badgeClass = 'event-time-badge';
        let badgeText = dateStr;
        if (isToday) {
            badgeClass += ' today';
            badgeText = isWithinHour ? '🔴 Starting Soon' : '📅 Today';
        }

        return `
            <div class="${cardClass}">
                <div class="${badgeClass}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${badgeText}
                </div>
                
                <div class="event-title">${escapeHtml(event.title)}</div>
                
                <div class="event-datetime">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${timeStr} - ${endTimeStr}
                </div>
                
                <div class="event-meta">
                    <span class="event-meta-tag">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${durationStr}
                    </span>
                    ${event.attendees && event.attendees.length > 0 ? `
                        <span class="event-meta-tag">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            ${event.attendees.length} attendee${event.attendees.length > 1 ? 's' : ''}
                        </span>
                    ` : ''}
                    ${event.location ? `
                        <span class="event-meta-tag">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            ${escapeHtml(event.location.substring(0, 20))}${event.location.length > 20 ? '...' : ''}
                        </span>
                    ` : ''}
                </div>
                
                <div class="event-actions">
                    ${event.meetLink ? `
                        <a href="${event.meetLink}" target="_blank" class="event-action-btn meet-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14v-4z"/>
                                <rect x="1" y="6" width="14" height="12" rx="2" ry="2"/>
                            </svg>
                            Join Meeting
                        </a>
                    ` : `
                        <a href="https://calendar.google.com/calendar/event?eid=${btoa(event.id)}" target="_blank" class="event-action-btn view-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                            View Details
                        </a>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Disconnect Calendar
 */
async function disconnectCalendar() {
    if (!confirm('Are you sure you want to disconnect your Google Calendar?')) return;

    try {
        const token = localStorage.getItem('e_secretary_token');
        const response = await fetch(`${API_URL}/calendar/disconnect`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            calendarConnected = false;
            document.getElementById('calendarSection').style.display = 'none';
            document.getElementById('connectCalendarBtn').style.display = 'flex';
            document.getElementById('calendarStatus').style.display = 'none';
            showNotification('Calendar disconnected', 'info');
        }
    } catch (error) {
        console.error('Disconnect error:', error);
        showNotification('Failed to disconnect calendar', 'error');
    }
}

// Setup calendar refresh button
document.addEventListener('DOMContentLoaded', () => {
    const refreshCalBtn = document.getElementById('refreshCalendarBtn');
    const disconnectBtn = document.getElementById('disconnectCalBtn');

    if (refreshCalBtn) {
        refreshCalBtn.addEventListener('click', () => {
            loadCalendarEvents();
            refreshCalBtn.querySelector('svg').style.animation = 'spin 0.5s ease';
            setTimeout(() => {
                refreshCalBtn.querySelector('svg').style.animation = '';
            }, 500);
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectCalendar);
    }
});

// Modify checkCalendarStatus to also load events
const originalCheckCalendarStatus = checkCalendarStatus;
checkCalendarStatus = async function () {
    await originalCheckCalendarStatus();
    if (calendarConnected) {
        loadCalendarEvents();
    }
};

// ========== FIREFLIES TRANSCRIPTS ==========

/**
 * Load Fireflies Transcripts
 */
async function loadFirefliesTranscripts() {
    const transcriptsGrid = document.getElementById('transcriptsGrid');

    if (!transcriptsGrid) return;

    try {
        const token = localStorage.getItem('e_secretary_token');
        const response = await fetch(`${API_URL}/fireflies/transcripts?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success && data.transcripts) {
            renderTranscripts(data.transcripts);
        } else {
            renderTranscripts([]);
        }
    } catch (error) {
        console.error('Failed to load Fireflies transcripts:', error);
        transcriptsGrid.innerHTML = `
            <div class="transcripts-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                <h3>Failed to load transcripts</h3>
                <p>Check your Fireflies API key configuration.</p>
            </div>
        `;
    }
}

/**
 * Render Fireflies Transcripts
 */
function renderTranscripts(transcripts) {
    const transcriptsGrid = document.getElementById('transcriptsGrid');

    if (!transcripts || transcripts.length === 0) {
        transcriptsGrid.innerHTML = `
            <div class="transcripts-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <h3>No transcripts yet</h3>
                <p>Your Fireflies meeting transcripts will appear here.</p>
            </div>
        `;
        return;
    }

    transcriptsGrid.innerHTML = transcripts.map(t => {
        const date = new Date(t.date);
        const dateStr = date.toLocaleDateString('en-IN', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        const keywords = (t.keywords || []).slice(0, 3);

        return `
            <div class="transcript-card">
                <div class="transcript-header">
                    <div class="transcript-date-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${dateStr}
                    </div>
                    <div class="transcript-duration">${t.durationFormatted}</div>
                </div>
                
                <div class="transcript-title">${escapeHtml(t.title)}</div>
                
                ${t.summary ? `<div class="transcript-summary">${escapeHtml(t.summary)}</div>` : ''}
                
                ${keywords.length > 0 ? `
                    <div class="transcript-meta">
                        ${keywords.map(k => `<span class="transcript-keyword">${escapeHtml(k)}</span>`).join('')}
                    </div>
                ` : ''}
                
                <div class="transcript-actions">
                    ${t.transcriptUrl ? `
                        <a href="${t.transcriptUrl}" target="_blank" class="transcript-action-btn primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                            </svg>
                            View Transcript
                        </a>
                    ` : ''}
                    ${t.audioUrl ? `
                        <a href="${t.audioUrl}" target="_blank" class="transcript-action-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Audio
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ========== EMBEDDED GOOGLE CALENDAR ==========

/**
 * Show Embedded Google Calendar
 */
function showEmbeddedCalendar() {
    const section = document.getElementById('embeddedCalendarSection');
    const iframe = document.getElementById('googleCalendarEmbed');

    if (!section || !iframe) return;

    // Google Calendar embed URL (public agenda view)
    // Note: For personalized calendar, user needs to use the Google Calendar link
    const calendarEmbedUrl = `https://calendar.google.com/calendar/embed?mode=AGENDA&height=600&wkst=1&bgcolor=%23030712&ctz=Asia/Kolkata&showTitle=0&showNav=1&showPrint=0&showTabs=1&showCalendars=0&showTz=1`;

    iframe.src = calendarEmbedUrl;
    section.style.display = 'block';

    // Scroll to calendar section
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hide Embedded Google Calendar
 */
function hideEmbeddedCalendar() {
    const section = document.getElementById('embeddedCalendarSection');
    const iframe = document.getElementById('googleCalendarEmbed');

    if (section) section.style.display = 'none';
    if (iframe) iframe.src = ''; // Stop loading
}

// ========== SIDEBAR NAVIGATION ==========

/**
 * Setup Sidebar Active State based on current page
 */
function setupSidebarActiveState(currentPage) {
    const navItems = document.querySelectorAll('.nav-item[data-section]');

    navItems.forEach(item => {
        item.classList.remove('active');
        const section = item.dataset.section;
        if (section === currentPage) {
            item.classList.add('active');
        }
    });
}

/**
 * Initialize Calendar Page (show/hide sections based on connection status)
 */
function initCalendarPage() {
    // This will be called after checkCalendarStatus updates calendarConnected
    setTimeout(() => {
        const calendarSection = document.getElementById('calendarSection');
        const embeddedSection = document.getElementById('embeddedCalendarSection');
        const connectPrompt = document.getElementById('calendarConnectPrompt');

        if (calendarConnected) {
            if (calendarSection) calendarSection.style.display = 'block';
            if (embeddedSection) {
                showEmbeddedCalendar();
            }
            if (connectPrompt) connectPrompt.style.display = 'none';
        } else {
            if (calendarSection) calendarSection.style.display = 'none';
            if (embeddedSection) embeddedSection.style.display = 'none';
            if (connectPrompt) connectPrompt.style.display = 'block';
        }
    }, 500); // Wait for calendar status check
}

/**
 * Setup Sidebar Navigation (no longer prevents default - allows natural page navigation)
 */
function setupSidebarNavigation() {
    // Navigation links now work naturally, no JS interception needed
    // This function kept for backwards compatibility
}


// ========== SETTINGS SECTION ==========

/**
 * Show Settings Section
 */
function showSettingsSection() {
    const settingsSection = document.getElementById('settingsSection');
    if (!settingsSection) return;

    settingsSection.style.display = 'block';
    settingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Update user info
    if (currentUser) {
        const emailEl = document.getElementById('settingsUserEmail');
        if (emailEl) emailEl.textContent = currentUser.email;
    }

    // Update calendar status
    updateSettingsCalendarStatus();
}

/**
 * Hide Settings Section
 */
function hideSettingsSection() {
    const settingsSection = document.getElementById('settingsSection');
    if (settingsSection) settingsSection.style.display = 'none';
}

/**
 * Update Settings Calendar Status
 */
function updateSettingsCalendarStatus() {
    const statusEl = document.getElementById('settingsCalendarStatus');
    const connectBtn = document.getElementById('settingsConnectCalBtn');
    const disconnectBtn = document.getElementById('settingsDisconnectCalBtn');

    if (calendarConnected) {
        if (statusEl) statusEl.textContent = 'Connected';
        if (statusEl) statusEl.style.color = '#22c55e';
        if (connectBtn) connectBtn.style.display = 'none';
        if (disconnectBtn) disconnectBtn.style.display = 'flex';
    } else {
        if (statusEl) statusEl.textContent = 'Not Connected';
        if (statusEl) statusEl.style.color = '#64748b';
        if (connectBtn) connectBtn.style.display = 'flex';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
    }
}

// Setup event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Load Fireflies transcripts
    loadFirefliesTranscripts();

    // Setup sidebar navigation
    setupSidebarNavigation();

    // Transcripts refresh button
    const refreshTransBtn = document.getElementById('refreshTranscriptsBtn');
    if (refreshTransBtn) {
        refreshTransBtn.addEventListener('click', () => {
            loadFirefliesTranscripts();
            refreshTransBtn.querySelector('svg').style.animation = 'spin 0.5s ease';
            setTimeout(() => {
                refreshTransBtn.querySelector('svg').style.animation = '';
            }, 500);
        });
    }

    // Close calendar button
    const closeCalBtn = document.getElementById('closeCalendarBtn');
    if (closeCalBtn) {
        closeCalBtn.addEventListener('click', hideEmbeddedCalendar);
    }

    // Settings logout button
    const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');
    if (settingsLogoutBtn) {
        settingsLogoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('e_secretary_token');
                localStorage.removeItem('e_secretary_user');
                window.location.href = 'index.html';
            }
        });
    }

    // Settings connect calendar button
    const settingsConnectCalBtn = document.getElementById('settingsConnectCalBtn');
    if (settingsConnectCalBtn) {
        settingsConnectCalBtn.addEventListener('click', connectCalendar);
    }

    // Settings disconnect calendar button
    const settingsDisconnectCalBtn = document.getElementById('settingsDisconnectCalBtn');
    if (settingsDisconnectCalBtn) {
        settingsDisconnectCalBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to disconnect your Google Calendar?')) return;

            try {
                const token = localStorage.getItem('e_secretary_token');
                const response = await fetch(`${API_URL}/calendar/disconnect`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    calendarConnected = false;
                    document.getElementById('calendarSection').style.display = 'none';
                    document.getElementById('connectCalendarBtn').style.display = 'flex';
                    document.getElementById('calendarStatus').style.display = 'none';
                    updateSettingsCalendarStatus();

                    // Remove connected class from nav
                    const calendarNav = document.querySelector('[data-section="calendar"]');
                    if (calendarNav) calendarNav.classList.remove('connected');

                    showNotification('Calendar disconnected', 'info');
                }
            } catch (error) {
                console.error('Disconnect error:', error);
                showNotification('Failed to disconnect calendar', 'error');
            }
        });
    }
});
