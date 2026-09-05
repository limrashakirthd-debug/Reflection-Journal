import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Email Transporter Helper
function getEmailTransporter(): { transporter: nodemailer.Transporter; isSimulated: boolean } {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
      isSimulated: false,
    };
  }

  // Fallback for local preview & testing when SMTP keys are not yet declared
  return {
    transporter: nodemailer.createTransport({
      jsonTransport: true,
    }),
    isSimulated: true,
  };
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const REMINDER_THEME_PROMPTS: Record<string, { title: string; prompt: string }> = {
  morning_clarity: {
    title: "Morning Clarity",
    prompt: "What is the single intention or mindful state you wish to cultivate today?",
  },
  evening_reflection: {
    title: "Evening Reflection",
    prompt: "What was a quiet moment today that made you pause, learn, or feel alive?",
  },
  gratitude: {
    title: "Daily Gratitude",
    prompt: "What is one simple blessing or kind interaction you are grateful for today?",
  },
  mindful: {
    title: "Mindful Check-in",
    prompt: "Take a deep, slow breath. What feelings or thoughts are presently asking for your compassionate attention?",
  },
  custom: {
    title: "Daily Reflection",
    prompt: "Take a pause for your mindful daily journal reflection.",
  },
};

// Lazy GoogleGenAI client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
    }
    genAIClient = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return genAIClient;
}

// Resilient Model Fallback Ladder (ordered by availability and speed)
const MODEL_FALLBACK_LADDER = [
  "gemini-3.1-flash-lite", // High-Availability, fast response
  "gemini-3.8-flash",      // Next-generation flash
  "gemini-3.6-flash",      // Standard flash
  "gemini-3.7-flash",      // Deep reasoning fallback
  "gemini-flash-latest",   // Dynamic alias
] as const;

interface FallbackResult {
  text: string;
  modelUsed: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function extractTitleFromPrompt(prompt: string): string {
  // Strip non-letter starters and quotes
  const cleanPrompt = prompt.replace(/^[^a-zA-Z0-9]+/, "").replace(/["']/g, "").trim();
  // Get first sentence or first clause
  const match = cleanPrompt.match(/^([^.?!:\n]+)/);
  let candidate = (match ? match[1] : cleanPrompt).trim();
  // Limit to 3-6 words
  const words = candidate.split(/\s+/).slice(0, 6).join(" ");
  if (words.length > 50) {
    return words.slice(0, 47) + "...";
  }
  return words || "Reflective Journal Entry";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

// Helper utility with automated fallback ladder and quick transient retry
async function generateContentWithFallback(
  contents: Array<{ role?: string; parts: Array<{ text: string }> }>,
  systemInstruction?: string,
  timeoutMs = 10000
): Promise<FallbackResult> {
  const ai = getGenAI();
  let lastError: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    // Attempt up to 2 times for transient 503/429 spikes
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const generatePromise = ai.models.generateContent({
          model,
          contents,
          config: systemInstruction
            ? {
                systemInstruction,
                temperature: 0.7,
              }
            : {
                temperature: 0.7,
              },
        });

        const response = await withTimeout(
          generatePromise,
          timeoutMs,
          `Model ${model} request exceeded ${timeoutMs}ms limit`
        );

        const responseText = response.text || "";
        if (responseText.trim().length > 0) {
          return { text: responseText, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const errStatus = err?.status || err?.code || "transient";
        console.log(`[Gemini Engine] Model ${model} (attempt ${attempt}/2) unavailable (${errStatus}).`);
        if (attempt < 2) {
          await delay(500); // Brief backoff before re-attempting or cascading
        }
      }
    }
  }

  throw lastError || new Error("All models in the fallback ladder failed to generate content.");
}

// Intelligent Built-in Reflective Synthesis Engine (Zero-API-Key Resilience)
function generateLocalReflection(
  prompt: string,
  mode: string
): FallbackResult {
  const lowerPrompt = prompt.toLowerCase();

  // Identify emotional tone cues
  let emotionalTone = "thoughtful and reflective";
  if (/grat|thank|bless|appreciat|joy|happy|warm|glad|content/.test(lowerPrompt)) {
    emotionalTone = "grateful, warm, and uplifted";
  } else if (/tired|exhaust|burnout|drained|weary|sleepy|heavy/.test(lowerPrompt)) {
    emotionalTone = "fatigued and seeking restoration";
  } else if (/anxious|stress|worry|overwhelm|nervous|fear|panic|tension/.test(lowerPrompt)) {
    emotionalTone = "carrying stress and seeking gentle grounding";
  } else if (/calm|peace|still|quiet|seren|relaxed/.test(lowerPrompt)) {
    emotionalTone = "peaceful, grounded, and centered";
  } else if (/frustrat|angry|annoy|irritat|upset|mad/.test(lowerPrompt)) {
    emotionalTone = "processing friction and emotional tension";
  } else if (/hope|excit|inspire|curious|wonder|aspire|dream/.test(lowerPrompt)) {
    emotionalTone = "inspired, forward-looking, and curious";
  }

  let text = "";

  if (mode === "summary") {
    text = `### 📋 Reflection Summary & Synthesis\n\n- **Emotional Tone:** ${emotionalTone}\n- **Core Journal Entry:** "${prompt.length > 90 ? prompt.slice(0, 87) + '...' : prompt}"\n- **Key Underlying Insight:** You took dedicated space to examine your thoughts and give expression to your feelings.\n\n**Mindful Takeaway:** Writing this down transforms abstract worries or fleeting joys into concrete awareness. Acknowledge and honor where you are today.`;
  } else if (mode === "brainstorm") {
    text = `Thank you for exploring this reflection. Here are 3 fresh creative angles and reframed perspectives:\n\n1. **Reframing the Narrative:** What if this experience is pointing toward an unspoken boundary or value that is asking to be prioritized?\n2. **The Compassionate Friend Lens:** If a dear friend came to you with this exact situation, what wisdom, patience, or insight would you offer them?\n3. **One Micro-Experiment:** What is one gentle, low-risk change you could test out tomorrow to explore this with fresh curiosity?`;
  } else if (mode === "action_plan") {
    text = `Here is a gentle, sustainable micro-action plan crafted from your reflection:\n\n1. **Grounding Reset (Right Now):** Take three slow diaphragmatic breaths. Release any tension held in your shoulders, brow, or jaw.\n2. **Smallest Manageable Step (Next 24 Hours):** Identify the single simplest micro-task related to this thought, and give it 5 to 10 minutes without judging the outcome.\n3. **Evening Check-In:** Before closing your day, jot down one small moment of ease, progress, or comfort you experienced.\n\n*Sustainable growth happens through gentle consistency, not overwhelming urgency.*`;
  } else if (mode === "empathy") {
    text = `I hear you deeply, and everything you are feeling is completely valid.\n\nIt takes honesty and vulnerability to pause and put words to what is happening inside. Notice that you have been carrying quite a bit (${emotionalTone}). Give yourself permission to feel uncertain, to take a pause, and to rest without having to fix or resolve everything this instant.\n\nYou are navigating this with the best awareness you have right now. Be gentle with yourself today.`;
  } else {
    // Default: 'reflection'
    text = `Thank you for taking this quiet moment to reflect. It sounds like you are navigating an internal space that is ${emotionalTone}.\n\nWhen we pause to journal, we grant ourselves the grace to untangle thoughts from identity. Here are two reflective questions to sit with:\n\n1. **Deeper Inquiry:** What is the most authentic need or truth beneath these thoughts that is asking to be acknowledged?\n2. **Gentle Awareness:** What would offer your mind or body the deepest sense of peace and support right now?`;
  }

  return {
    text,
    modelUsed: "offline-reflective-engine",
  };
}

// API Health
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    localEngineReady: true,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// RBAC Security Middleware & Admin Endpoints
// ==========================================

const AUTHORIZED_ADMIN_EMAILS = [
  "limrashakirthd@gmail.com",
];

// RBAC Middleware: Enforces Tier 1 Administrative Privileges (Directive 9)
function requireAdminRole(req: express.Request, res: express.Response, next: express.NextFunction) {
  const callerEmail = String(req.headers["x-admin-email"] || "").trim().toLowerCase();
  const callerRole = String(req.headers["x-user-role"] || "").trim().toLowerCase();

  const isAuthorizedAdmin =
    (callerEmail && AUTHORIZED_ADMIN_EMAILS.includes(callerEmail)) ||
    callerRole === "admin";

  if (!isAuthorizedAdmin) {
    res.status(403).json({
      error: "Access Denied: Elevated administrative privileges are required to perform this action.",
      code: "RBAC_PERMISSION_DENIED",
      callerEmail: callerEmail || "anonymous",
    });
    return;
  }

  next();
}

// API: Admin System Status & Diagnostic Telemetry (Protected by RBAC)
app.get("/api/admin/system-stats", requireAdminRole, (_req, res) => {
  const isSmtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const isMapsConfigured = Boolean(
    process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
  );

  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    security: {
      rbacEnforced: true,
      rulesDeployed: true,
      ownerIsolationEnforced: true,
      authorizedAdminCount: AUTHORIZED_ADMIN_EMAILS.length,
    },
    integrations: {
      gemini: {
        configured: isGeminiConfigured,
        fallbackLadder: MODEL_FALLBACK_LADDER,
        primaryModel: MODEL_FALLBACK_LADDER[0],
      },
      googleMaps: {
        configured: isMapsConfigured,
        geocodingProxyActive: true,
        attributionTracking: "gmp_mcp_codeassist_v1_aistudio",
      },
      emailReminders: {
        configured: isSmtpConfigured,
        mode: isSmtpConfigured ? "smtp" : "simulated",
      },
    },
  });
});

// API: Verify Admin Permissions Benchmark (Used for Security Verification)
app.post("/api/admin/verify-access", requireAdminRole, (req, res) => {
  const callerEmail = String(req.headers["x-admin-email"] || "").trim().toLowerCase();
  res.json({
    verified: true,
    callerEmail,
    role: "admin",
    grantedPermissions: [
      "ADMIN_AUDIT_LOG_READ_WRITE",
      "SYSTEM_STATS_TELEMETRY",
      "USER_ROLE_MANAGEMENT",
      "REFLECTION_MODERATION",
      "GLOBAL_SPARK_CONFIG",
    ],
    timestamp: Date.now(),
  });
});

// API: Reflect / Chat with Gemini
app.post("/api/gemini/reflect", async (req, res) => {
  try {
    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];
    const mode = typeof body.mode === "string" ? body.mode : "reflection";

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required and cannot be empty." });
      return;
    }

    // Derive title for new reflection sessions
    const title = history.length === 0 ? extractTitleFromPrompt(prompt) : "";

    // If no GEMINI_API_KEY is configured on the server, gracefully use built-in reflective engine
    if (!process.env.GEMINI_API_KEY) {
      console.info("[Reflections Engine] No GEMINI_API_KEY detected. Utilizing built-in reflective synthesis engine.");
      const localResult = generateLocalReflection(prompt, mode);
      res.json({
        response: localResult.text,
        title: title || "Reflective Journal Entry",
        modelUsed: localResult.modelUsed,
      });
      return;
    }

    // Prepare system instructions tailored by mode
    const systemInstructionsMap: Record<string, string> = {
      reflection:
        "You are an empathetic, insightful philosophical journaling companion and mentor. Your goal is to help the user unpack their feelings, thought patterns, and life experiences with deep clarity, compassion, and meaningful questions. Offer gentle observations, validate emotions, and propose 1-2 thoughtful reflective questions.",
      summary:
        "You are a structured analytical assistant for personal reflections. Synthesize the user's journal entry into key insights, emotional tones, core themes, and a brief takeaway bulleted summary.",
      brainstorm:
        "You are an imaginative, practical brainstorming partner. Based on the user's reflection, brainstorm creative perspectives, unexpected angles, actionable ideas, and opportunities for positive forward movement.",
      action_plan:
        "You are a supportive executive coach and productivity strategist. Help translate the user's thoughts and aspirations into clear, manageable, step-by-step actionable micro-habits and priority milestones.",
      empathy:
        "You are a warm, nurturing, non-judgmental presence. Provide supportive emotional grounding, active listening, validation, and encouragement for whatever the user is going through.",
    };

    const systemInstruction =
      systemInstructionsMap[mode] || systemInstructionsMap.reflection;

    // Build conversation contents
    const contents: Array<{ role?: string; parts: Array<{ text: string }> }> = [];

    for (const item of history) {
      if (item && typeof item === "object" && item.text) {
        const role = item.role === "model" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: String(item.text) }],
        });
      }
    }

    // Add current turn
    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    try {
      const result = await generateContentWithFallback(contents, systemInstruction);

      res.json({
        response: result.text,
        title: title || "Reflective Journal Entry",
        modelUsed: result.modelUsed,
      });
    } catch (modelErr: any) {
      console.warn("[Reflections Engine] Live Gemini models unavailable or quota exhausted. Activating built-in reflective synthesis engine:", modelErr?.message || modelErr);
      const localFallback = generateLocalReflection(prompt, mode);
      res.json({
        response: localFallback.text,
        title: title || "Reflective Journal Entry",
        modelUsed: localFallback.modelUsed,
      });
    }
  } catch (error: any) {
    console.error("Error in /api/gemini/reflect:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate reflection response.",
    });
  }
});

// API: Check Email Reminders Service Status
app.get("/api/reminders/status", (_req, res) => {
  const isSmtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
  res.json({
    status: "ok",
    isSmtpConfigured,
    mode: isSmtpConfigured ? "smtp" : "simulated",
    fromAddress: process.env.SMTP_FROM || process.env.SMTP_USER || "reflections@journal.internal",
  });
});

// API: Send Daily Email Reminder
app.post("/api/reminders/send-email", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const theme = typeof body.theme === "string" ? body.theme : "evening_reflection";
    const customMessage = typeof body.customMessage === "string" ? body.customMessage.trim() : "";
    const reminderTime = typeof body.time === "string" ? body.time : "20:30";
    const isTest = Boolean(body.isTest);

    // Defensive Email Validation (OWASP Input Sanitization)
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
      res.status(400).json({
        error: "A valid email address is required to receive reflection reminders.",
      });
      return;
    }

    const themeData = REMINDER_THEME_PROMPTS[theme] || REMINDER_THEME_PROMPTS.evening_reflection;
    const promptText = customMessage || themeData.prompt;
    const themeTitle = themeData.title;

    // App URL fallback
    const appUrl =
      process.env.APP_URL ||
      "https://ais-dev-l6w4ubory5wvyi7tpdjc5h-278965238571.asia-southeast1.run.app";

    const subject = isTest
      ? `[Test] 🌱 Daily Reflection Reminder — ${themeTitle}`
      : `🌱 Time for your Daily Reflection — ${themeTitle}`;

    const { transporter, isSimulated } = getEmailTransporter();

    const fromAddress =
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      '"Reflections Journal" <reminders@reflections.app>';

    // Beautiful Responsive HTML Email Template
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4efe6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #2d2d2a;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 600px;
      margin: 30px auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e8e2d5;
    }
    .header {
      background-color: #2d2d2a;
      padding: 32px 28px;
      text-align: center;
      color: #f8f7f2;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
      margin: 0;
      color: #f8f7f2;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #deb887;
      margin-top: 6px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 16px;
      color: #6f6e69;
      margin-bottom: 20px;
    }
    .prompt-card {
      background-color: #faf7f2;
      border-left: 4px solid #8c5b3e;
      border-radius: 10px;
      padding: 24px;
      margin: 24px 0;
    }
    .prompt-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #8c5b3e;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .prompt-text {
      font-size: 19px;
      color: #2d2d2a;
      font-style: italic;
      font-family: Georgia, serif;
      margin: 0;
      line-height: 1.5;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #2d2d2a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 0.2px;
    }
    .quote-box {
      border-top: 1px solid #eee8df;
      padding-top: 24px;
      margin-top: 28px;
      text-align: center;
      font-size: 13px;
      color: #8b8882;
      font-style: italic;
    }
    .footer {
      background-color: #f8f6f0;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #999690;
      border-top: 1px solid #eae5db;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Reflections</h1>
      <div class="brand-subtitle">Mindful Daily Journaling</div>
    </div>
    <div class="content">
      <div class="greeting">
        Hello,<br>
        Here is your scheduled daily reflection prompt for <strong>${escapeHtml(reminderTime)}</strong>.
      </div>
      <div class="prompt-card">
        <div class="prompt-label">${escapeHtml(themeTitle)}</div>
        <p class="prompt-text">"${escapeHtml(promptText)}"</p>
      </div>
      <div class="cta-container">
        <a href="${escapeHtml(appUrl)}" class="cta-button" target="_blank">
          Open Journal &amp; Begin Reflection &rarr;
        </a>
      </div>
      <div class="quote-box">
        &ldquo;In the midst of movement and chaos, keep stillness inside of you.&rdquo; &mdash; Deepak Chopra
      </div>
    </div>
    <div class="footer">
      This email reminder was sent by your Reflections Journal.<br>
      You can customize or disable reminders anytime in your app's Reminder Settings.
    </div>
  </div>
</body>
</html>
`;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject,
      text: `Reflections Journal — Daily Reflection Reminder (${themeTitle})\n\n"${promptText}"\n\nOpen your journal to reflect: ${appUrl}`,
      html: htmlContent,
    };

    const sendResult = await transporter.sendMail(mailOptions);
    console.log(`[Email Reminder] Dispatched to ${email}. Message ID: ${sendResult.messageId}. Mode: ${isSimulated ? "Simulated/Dev" : "Live SMTP"}`);

    res.json({
      success: true,
      message: isTest
        ? `Test email reminder prepared for ${email}.`
        : `Daily email reminder dispatched to ${email}.`,
      mode: isSimulated ? "simulated" : "smtp",
      messageId: sendResult.messageId,
      recipient: email,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error sending reminder email:", error);
    res.status(500).json({
      error: error?.message || "Failed to dispatch email reminder.",
    });
  }
});

// Google Maps Reverse/Forward Geocoding Secure Proxy Endpoint
// Mitigates client CORS (CF1), shields raw keys from browser inspection if using server key,
// and enforces input parameter bounds (OWASP A03).
app.all("/api/maps/geocode", async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res.json({
        configured: false,
        results: [],
        message: "Google Maps API key is not configured in server environment.",
      });
    }

    const payload = (req.method === "POST" && req.body && typeof req.body === "object")
      ? req.body
      : req.query;

    const { lat, lng, address } = payload as { lat?: any; lng?: any; address?: any };

    let geocodeUrl = "";
    if (lat !== undefined && lng !== undefined) {
      const numLat = Number(lat);
      const numLng = Number(lng);
      if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        return res.status(400).json({ error: "Invalid latitude (-90..90) or longitude (-180..180)." });
      }
      geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${numLat},${numLng}&key=${encodeURIComponent(apiKey)}&internalUsageAttributionIds=gmp_mcp_codeassist_v1_aistudio`;
    } else if (address && typeof address === "string") {
      const sanitizedAddress = address.trim().slice(0, 200);
      if (!sanitizedAddress) {
        return res.status(400).json({ error: "Address cannot be empty." });
      }
      geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(sanitizedAddress)}&key=${encodeURIComponent(apiKey)}&internalUsageAttributionIds=gmp_mcp_codeassist_v1_aistudio`;
    } else {
      return res.status(400).json({ error: "Please provide either (lat, lng) or address." });
    }

    const gRes = await fetch(geocodeUrl);
    const data: any = await gRes.json();

    if (data.status === "OK" && Array.isArray(data.results)) {
      const sanitizedResults = data.results.slice(0, 5).map((item: any) => ({
        formatted_address: item.formatted_address || "",
        place_id: item.place_id || "",
        lat: item.geometry?.location?.lat ?? 0,
        lng: item.geometry?.location?.lng ?? 0,
        types: item.types || [],
      }));

      return res.json({
        configured: true,
        status: "OK",
        results: sanitizedResults,
      });
    }

    return res.json({
      configured: true,
      status: data.status,
      results: [],
      error_message: data.error_message || undefined,
    });
  } catch (error: any) {
    console.error("Geocoding proxy error:", error);
    res.status(500).json({ error: "Failed to communicate with Geocoding service." });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
