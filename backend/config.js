import "dotenv/config";

export const PORT = process.env.PORT || 3001;

export const supabaseUrl = process.env.SUPABASE_URL;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
	throw new Error(
		"Missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY. Add them to backend/.env"
	);
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
	throw new Error(
		"Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to backend/.env"
	);
}
