# E-Secretary n8n Workflow Setup Guide

## Quick Start

### 1. Start n8n with Docker

```bash
cd n8n
docker-compose up -d
```

Access n8n at: **http://localhost:5678**

---

### 2. Configure Credentials in n8n

Open n8n → **Settings** → **Credentials** → Add:

#### A. Gemini API Key
- **Type:** HTTP Query Auth
- **Name:** `Gemini API Key`
- **Parameter Name:** `key`
- **Value:** Your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

#### B. Gmail OAuth2
- **Type:** Gmail OAuth2
- **Name:** `Gmail OAuth2`
- Follow the OAuth setup flow:
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Create OAuth2 credentials
  3. Add redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
  4. Copy Client ID and Secret to n8n

---

### 3. Import the Workflow

1. Open n8n
2. Click **Add Workflow** → **Import from File**
3. Select: `workflow-transcript-processor.json`
4. Click **Save**

---

### 4. Get Your Webhook URL

After importing, click on **"1. Fireflies Webhook"** node → Copy the **Webhook URL**

It will look like:
```
http://localhost:5678/webhook/fireflies-transcript
```

For external access (Fireflies needs to reach your PC), use one of these:

#### Option A: n8n Tunnel (Easiest)
```bash
docker run -it --rm --name n8n -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n start --tunnel
```

#### Option B: ngrok
```bash
ngrok http 5678
```
Use the ngrok URL as your webhook.

---

### 5. Configure Fireflies.ai

1. Go to [Fireflies Dashboard](https://app.fireflies.ai/integrations)
2. Navigate to **Settings** → **Developer** → **Webhooks**
3. Add new webhook:
   - **URL:** Your n8n webhook URL
   - **Events:** Select "Transcript Ready"
4. Save

---

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-Secretary Workflow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Fireflies Webhook ──► 2. Parse Data ──► 3. Gemini AI       │
│                                              (Summarize)        │
│                                                  │              │
│                                                  ▼              │
│  6. Respond ◄── 5. Gmail (Host) ◄── 4. Format Email            │
│       │                                                         │
│       ▼                                                         │
│  7. Wait (24h) ──► 8. Process Reply ──► 9. Check Approval      │
│                                              │                  │
│                           ┌──────────────────┴───────┐          │
│                           │                          │          │
│                           ▼                          ▼          │
│                   [If Approved]              [If Rejected]      │
│                           │                          │          │
│              10. Apply Changes              13. End             │
│                           │                                     │
│                           ▼                                     │
│              11. Format Final Email                             │
│                           │                                     │
│                           ▼                                     │
│              12. Gmail: All Attendees                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing the Workflow

### Manual Test (without Fireflies)

Send a POST request to your webhook:

```bash
curl -X POST http://localhost:5678/webhook/fireflies-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "test-123",
    "title": "Weekly Team Standup",
    "host_email": "your-email@gmail.com",
    "attendees": [
      {"email": "team1@example.com"},
      {"email": "team2@example.com"}
    ],
    "transcript": "John: Good morning everyone. Lets start with updates.\nSarah: I completed the dashboard design yesterday.\nMike: The API integration is 80% done, should be finished by Thursday.\nJohn: Great progress! Any blockers?\nSarah: Need approval on the color scheme from marketing.\nMike: No blockers from my side.\nJohn: Perfect. Sarah, send the designs to marketing today. Mike, keep pushing on the API. Lets reconvene Friday. Meeting adjourned.",
    "duration": 15,
    "meeting_date": "2024-01-06T10:00:00Z"
  }'
```

---

## Handling Large Transcripts

The workflow automatically handles large transcripts by:

1. **Chunking:** Splits transcripts >30k chars into manageable pieces
2. **Streaming:** Uses Gemini 1.5 Flash for fast processing
3. **Async Response:** Returns immediately, processes in background

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not receiving data | Check Docker is running, verify URL |
| Gemini API error | Verify API key, check quota |
| Gmail not sending | Re-authenticate OAuth, check scopes |
| Large transcript fails | Reduce chunk size in node 2 |
