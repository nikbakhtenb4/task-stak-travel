# AI-Powered Travel Itinerary Generator

A serverless app that generates travel itineraries using OpenAI GPT-4. Built with Cloudflare Workers and Supabase for async processing.

## 🚀 Live Demo

**API Endpoint:** `https://task-stak-travel.stak-travel-api.workers.dev`

## Features

- AI-powered itinerary generation using OpenAI GPT-4o-mini
- Async processing with instant response
- Status tracking for generation progress
- Request validation and error handling
- Rate limiting (10 requests/minute per IP)
- CORS enabled

## Architecture

The app follows this flow:

```
User Request → Cloudflare Worker → OpenAI API → Supabase Database
```

**Stack:**

- **API**: Cloudflare Workers
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o-mini
- **Language**: JavaScript

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account
- Supabase account
- OpenAI API key

### 1. Clone and Install

```bash
git clone https://github.com/nikbakhtenb4/task-stak-travel.git
cd task-stak-travel
npm install -g wrangler
npm install
wrangler login
```

### 2. Database Setup

Create a new Supabase project, then run this SQL:

```sql
CREATE TABLE itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    destination TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    itinerary JSONB,
    error TEXT
);

CREATE INDEX idx_itineraries_job_id ON itineraries(job_id);
CREATE INDEX idx_itineraries_status ON itineraries(status);
```

Enable Row Level Security:

```sql
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON itineraries
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access" ON itineraries
    FOR ALL USING (auth.role() = 'service_role');
```

### 3. Environment Variables

Add secrets to Cloudflare:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put OPENAI_API_KEY
```

Update `wrangler.toml`:

```toml
name = "travel-itinerary-generator"
main = "src/index.js"
compatibility_date = "2024-01-15"

[vars]
SUPABASE_ANON_KEY = "your_anon_key_here"
```

For local dev, create `.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
```

### 4. Deploy

```bash
wrangler deploy
```

## API Usage

### Create Itinerary

**POST /**

```json
{
  "destination": "Paris, France",
  "durationDays": 5
}
```

Response (202 Accepted):

```json
{
  "jobId": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed"
}
```

### Check Status

**GET /status?jobId={jobId}**

Processing:

```json
{
  "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
  "status": "processing",
  "destination": "Paris, France",
  "duration_days": 5,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

Completed:

```json
{
  "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
  "status": "completed",
  "destination": "Paris, France",
  "duration_days": 5,
  "itinerary": [
    {
      "day": 1,
      "theme": "Historic Paris",
      "activities": [
        {
          "time": "Morning",
          "description": "Visit the Louvre Museum",
          "location": "Louvre Museum"
        }
      ]
    }
  ]
}
```

### Examples

**cURL:**

```bash
curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"destination": "Tokyo, Japan", "durationDays": 3}'
```

**JavaScript:**

```javascript
async function createItinerary(destination, days) {
  const response = await fetch("https://your-worker.workers.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destination, durationDays: days }),
  });

  const { jobId } = await response.json();
  return jobId;
}

async function checkStatus(jobId) {
  const response = await fetch(
    `https://your-worker.workers.dev/status?jobId=${jobId}`
  );
  return response.json();
}

// Simple polling example
async function waitForItinerary(jobId) {
  while (true) {
    const result = await checkStatus(jobId);

    if (result.status === "completed") {
      console.log("Done!", result.itinerary);
      return result;
    }

    if (result.status === "failed") {
      console.log("Failed:", result.error);
      return result;
    }

    console.log("Still working...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
```

## Development

**Local development:**

```bash
wrangler dev
```

**View logs:**

```bash
wrangler tail
```

**Project structure:**

```
src/
  index.js          # Main worker code
wrangler.toml       # Cloudflare config
package.json
README.md
```

## Design Decisions

### Why Cloudflare Workers?

- No server management needed
- Fast global deployment
- Good free tier
- Quick cold starts

### Why Supabase instead of Firestore?

I ran into regional restrictions with Google services - kept getting "service unavailable" errors when trying to set up Firestore. Since I needed to get this done, I switched to Supabase which has been working great. Plus the SQL flexibility is actually pretty nice for this use case.

### Async Processing

The app returns immediately with a job ID, then processes the OpenAI request in the background. This prevents timeouts and gives users instant feedback.

## AI Prompt Strategy

I spent some time getting the prompt right to ensure consistent JSON output. The key was being very specific about the format and including examples of what good activities look like.

```javascript
function createPrompt(destination, days) {
  return `Create a ${days}-day travel itinerary for ${destination}.

Return only valid JSON with this structure:
{
  "itinerary": [
    {
      "day": 1,
      "theme": "Theme for the day",
      "activities": [
        {
          "time": "Morning/Afternoon/Evening", 
          "description": "Detailed activity description",
          "location": "Specific location name"
        }
      ]
    }
  ]
}

Make it practical with real places and useful tips.`;
}
```

## Troubleshooting

**Common issues:**

1. **Environment variables missing**: Check `wrangler secret list`
2. **Database connection fails**: Verify Supabase URL and keys
3. **OpenAI errors**: Make sure billing is set up
4. **Jobs stuck processing**: Check logs with `wrangler tail`

## Costs

Pretty cheap to run:

- OpenAI: ~$0.01-0.03 per itinerary
- Cloudflare: Free tier covers most usage
- Supabase: Free tier is plenty for testing

## Future Ideas

- Add support for other AI models
- User preferences (budget, interests, etc.)
- Cache popular destinations
- Better error handling and retries
- Maybe a simple frontend for easier testing

---

Built this for the Stak take-home challenge. The async processing was the interesting part - making sure the response is instant but the heavy AI work happens in background.
