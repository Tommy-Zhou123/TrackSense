import express from "express";
import { isLoggedIn, requireProfile, requireProfileWrite } from "../middleware.js";
import { supabase } from "../lib/supabase.js";
import { writeLimiter } from "../lib/rateLimit.js";
import { mapVendorRule, MATCH_TYPES, MAX_RULE_CHARS } from "../lib/vendorRule.js";

const router = express.Router();

function clip(value) {
	return String(value || "").trim().slice(0, MAX_RULE_CHARS);
}

router.get("/", isLoggedIn, requireProfile, async (req, res) => {
	try {
		const { data, error } = await supabase
			.from("vendor_rules")
			.select("id, match_type, match_key, category")
			.eq("profile_id", req.profileId)
			.order("updated_at", { ascending: false });

		if (error) throw error;
		return res.status(200).json({
			rules: (data || []).map(mapVendorRule),
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.put("/", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const matchType = clip(req.body.matchType || req.body.match_type);
		const matchKey = clip(req.body.matchKey || req.body.match_key).toLowerCase();
		const category = clip(req.body.category);

		if (!MATCH_TYPES.has(matchType) || !matchKey || !category) {
			return res.status(400).send({
				message: "matchType, matchKey, and category are required",
			});
		}

		const { data, error } = await supabase
			.from("vendor_rules")
			.upsert(
				{
					user_id: req.userId,
					profile_id: req.profileId,
					match_type: matchType,
					match_key: matchKey,
					category,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "profile_id,match_type,match_key" }
			)
			.select("id, match_type, match_key, category")
			.single();

		if (error) throw error;
		return res.status(200).send(mapVendorRule(data));
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

export default router;
