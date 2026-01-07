/**
 * E-Secretary Frontend Configuration
 * This file configures the API endpoint based on environment
 */

const CONFIG = {
    // API URL - Change this when deploying
    // Local development
    // API_URL: 'http://localhost:3001/api',

    // Production (Render) - Replace with your actual Render URL
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3001/api'
        : 'https://e-secretary-api.onrender.com/api',  // <-- Replace with your Render URL

    // n8n URL (for dashboard status check)
    N8N_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:5678'
        : 'https://e-secretary-beta.onrender.com',  // n8n deployed on Render

    // Refresh interval for dashboard
    REFRESH_INTERVAL: 30000
};

// Make it available globally
window.E_SECRETARY_CONFIG = CONFIG;
