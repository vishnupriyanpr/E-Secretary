================================================================================
                    E-SECRETARY - COMPLETE DEPLOYMENT GUIDE
================================================================================

This document contains EVERYTHING needed to deploy E-Secretary from scratch.

================================================================================
                              ARCHITECTURE OVERVIEW
================================================================================

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   FRONTEND      │      │   BACKEND       │      │   DATABASE      │
│   (Vercel)      │ ───► │   (Render)      │ ───► │   (Supabase)    │
│   Static HTML   │      │   Node.js API   │      │   PostgreSQL    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                │
                                ▼
                         ┌─────────────────┐
                         │   n8n WORKFLOW  │
                         │   (Render)      │
                         │   Automation    │
                         └─────────────────┘

Memory Usage:
- Backend: ~50-80MB RAM (512MB Render free tier is MORE than enough)
- n8n: ~200-400MB RAM (needs separate Render account)

================================================================================
                              CREDENTIALS REFERENCE
================================================================================

### SUPABASE DATABASE ###
Project URL:      https://kbyksovlslnrbeyklxtn.supabase.co
Dashboard:        https://supabase.com/dashboard/project/kbyksovlslnrbeyklxtn
API Key:          sb_publishable_TML5rnltDXoPl84_-qFG8g_vOvI4FQA

PostgreSQL Connection:
  Host:           aws-1-ap-south-1.pooler.supabase.com
  Port:           6543
  Database:       postgres
  User:           postgres.kbyksovlslnrbeyklxtn
  Password:       Vishnu@123_V
  SSL:            Required (true)

### n8n WORKFLOW (Already Deployed) ###
Dashboard:        https://e-secretary-beta.onrender.com
Workflow URL:     https://e-secretary-beta.onrender.com/workflow/NsqsQdmWGXNW0I8f
Webhook URL:      https://e-secretary-beta.onrender.com/webhook/fireflies-transcript

### SAMPLE LOGIN ACCOUNTS ###
  Email:          admin@esecretary.gmail.com
  Password:       123456

  Email:          demo@esecretary.com
  Password:       demo123

================================================================================
                         STEP 1: LOCAL DEVELOPMENT
================================================================================

1. Clone/download the project

2. Install and run backend:
   cd backend
   npm run setup
   
   This single command:
   - Installs all dependencies
   - Creates sample users in Supabase
   - Starts the server on http://localhost:3001

3. Open frontend:
   - Open frontend/index.html in your browser
   - Or use Live Server extension in VS Code

4. Test login:
   - Click "Get Started" or "Sign In"
   - Use: admin@esecretary.gmail.com / 123456

================================================================================
                         STEP 2: DEPLOY BACKEND TO RENDER
================================================================================

### 2.1 Push to GitHub ###

Create a new GitHub repository and push the entire project:
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/vishnupriyanpr/e-secretary.git
  git push -u origin main

### 2.2 Create Render Account ###

1. Go to: https://render.com
2. Sign up with GitHub (recommended)
3. You need TWO Render accounts for free tier:
   - Account 1: n8n workflow (ALREADY DEPLOYED at e-secretary-beta.onrender.com)
   - Account 2: Backend API (NEW - deploy using instructions below)

### 2.3 Create Web Service ###

1. Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:

   Name:                e-secretary-backend
   Region:              Singapore (closest to India)
   Branch:              main
   Root Directory:      backend
   Runtime:             Node
   Build Command:       npm install
   Start Command:       npm start
   Instance Type:       Free (512 MB)

### 2.4 Add Environment Variables ###

In Render dashboard → Environment → Add the following:

Key                 Value
---                 -----
NODE_ENV            production
PORT                10000
JWT_SECRET          e-secretary-jwt-secret-change-in-production-2024
DB_HOST             aws-1-ap-south-1.pooler.supabase.com
DB_PORT             6543
DB_NAME             postgres
DB_USER             postgres.kbyksovlslnrbeyklxtn
DB_PASSWORD         Vishnu@123_V
DB_SSL              true
N8N_WEBHOOK_URL     https://e-secretary-beta.onrender.com/webhook/fireflies-transcript

### 2.5 Deploy ###

Click "Create Web Service" → Wait for deployment (~2-3 minutes)
Your backend URL: https://e-secretary-backend.onrender.com

### 2.6 Verify ###

Test the health endpoint:
  https://e-secretary-backend.onrender.com/api/health

Should return: {"status":"ok","database":"Supabase PostgreSQL"}

================================================================================
                         STEP 3: DEPLOY FRONTEND TO VERCEL
================================================================================

### 3.1 Update config.js ###

Before deploying, edit frontend/config.js:

  API_URL: window.location.hostname === 'localhost' 
      ? 'http://localhost:3001/api'
      : 'https://e-secretary-backend.onrender.com/api',  // <-- YOUR RENDER URL
  
  N8N_URL: window.location.hostname === 'localhost'
      ? 'http://localhost:5678'
      : 'https://e-secretary-beta.onrender.com',  // <-- n8n on Render

### 3.2 Deploy to Vercel ###

1. Go to: https://vercel.com
2. Sign up with GitHub
3. Import your repository
4. Configure:
   
   Framework Preset:    Other
   Root Directory:      frontend
   Build Command:       (leave empty)
   Output Directory:    (leave empty - use .)

5. Deploy!

Your frontend URL: https://e-secretary.vercel.app

================================================================================
                         STEP 4: CONFIGURE n8n WORKFLOW
================================================================================

n8n is ALREADY DEPLOYED at: https://e-secretary-beta.onrender.com

1. Open n8n dashboard: https://e-secretary-beta.onrender.com
2. The workflow is at: /workflow/NsqsQdmWGXNW0I8f
3. Configure credentials (if not already done):
   - Gemini API Key: Get from https://ai.google.dev/
   - Gmail OAuth2: Set up in Google Cloud Console
4. Activate the workflow
5. Webhook URL (already set in backend): 
   https://e-secretary-beta.onrender.com/webhook/fireflies-transcript

================================================================================
                         STEP 5: CONNECT FIREFLIES.AI
================================================================================

1. Log in to Fireflies.ai
2. Go to Settings → Integrations → Webhooks
3. Add webhook URL:
   https://e-secretary-beta.onrender.com/webhook/fireflies-transcript
4. Enable "Send transcript on meeting end"

================================================================================
                              TROUBLESHOOTING
================================================================================

### Backend won't start on Render ###
- Check Environment Variables are set correctly
- Check Logs tab in Render dashboard
- Ensure DB_PASSWORD doesn't have special chars that need escaping

### Can't connect to Supabase ###
- Verify the host is: aws-1-ap-south-1.pooler.supabase.com (not the direct URL)
- Check DB_SSL is set to "true"
- Verify DB_USER includes the project ID: postgres.kbyksovlslnrbeyklxtn

### Login not working ###
- Ensure sample users exist: run "node seed.js" locally
- Check browser console for CORS errors
- Verify API_URL in config.js matches your Render backend URL

### Render free tier limitations ###
- Sleeps after 15 min of inactivity (first request takes ~30s to wake)
- 512 MB RAM (sufficient for this backend)
- 750 hours/month (enough for 24/7 if only one service)

================================================================================
                              FILE STRUCTURE
================================================================================

E - Secretary/
├── frontend/                 # Deploy to Vercel
│   ├── index.html           # Landing page
│   ├── login.html           # Auth page
│   ├── dashboard.html       # User dashboard
│   ├── config.js            # API URL configuration
│   ├── dashboard.js         # Dashboard logic
│   ├── styles.css           # Global styles
│   └── ...other CSS files
│
├── backend/                  # Deploy to Render
│   ├── server.js            # Express server
│   ├── db.js                # Supabase PostgreSQL connection
│   ├── seed.js              # Create sample users
│   ├── package.json         # Dependencies
│   ├── .env                 # Local environment (don't commit!)
│   ├── render.yaml          # Render deployment config
│   └── routes/
│       ├── auth.js          # Login/register/verify
│       ├── meetings.js      # CRUD for meetings
│       └── webhook.js       # n8n callbacks
│
└── n8n/                      # Import to n8n
    ├── workflow-transcript-processor.json
    ├── docker-compose.yml   # For local n8n
    └── README.md            # n8n setup guide

================================================================================
                              QUICK REFERENCE
================================================================================

LOCAL DEVELOPMENT:
  cd backend && npm run setup

PRODUCTION URLs:
  Frontend:  https://e-secretary.vercel.app
  Backend:   https://YOUR-BACKEND.onrender.com  (deploy separately)
  n8n:       https://e-secretary-beta.onrender.com
  Database:  https://supabase.com/dashboard/project/kbyksovlslnrbeyklxtn

API ENDPOINTS:
  POST /api/auth/register    - Create account
  POST /api/auth/login       - Sign in
  GET  /api/auth/verify      - Validate token
  GET  /api/auth/me          - Get profile
  GET  /api/meetings         - List meetings
  GET  /api/meetings/stats   - Dashboard stats

================================================================================
                              END OF GUIDE
================================================================================