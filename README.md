# AI-Powered Travel Itinerary Generator

A serverless application that generates personalized travel itineraries using AI. Built with Cloudflare Workers, Supabase, and OpenAI GPT-4 to handle asynchronous itinerary generation with real-time status tracking.

## 🌟 Features

- **AI-Powered Planning**: Generate detailed travel itineraries using OpenAI GPT-4
- **Asynchronous Processing**: Immediate response with job tracking ID
- **Real-time Status Tracking**: Monitor itinerary generation progress
- **RESTful API**: Clean endpoints with OpenAPI 3.1 specification
- **Input Validation**: Robust request validation and error handling
- **Rate Limiting**: Built-in protection against API abuse
- **CORS Support**: Ready for frontend integration

## 🏗️ Architecture

```
User Request → Cloudflare Worker → OpenAI API → Supabase Database
     ↓              ↓                   ↓           ↓
  202 Accepted → Async Process → AI Generation → Data Storage
```

### Technology Stack

- **API Layer**: Cloudflare Workers (serverless)
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **AI Provider**: OpenAI GPT-4o-mini
- **Framework**: Hono with Chanfana (OpenAPI compliance)
- **Validation**: Built-in request/response validation

## 📋 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** (v18 or higher)
- **Cloudflare Account** (free tier sufficient)
- **Supabase Account** (free tier sufficient)
- **OpenAI API Account** with billing configured
- **Git** for version control
- Basic knowledge of JavaScript and REST APIs

## 🚀 Quick Start

### Step 1: Project Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd travel-itinerary-generator

# Install Wrangler CLI globally
npm install -g wrangler

# Install project dependencies
npm install

# Login to Cloudflare
wrangler login
```

### Step 2: Database Setup (Supabase)

1. **Create New Supabase Project**

   - Visit [supabase.com](https://supabase.com) and create a new project
   - Note your Project URL and API keys from Settings > API

2. **Create Database Schema**

   Execute this SQL in the Supabase SQL Editor:

   ```sql
   -- Create itineraries table
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

   -- Create performance indexes
   CREATE INDEX idx_itineraries_job_id ON itineraries(job_id);
   CREATE INDEX idx_itineraries_status ON itineraries(status);
   CREATE INDEX idx_itineraries_created_at ON itineraries(created_at);
   ```

3. **Configure Row Level Security**

   ```sql
   -- Enable RLS
   ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

   -- Allow public read access for status checking
   CREATE POLICY "Allow public read access" ON itineraries
       FOR SELECT USING (true);

   -- Allow service role full access for worker operations
   CREATE POLICY "Allow service role full access" ON itineraries
       FOR ALL USING (auth.role() = 'service_role');
   ```

### Step 3: Environment Configuration

1. **Configure Cloudflare Secrets**

   Add these secrets to your Cloudflare Worker:

   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_KEY
   wrangler secret put OPENAI_API_KEY
   ```

2. **Update wrangler.toml**

   Ensure your `wrangler.toml` contains:

   ```toml
   name = "travel-itinerary-generator"
   main = "src/index.ts"
   compatibility_date = "2024-01-15"

   [vars]
   SUPABASE_ANON_KEY = "your_anon_key_here"
   ```

3. **Local Development Setup**

   Create a `.env` file for local testing:

   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_from_supabase_settings
   SUPABASE_SERVICE_KEY=your_service_role_key_from_supabase_settings
   OPENAI_API_KEY=your_openai_api_key
   ```

   > **Note**: Never commit the `.env` file to version control

### Step 4: Deploy the Application

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Your API will be available at:
# https://travel-itinerary-generator.your-subdomain.workers.dev
```

## 📖 API Reference

The API follows OpenAPI 3.1 specification with automatic documentation generation.

### Base URL

```
https://your-worker-name.your-subdomain.workers.dev
```

### Create Itinerary

Generate a new travel itinerary asynchronously.

**Endpoint:** `POST /`

**Request Body:**

```json
{
  "destination": "Paris, France",
  "durationDays": 5
}
```

**Validation Rules:**

- `destination`: Non-empty string, max 100 characters
- `durationDays`: Integer between 1 and 14

**Success Response:** `202 Accepted`

```json
{
  "jobId": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed"
}
```

**Error Response:** `400 Bad Request`

```json
{
  "error": "Validation failed",
  "details": ["destination must be a non-empty string"]
}
```

### Check Itinerary Status

Retrieve the current status and results of an itinerary generation job.

**Endpoint:** `GET /status?jobId={jobId}`

**Response (Processing):** `200 OK`

```json
{
  "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
  "status": "processing",
  "destination": "Paris, France",
  "duration_days": 5,
  "created_at": "2024-01-15T10:30:00.000Z",
  "completed_at": null,
  "itinerary": null,
  "error": null
}
```

**Response (Completed):** `200 OK`

```json
{
  "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
  "status": "completed",
  "destination": "Paris, France",
  "duration_days": 5,
  "created_at": "2024-01-15T10:30:00.000Z",
  "completed_at": "2024-01-15T10:31:25.000Z",
  "itinerary": [
    {
      "day": 1,
      "theme": "Historic Paris",
      "activities": [
        {
          "time": "Morning",
          "description": "Visit the Louvre Museum. Pre-book tickets to avoid queues.",
          "location": "Louvre Museum"
        },
        {
          "time": "Afternoon",
          "description": "Stroll through Tuileries Garden and Place de la Concorde.",
          "location": "Tuileries Garden"
        },
        {
          "time": "Evening",
          "description": "Seine River dinner cruise with city views.",
          "location": "Seine River"
        }
      ]
    }
  ],
  "error": null
}
```

**Response (Failed):** `200 OK`

```json
{
  "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
  "status": "failed",
  "destination": "Paris, France",
  "duration_days": 5,
  "created_at": "2024-01-15T10:30:00.000Z",
  "completed_at": "2024-01-15T10:31:25.000Z",
  "itinerary": null,
  "error": "OpenAI API rate limit exceeded"
}
```

**Error Response:** `404 Not Found`

```json
{
  "error": "Job not found",
  "details": ["No itinerary found with the provided jobId"]
}
```

### API Documentation

**Endpoint:** `GET /`

Access the interactive Swagger UI documentation at your worker's base URL.

## 🧪 Testing

## 💻 API Usage Examples

### cURL Examples

**Create New Itinerary:**

```bash
curl -X POST https://task-stak-travel.stak-travel-api.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Paris, France",
    "durationDays": 3
  }'

# Response:
# {
#   "jobId": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed"
# }
```

**Check Status:**

```bash
curl "https://task-stak-travel.stak-travel-api.workers.dev/status?jobId=f97747ef-ee0b-4c14-8238-d6e723f6b3ed"

# Response (processing):
# {
#   "job_id": "f97747ef-ee0b-4c14-8238-d6e723f6b3ed",
#   "status": "processing",
#   "destination": "Paris, France",
#   "duration_days": 3,
#   "created_at": "2024-01-15T10:30:00.000Z"
# }
```

### JavaScript Fetch Examples

**Create Itinerary:**

```javascript
async function createItinerary(destination, durationDays) {
  try {
    const response = await fetch(
      "https://task-stak-travel.stak-travel-api.workers.dev",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destination,
          durationDays,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Job created:", data.jobId);
    return data.jobId;
  } catch (error) {
    console.error("Error creating itinerary:", error);
    throw error;
  }
}

// Usage
createItinerary("Tokyo, Japan", 5).then((jobId) =>
  console.log(`Track your itinerary with ID: ${jobId}`)
);
```

**Check Status with Polling:**

```javascript
async function checkItineraryStatus(jobId) {
  const response = await fetch(
    `https://task-stak-travel.stak-travel-api.workers.dev/status?jobId=${jobId}`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function pollForCompletion(jobId, maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const status = await checkItineraryStatus(jobId);

      console.log(`Attempt ${attempt}: Status is ${status.status}`);

      if (status.status === "completed") {
        console.log("✅ Itinerary ready!");
        console.log("Itinerary:", JSON.stringify(status.itinerary, null, 2));
        return status;
      }

      if (status.status === "failed") {
        console.log("❌ Generation failed:", status.error);
        return status;
      }

      // Wait 3 seconds before next check
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error checking status: ${error}`);
    }
  }

  throw new Error("Timeout: Itinerary generation took too long");
}

// Usage
pollForCompletion("your-job-id-here");
```

**Complete Workflow Example:**

```javascript
async function generateCompleteItinerary(destination, days) {
  try {
    console.log(`🚀 Creating ${days}-day itinerary for ${destination}...`);

    // Step 1: Create itinerary
    const jobId = await createItinerary(destination, days);

    // Step 2: Wait for completion
    console.log("⏳ Waiting for AI generation...");
    const result = await pollForCompletion(jobId);

    // Step 3: Display results
    if (result.status === "completed") {
      console.log(`🎉 Your ${destination} itinerary is ready!`);
      return result.itinerary;
    } else {
      console.log("💥 Failed to generate itinerary:", result.error);
      return null;
    }
  } catch (error) {
    console.error("Complete workflow failed:", error);
    throw error;
  }
}

// Usage example
generateCompleteItinerary("Barcelona, Spain", 4)
  .then((itinerary) => {
    if (itinerary) {
      console.log("Final itinerary:", itinerary);
    }
  })
  .catch(console.error);
```

### Real-Time Frontend Integration

```javascript
// For real-time status updates in a web application
class ItineraryTracker {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.activeJobs = new Map();
  }

  async create(destination, durationDays) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination, durationDays }),
    });

    const { jobId } = await response.json();

    // Start tracking
    this.trackJob(jobId);
    return jobId;
  }

  trackJob(jobId, callback) {
    const interval = setInterval(async () => {
      try {
        const status = await this.checkStatus(jobId);

        if (callback) callback(status);

        if (status.status !== "processing") {
          clearInterval(interval);
          this.activeJobs.delete(jobId);
        }
      } catch (error) {
        console.error("Tracking error:", error);
        clearInterval(interval);
      }
    }, 2000); // Check every 2 seconds

    this.activeJobs.set(jobId, interval);
  }

  async checkStatus(jobId) {
    const response = await fetch(`${this.baseUrl}/status?jobId=${jobId}`);
    return response.json();
  }
}

// Usage in React/Vue/Vanilla JS
const tracker = new ItineraryTracker("https://your-worker.workers.dev");

tracker.create("Rome, Italy", 6).then((jobId) => {
  console.log(`Tracking job: ${jobId}`);

  tracker.trackJob(jobId, (status) => {
    // Update UI based on status
    console.log(`Status update:`, status);

    if (status.status === "completed") {
      console.log("🎉 Itinerary completed!", status.itinerary);
      // Update UI with final itinerary
    }
  });
});
```

### Comprehensive Test Script

```bash
#!/bin/bash
WORKER_URL="https://your-worker.workers.dev"

echo "🧪 Testing AI Travel Itinerary Generator..."

# Test 1: Create multiple itineraries
echo "1️⃣ Creating Test Itineraries:"

destinations=("Tokyo, Japan" "Barcelona, Spain" "New York, USA" "Isfahan, Iran")
job_ids=()

for dest in "${destinations[@]}"; do
    echo "Creating itinerary for $dest..."
    response=$(curl -s -X POST "$WORKER_URL" \
        -H "Content-Type: application/json" \
        -d "{\"destination\": \"$dest\", \"durationDays\": 3}")

    job_id=$(echo $response | jq -r '.jobId')
    job_ids+=($job_id)
    echo "Job ID: $job_id"
done

# Test 2: Check initial status
echo "2️⃣ Checking Initial Status:"
for job_id in "${job_ids[@]}"; do
    curl -s "$WORKER_URL/status?jobId=$job_id" | jq '.status'
done

echo "3️⃣ Waiting for completion..."
sleep 45

# Test 3: Check final status
echo "4️⃣ Checking Final Results:"
for job_id in "${job_ids[@]}"; do
    echo "Results for $job_id:"
    curl -s "$WORKER_URL/status?jobId=$job_id" | jq '{status, destination, completed_at}'
done
```

### Performance Testing

Monitor response times and resource usage:

```bash
# Test response time
time curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"destination": "London, UK", "durationDays": 4}'
```

Expected response time: < 500ms for initial request

## ⚙️ Configuration & Customization

### Rate Limiting

The API includes built-in rate limiting:

- **Limit**: 100 requests per minute per IP
- **Response**: `429 Too Many Requests`

### Request Limits

- **Duration Range**: 1-14 days
- **Destination Length**: Max 100 characters
- **Request Timeout**: 30 seconds for AI generation
- **Max Request Size**: 1KB

## 🏛️ Architectural Choices

### Why Cloudflare Workers?

- **Serverless**: Zero server management, automatic scaling
- **Global Edge**: Low latency worldwide with 300+ data centers
- **Cost-Effective**: Free tier handles significant traffic
- **Fast Cold Starts**: V8 isolates start in <5ms vs containers ~100ms
- **Built-in Security**: DDoS protection, automatic HTTPS

### Why Supabase over Firestore?

- **SQL Flexibility**: Complex queries and joins when needed
- **Real-time Capabilities**: Built-in WebSocket subscriptions
- **Row Level Security**: Granular access control
- **Open Source**: PostgreSQL compatibility, no vendor lock-in
- **Cost Efficiency**: More predictable pricing than Firestore

### Why Hono + Chanfana Framework?

- **OpenAPI Compliance**: Automatic API documentation generation
- **Type Safety**: Full TypeScript support with runtime validation
- **Performance**: Lightweight, fast routing optimized for Workers
- **Developer Experience**: Built-in middleware for CORS, validation, etc.

### Asynchronous Processing Design

```
1. User Request → Immediate 202 Response (< 100ms)
2. Background Process → OpenAI API Call (20-60 seconds)
3. Database Update → Status change to 'completed'
4. User Polling → Retrieves final result
```

This design ensures:

- **Responsive UI**: Users get immediate feedback
- **Reliability**: No timeout issues with long AI generation
- **Scalability**: Can handle multiple concurrent requests
- **User Experience**: Clear status tracking throughout the process

## 🤖 AI Prompt Design

### Prompt Engineering Strategy

The prompt is designed for **reliability** and **consistency** over creativity:

```javascript
const prompt = `You are a professional travel planner. Generate a detailed ${durationDays}-day travel itinerary for ${destination}.

CRITICAL: Respond with ONLY valid JSON. No explanations, no markdown, no additional text.

Required JSON structure:
{
  "itinerary": [
    {
      "day": 1,
      "theme": "Brief theme description",
      "activities": [
        {
          "time": "Morning", 
          "description": "Detailed activity with practical tips",
          "location": "Specific location name"
        },
        {
          "time": "Afternoon",
          "description": "Detailed activity with practical tips", 
          "location": "Specific location name"
        },
        {
          "time": "Evening",
          "description": "Detailed activity with practical tips",
          "location": "Specific location name"
        }
      ]
    }
  ]
}

Guidelines:
- Include 3 activities per day (Morning, Afternoon, Evening)
- Provide practical details and tips
- Use specific location names
- Consider travel time between locations
- Include local cultural experiences
- Suggest booking requirements when relevant`;
```

### Why This Prompt Works

1. **Clear Instructions**: Explicit JSON-only response requirement
2. **Structured Format**: Exact schema definition prevents parsing errors
3. **Practical Focus**: Emphasizes actionable advice over generic descriptions
4. **Cultural Awareness**: Encourages authentic local experiences
5. **Logistics Consideration**: Accounts for practical travel constraints

### Prompt Reliability Features

- **Error Handling**: Fallback to retry with simplified prompt if JSON parsing fails
- **Validation Ready**: Structure matches database schema exactly
- **Consistent Timing**: Always generates Morning/Afternoon/Evening activities
- **Location Specificity**: Requires actual place names for mapping integration

### Database Schema

The Supabase table structure ensures data integrity:

```sql
-- Core fields
job_id UUID UNIQUE NOT NULL          -- Unique identifier
status TEXT CHECK (...)              -- Controlled status values
destination TEXT NOT NULL            -- Travel destination
duration_days INTEGER NOT NULL       -- Trip length
created_at TIMESTAMPTZ DEFAULT NOW() -- Creation timestamp
completed_at TIMESTAMPTZ             -- Completion timestamp
itinerary JSONB                      -- Generated itinerary data
error TEXT                           -- Error message if failed
```

## 🔧 Development

### Local Development

```bash
# Start development server
wrangler dev

# Your local API will be available at:
# http://localhost:8787

# View real-time logs
wrangler tail

# Test local endpoints
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"destination": "Paris, France", "durationDays": 3}'
```

### Project Structure

```
travel-itinerary-generator/
├── src/
│   ├── index.ts              # Main worker entry point
│   └── endpoints/            # API endpoint definitions
├── wrangler.toml            # Cloudflare configuration
├── package.json             # Dependencies and scripts
├── package-lock.json        # Dependency lock file
├── .env.example            # Environment variables template
├── README.md               # This documentation
└── .gitignore             # Git ignore rules
```

### Available Scripts

```bash
# Development
npm run dev          # Start local development server
npm run deploy       # Deploy to Cloudflare Workers
npm run tail         # View worker logs

# Testing
npm test            # Run test suite (if implemented)
npm run lint        # Check code quality
```

## 🐛 Troubleshooting

### Common Issues

**"Missing environment variables"**

- Verify all secrets are configured: `wrangler secret list`
- Check `.env` file for local development
- Ensure variable names match exactly

**"Database connection failed"**

- Verify Supabase URL and Service Key are correct
- Check if Row Level Security policies are properly configured
- Test database connection in Supabase dashboard

**"OpenAI API errors"**

- Verify API key is valid and has billing configured
- Check OpenAI usage dashboard for rate limits
- Ensure sufficient credits are available

**"Job stuck in processing"**

- Check worker logs: `wrangler tail`
- Verify OpenAI API isn't rate limited
- Check for network connectivity issues

**"Invalid JSON response from AI"**

- Monitor for prompt engineering improvements needed
- Check OpenAI model responses in logs
- Implement JSON validation if needed

### Debugging Steps

1. **Check Worker Logs:**

```bash
wrangler tail --format pretty
```

2. **Verify Environment Variables:**

```bash
wrangler secret list
```

3. **Test Database Connection:**

```bash
# Use Supabase dashboard SQL editor to test queries
SELECT * FROM itineraries LIMIT 5;
```

4. **Monitor API Usage:**

- Cloudflare Dashboard → Workers & Pages → Analytics
- OpenAI Dashboard → Usage
- Supabase Dashboard → Statistics

## 💰 Cost Analysis

### OpenAI API Costs

- **GPT-4o-mini**: ~$0.01-0.03 per itinerary
- **Estimated monthly cost**: $10-50 for 1000-2000 itineraries
- **Free tier**: Not available, billing required

### Infrastructure Costs

- **Cloudflare Workers**: Free tier (100k requests/day)
- **Supabase**: Free tier (500MB database, 50k monthly active users)

**Total estimated monthly cost**: $10-50 (primarily OpenAI API usage)

## 🔐 Security Considerations

- **API Keys**: Stored as encrypted Cloudflare secrets
- **Input Validation**: Comprehensive request validation prevents injection
- **Rate Limiting**: Protects against abuse and DoS attacks
- **Database Security**: RLS policies control data access
- **CORS Configuration**: Properly configured for secure frontend integration
- **Error Handling**: No sensitive information exposed in error messages

## 📊 Monitoring & Analytics

### Key Metrics to Monitor

- **Response Time**: API endpoint performance
- **Success Rate**: Percentage of successful itinerary generations
- **Error Rate**: Failed requests and their causes
- **AI Generation Time**: Time taken for OpenAI API calls
- **Database Performance**: Query execution times

### Available Dashboards

- **Cloudflare Analytics**: Request volumes, response times, error rates
- **Supabase Dashboard**: Database performance, query statistics
- **OpenAI Usage Dashboard**: API usage, costs, rate limits

## 🚀 Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema and RLS policies implemented
- [ ] OpenAI API account with billing configured
- [ ] All environment variables and secrets configured
- [ ] Worker successfully deployed to Cloudflare
- [ ] API endpoints tested and validated
- [ ] Rate limiting functionality verified
- [ ] Error handling and logging confirmed
- [ ] Performance benchmarks established

## 📈 Future Enhancements

### Planned Features

- **Caching Layer**: Redis for frequently requested destinations
- **Multiple AI Providers**: Fallback between OpenAI, Claude, Gemini
- **User Preferences**: Customizable itinerary styles and interests
- **Real-time Notifications**: WebSocket support for status updates
- **Batch Processing**: Handle multiple itineraries efficiently

### Optional Bonus Features

- **Svelte 5 Frontend**: Real-time status checking UI
- **Advanced Error Handling**: Retry mechanisms with exponential backoff
- **Schema Validation**: Zod integration for AI response validation

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure backward compatibility

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review Cloudflare Worker logs via `wrangler tail`
3. Verify all environment variables are configured
4. Test with the provided curl examples

## 🙏 Acknowledgments

- **Cloudflare Workers**: Excellent serverless platform
- **Supabase**: Powerful PostgreSQL backend
- **OpenAI**: Advanced AI capabilities
- **Hono & Chanfana**: Clean API framework with OpenAPI support

---

**Ready to generate amazing travel itineraries! 🌍✈️**

_For questions or support, please check the troubleshooting guide or review the deployment checklist._
