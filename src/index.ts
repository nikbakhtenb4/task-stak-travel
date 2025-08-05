import { createClient } from "@supabase/supabase-js";

function validateInput(requestData) {
  const errors = [];

  if (!requestData.destination || typeof requestData.destination !== "string") {
    errors.push("destination must be a non-empty string");
  }

  if (requestData.destination && requestData.destination.trim().length < 3) {
    errors.push("destination must be at least 3 characters long");
  }

  if (
    !requestData.durationDays ||
    typeof requestData.durationDays !== "number" ||
    isNaN(requestData.durationDays)
  ) {
    errors.push("durationDays must be a valid number");
  }

  if (
    requestData.durationDays &&
    (requestData.durationDays < 1 || requestData.durationDays > 14)
  ) {
    errors.push("durationDays must be between 1 and 14");
  }

  return errors;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Simple in-memory rate limit (not persistent, resets on deployment)
const rateLimitMap = new Map();

function checkRateLimit(clientIP) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // Max 10 requests per minute

  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return true;
  }

  const clientData = rateLimitMap.get(clientIP);

  if (now > clientData.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (clientData.count >= maxRequests) {
    return false;
  }

  clientData.count++;
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // ⭐ Health Check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // ⭐ Status Check
    if (url.pathname === "/status" && request.method === "GET") {
      const jobId = url.searchParams.get("jobId");

      if (!jobId) {
        return new Response(
          JSON.stringify({ error: "jobId parameter required" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      try {
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

        const { data, error } = await supabase
          .from("itineraries")
          .select(
            "job_id, status, destination, duration_days, created_at, completed_at, itinerary, error"
          )
          .eq("job_id", jobId)
          .single();

        if (error || !data) {
          return new Response(JSON.stringify({ error: "Job not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Only POST method is allowed for generation
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // ⭐ Rate limiting
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // ⭐ Request size limit
    const contentLength = request.headers.get("Content-Length");
    if (contentLength && parseInt(contentLength) > 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    try {
      const requestData = await request.json();

      console.log("OpenAI key available:", !!env.OPENAI_API_KEY);

      const validationErrors = validateInput(requestData);
      if (validationErrors.length > 0) {
        return new Response(
          JSON.stringify({
            error: "Validation failed",
            details: validationErrors,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const { destination, durationDays } = requestData;
      const jobId = crypto.randomUUID();

      const response = new Response(JSON.stringify({ jobId }), {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

      ctx.waitUntil(processItinerary(env, jobId, destination, durationDays));

      return response;
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  },
};

// Process travel itinerary
async function processItinerary(env, jobId, destination, durationDays) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  try {
    const { error: insertError } = await supabase.from("itineraries").insert({
      job_id: jobId,
      status: "processing",
      destination,
      duration_days: durationDays,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return;
    }

    console.log(
      `Started processing itinerary for ${destination}, ${durationDays} days`
    );

    const prompt = createItineraryPrompt(destination, durationDays);
    const llmResponse = await callOpenAI(prompt, env.OPENAI_API_KEY);
    const itineraryData = parseItineraryResponse(llmResponse);

    const { error: updateError } = await supabase
      .from("itineraries")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        itinerary: itineraryData,
      })
      .eq("job_id", jobId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to save completed itinerary");
    }

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);

    await supabase
      .from("itineraries")
      .update({
        status: "failed",
        error: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
  }
}

// Connect to OpenAI with timeout
async function callOpenAI(prompt, apiKey, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional travel planner. Always return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    console.log(
      `OpenAI API call completed. Tokens used: ${
        data.usage?.total_tokens || "unknown"
      }`
    );

    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("OpenAI API request timed out");
    }
    throw error;
  }
}

// Create prompt for OpenAI
function createItineraryPrompt(destination, durationDays) {
  return `You are a professional travel planner. Create a detailed ${durationDays}-day itinerary for ${destination}.

REQUIREMENTS:
- Return ONLY valid JSON, no other text
- Each day should have a theme and 3 activities (Morning, Afternoon, Evening)
- Activities should be realistic and location-specific
- Include specific location names and practical tips

EXACT JSON FORMAT:
{
  "itinerary": [
    {
      "day": 1,
      "theme": "Arrival and City Introduction",
      "activities": [
        {
          "time": "Morning",
          "description": "Specific activity with practical details",
          "location": "Exact location name"
        },
        {
          "time": "Afternoon", 
          "description": "Specific activity with practical details",
          "location": "Exact location name"
        },
        {
          "time": "Evening",
          "description": "Specific activity with practical details", 
          "location": "Exact location name"
        }
      ]
    }
  ]
}

Destination: ${destination}
Duration: ${durationDays} days

Return only the JSON object:`;
}

// Parse OpenAI response
function parseItineraryResponse(llmResponse) {
  try {
    let cleanedResponse = llmResponse.trim();

    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*$/g, "");
    }

    const parsed = JSON.parse(cleanedResponse);

    if (!parsed.itinerary || !Array.isArray(parsed.itinerary)) {
      throw new Error("Invalid itinerary structure: missing itinerary array");
    }

    for (const day of parsed.itinerary) {
      if (
        !day.day ||
        !day.theme ||
        !day.activities ||
        !Array.isArray(day.activities)
      ) {
        throw new Error(
          `Invalid day structure for day ${day.day || "unknown"}`
        );
      }

      for (const activity of day.activities) {
        if (!activity.time || !activity.description || !activity.location) {
          throw new Error(`Invalid activity structure in day ${day.day}`);
        }
      }
    }

    return parsed.itinerary;
  } catch (error) {
    console.error("JSON parsing error:", error);
    console.error("Raw LLM response:", llmResponse);
    throw new Error(`Failed to parse itinerary: ${error.message}`);
  }
}
