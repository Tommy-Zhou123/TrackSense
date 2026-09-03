import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "../config.js";

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
});
