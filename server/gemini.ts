import { GoogleGenAI } from "@google/genai";

// Initialize the Google Gen AI client safely
let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (ai) return ai;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. AstraCogniX AI will operate in demo simulation mode.");
    return null;
  }

  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    return ai;
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI client:", error);
    return null;
  }
}

export interface GeminiQueryOptions {
  prompt: string;
  systemInstruction?: string;
  fileData?: {
    mimeType: string;
    base64: string;
  };
}

/**
 * High-performance Gemini query handler.
 * Gracefully falls back to beautiful rich simulated stream responses when key is missing.
 */
export async function queryGemini(options: GeminiQueryOptions): Promise<{ text: string; isSimulated: boolean }> {
  const client = getGeminiClient();
  const modelName = "gemini-3.5-flash";

  if (!client) {
    // Return high-quality, simulated, rich response
    return {
      text: simulateResponse(options.prompt, options.systemInstruction, options.fileData?.mimeType),
      isSimulated: true,
    };
  }

  try {
    const parts: any[] = [];

    if (options.fileData) {
      parts.push({
        inlineData: {
          mimeType: options.fileData.mimeType,
          data: options.fileData.base64,
        },
      });
    }

    parts.push({
      text: options.prompt,
    });

    const response = await client.models.generateContent({
      model: modelName,
      contents: { parts },
      config: options.systemInstruction
        ? {
            systemInstruction: options.systemInstruction,
          }
        : undefined,
    });

    return {
      text: response.text || "No response received from Gemini.",
      isSimulated: false,
    };
  } catch (err: any) {
    console.error("Gemini API call failed, falling back to simulation mode:", err);
    return {
      text: `[Simulation Fallback (Reason: ${err.message || "API Error"})]\n\n${simulateResponse(
        options.prompt,
        options.systemInstruction,
        options.fileData?.mimeType
      )}`,
      isSimulated: true,
    };
  }
}

/**
 * Simulate beautiful responses for offline/demo operation when API key is unavailable.
 */
function simulateResponse(prompt: string, systemInstruction?: string, mimeType?: string): string {
  const pLower = prompt.toLowerCase();
  const instLower = systemInstruction ? systemInstruction.toLowerCase() : "";

  // Check Agent Personas in System Instruction
  if (instLower.includes("professor astra") || instLower.includes("professor")) {
    return `### 🎓 Scholar Insights — Professor Astra

Welcome to my seminar. Regarding your inquiry on: *"**${prompt}**"*

Let's break this academic concept down step-by-step:

1. **Theoretical Foundations**: We first define the core parameters. Every system requires solid axiom structures to prevent logical drift.
2. **Methodological Blueprint**:
   - **Step A**: Standardize inputs and filter out environmental noise.
   - **Step B**: Apply mathematical or computational transformers to calculate relational density.
   - **Step C**: Verify the outcomes against empirical control datasets.
3. **Scholarly Conclusion**: This approach eliminates complexity and establishes a deterministic pattern for further exploration.

*How can I help you detail this hypothesis further? Feel free to ask about algorithms, science, or computer logic!*`;
  }

  if (instLower.includes("creative muse") || instLower.includes("creative") || instLower.includes("muse")) {
    return `### 🎨 Sparks of Imagination — Creative Muse

Ah, the canvas of your thoughts is sparkling! Let us dive into the story of: *"**${prompt}**"*

*Imagine a world of endless paths, where your ideas drift like warm stardust across a quiet twilight sky. Every word we write is a brushstroke of color on a blank, waiting tapestry.*

Here is a creative reflection of your vision:
- **The Core Whisper**: We find the quiet, breathing heart of this concept—the emotional spark that makes it feel alive.
- **The Narrative Flow**: The idea starts to dance, rising and falling with a natural, lyrical rhythm that captures the reader's gaze.
- **The Creative Awakening**: A memorable ending that lingers in the mind like a soft echo in a vast canyon.

*Let's keep spinning this beautiful tale together! What should our characters discover next?*`;
  }

  if (instLower.includes("socrates") || instLower.includes("philosophy") || instLower.includes("philosopher")) {
    return `### 🏛️ Dialogues of Inquiry — Socrates Chatbot

Greetings, seeker of truth. You ask me about: *"**${prompt}**"*

Before I provide a simple conclusion, let us examine the foundations of this thought together:

- **The Source**: From where does this desire for understanding arise? What assumptions are we holding as true?
- **The Definition**: How do we define success, goodness, or clarity within this topic? 
- **The Counterpoint**: If the opposite of your query were true, what truth would still remain untouched?

*I encourage you to look inward and ponder: what is your own first instinct when reflecting on this dilemma?*`;
  }

  // If a generic or customized user agent is active
  if (systemInstruction && systemInstruction.includes("Always address yourself as")) {
    const parts = systemInstruction.split("Always address yourself as");
    const agentName = parts[1] ? parts[1].replace(/[.!]/g, "").trim() : "Custom Agent";
    return `### 🔔 Agent Node — ${agentName}

Greetings! As your dedicated agent **${agentName}**, I have received your request regarding: *"**${prompt}**"*

Based on my specialized instructions and active personality guidelines:
1. **Context Alignment**: I am prioritizing your core focus and executing specialized workflows.
2. **Strategic Strategy**:
   - I have scanned the parameters of your query.
   - I am generating a structured approach tailored to your exact goal.
3. **Actionable Delivery**: We will structure this with modular accuracy to maintain maximum performance.

*How would you like me to proceed with this task, Explorer?*`;
  }

  // --- STANDARD MULTI-MODAL FILE RESPONSE ---
  if (mimeType) {
    return `### 📊 Multi-Modal Asset Analysis

I have scanned the uploaded file (${mimeType}) and extracted its core properties.

**File Analysis & Key Findings:**
1. **Document Structure**: High density of textual content detected. I've performed deep layout structure extraction.
2. **Key Topics**: Focuses on professional operations, user account schemas, and dashboard metrics.
3. **OCR text output**: "AstraCogniX AI Cloud Operations and JWT Auth Token Management v2.1"

Based on your prompt *"**${prompt}**"*, here is my detailed answer:
- **Core Insights**: The attached file defines key telemetry guidelines, with sub-categories for subscription tiers (**Free**, **Pro**, and **Enterprise**).
- **Extracted Metadata**: Found timestamp values matching current session activity, representing fully-functional client states.

Is there anything specific you would like me to extract or re-evaluate from this document?`;
  }

  // --- STANDARD DYNAMIC KEYWORD SYSTEM ---
  if (pLower.includes("hello") || pLower.includes("hi") || pLower.includes("hey")) {
    return `### Hello! Welcome to **AstraCogniX AI** 🚀

I am your powerful assistant inspired by Google Gemini and Google AI Studio. I can assist you with code generation, complex reasoning, content creation, image understanding, and document analysis.

How can I help you unlock your productivity today? Feel free to ask a technical question, write a story, or try out our **AI Agent Workspace**!`;
  }

  if (pLower.includes("code") || pLower.includes("write a function") || pLower.includes("typescript") || pLower.includes("javascript") || pLower.includes("python")) {
    return `Here is a complete, production-ready TypeScript implementation of a thread-safe caching service using an eviction strategy.

\`\`\`typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class HighPerformanceCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number = 60000) {}

  /**
   * Set a cache value with an optional Custom TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    const duration = ttlMs ?? this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + duration
    });
  }

  /**
   * Retrieve a value from the cache, ensuring it hasn't expired.
   */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key); // Evict stale entry
      return null;
    }

    return entry.value;
  }
}
\`\`\`

### Key Features of this Implementation:
1. **O(1) Access**: Fast reads/writes using the standard JavaScript Map structure.
2. **Memory Eviction**: Lazy deletion of expired items during access lookup.
3. **Type-Safe**: Uses TypeScript generics (\`<T>\`) to guarantee complete type-safety.`;
  }

  if (pLower.includes("subscription") || pLower.includes("price") || pLower.includes("plan") || pLower.includes("billing")) {
    return `### 💎 AstraCogniX AI Subscriptions

We offer three premium packages to accommodate users of all sizes:

1. **Free Tier**: Get started with 10 total messages and up to 2 active sessions.
2. **Pro Tier ($19/month)**:
   - Unlimited high-speed chat
   - Custom AI Agent creation and saving
   - Multi-modal support (PDF and image understanding)
   - OCR tools & Voice interactions
3. **Enterprise Tier ($99/month)**:
   - Priority processing
   - Shared agents & collaboration tools
   - Advanced usage analytics & dedicated support
   - Unlimited document indexing

Would you like to upgrade to **Pro** to unlock these advanced features immediately?`;
  }

  if (pLower.includes("weather") || pLower.includes("rain") || pLower.includes("temperature")) {
    return `### 🌤️ Weather Forecast Integration

Analyzing localized meteorological data telemetry...

- **Current Conditions**: 22°C (71.6°F) with a light breeze from the northeast (12 km/h).
- **Humidity**: 64%
- **Precipitation Probability**: 15% (partly cloudy skies).
- **Astra CogniX recommendation**: Today is an excellent day for outdoor tasks, or focused code design sessions in a well-lit environment!`;
  }

  if (pLower.includes("help") || pLower.includes("how to") || pLower.includes("tutorial")) {
    return `### ❓ AstraCogniX AI Help Desk

Here's how to navigate and maximize your productivity with AstraCogniX:

1. **AI Playground**: Your primary view for sending prompts, attaching documents/images, and querying our high-speed transformer model.
2. **AI Agent Workspace**: Create, custom-configure, and switch between unique personalities (e.g., Professor Astra, Socrates Chatbot, Creative Muse).
3. **Billing Hub**: View live token usages, credit balances, and manage subscription licenses.
4. **Settings Configuration**: Verify your Google email accounts, clear system memory cache nodes, and toggle PWA push notifications.`;
  }

  // Generic rich response based on keywords
  const subject = prompt.slice(0, 45) + (prompt.length > 45 ? "..." : "");
  return `### 🧠 AstraCogniX AI Insights

I have evaluated your prompt regarding: *"**${subject}**"*

Here is a structured, comprehensive overview to help you achieve your objective:

- **Key Premise**: Your question touches on vital aspects of computational workflows and structured design optimization.
- **Detailed Explanation**:
  - We can modularize this approach by defining clear input states and isolating external variables.
  - Using a step-by-step pipeline ensures that tasks are executed asynchronously, preventing blocking conditions in full-stack runtimes.
- **Astra Recommendation**: Maintain a single source of truth across all sessions, and ensure proper type-safety checks to elevate system design quality.

*Note: AstraCogniX is fully integrated with Google Gemini to offer top-tier reasoning capabilities!*`;
}
