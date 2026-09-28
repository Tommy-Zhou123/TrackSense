import "dotenv/config";

export const PORT = process.env.PORT || 3001;

export const supabaseUrl = process.env.SUPABASE_URL;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const geminiApiKey = process.env.GEMINI_API_KEY || "";
export const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const DEFAULT_GEMINI_FALLBACKS = ["gemini-3.5-flash"];

function parseModelList(value) {
  return String(value || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

export const geminiModels = [
  geminiModel,
  ...(process.env.GEMINI_MODELS
    ? parseModelList(process.env.GEMINI_MODELS)
    : DEFAULT_GEMINI_FALLBACKS),
].filter((model, index, models) => models.indexOf(model) === index);

export const groqApiKey = process.env.GROQ_API_KEY || "";
export const groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

const DEFAULT_GROQ_FALLBACKS = ["qwen/qwen3.8-27b"];

export const groqModels = [
  groqModel,
  ...(process.env.GROQ_MODELS
    ? parseModelList(process.env.GROQ_MODELS)
    : DEFAULT_GROQ_FALLBACKS),
].filter((model, index, models) => models.indexOf(model) === index);

export const groqVisionModel = process.env.GROQ_VISION_MODEL || "";

function withHttps(host) {
  if (!host) return null;
  return host.startsWith("http://") || host.startsWith("https://")
    ? host.replace(/\/$/, "")
    : `https://${host.replace(/\/$/, "")}`;
}

export const frontendOrigins = [
  ...new Set(
    [
      process.env.FRONTEND_URL,
      withHttps(process.env.VERCEL_PROJECT_PRODUCTION_URL),
      withHttps(process.env.VERCEL_URL),
      "http://localhost:5173",
    ].filter(Boolean),
  ),
];

export const frontendUrl = frontendOrigins[0];

if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    "Missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY. Set them in backend/.env or the Vercel project environment.",
  );
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in backend/.env or the Vercel project environment.",
  );
}
