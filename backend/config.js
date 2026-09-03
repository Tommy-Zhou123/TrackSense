import "dotenv/config";

export const PORT = process.env.PORT || 3001;

export const supabaseUrl = process.env.SUPABASE_URL;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const geminiApiKey = process.env.GEMINI_API_KEY || "";
export const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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
		].filter(Boolean)
	),
];

export const frontendUrl = frontendOrigins[0];

if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
	throw new Error(
		"Missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY. Set them in backend/.env or the Vercel project environment."
	);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
	throw new Error(
		"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in backend/.env or the Vercel project environment."
	);
}
