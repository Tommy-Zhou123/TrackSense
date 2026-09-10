import express from "express";
import { isLoggedIn, requireProfile, requireProfileWrite } from "../middleware.js";
import { supabase } from "../lib/supabase.js";
import { writeLimiter } from "../lib/rateLimit.js";
import {
	MAX_GROUP_NAME,
	MAX_MEMBER_CATEGORY,
	MAX_MEMBERS,
	UNCATEGORIZED,
	clip,
	isUuid,
	isUniqueViolation,
	mapGroup,
	namesMatch,
	uniqueCategories,
} from "../lib/overarchingCategory.js";

const router = express.Router();

const GROUP_SELECT = "id, name, overarching_category_members(category)";

async function loadGroup(profileId, id) {
	const { data, error } = await supabase
		.from("overarching_categories")
		.select(GROUP_SELECT)
		.eq("id", id)
		.eq("profile_id", profileId)
		.maybeSingle();
	if (error) throw error;
	return data ? mapGroup(data) : null;
}

async function categoryRows(table, profileId) {
	const { data, error } = await supabase
		.from(table)
		.select("id, category")
		.eq("profile_id", profileId);
	if (error) throw error;
	return data || [];
}

function matchingIds(rows, name) {
	return rows
		.filter((row) => namesMatch(row.category, name))
		.map((row) => row.id);
}

router.patch("/leaf", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const from = clip(req.body.from, MAX_MEMBER_CATEGORY);
		const to = clip(req.body.to, MAX_MEMBER_CATEGORY);
		if (!from || !to) {
			return res.status(400).send({ message: "from and to are required" });
		}
		if (namesMatch(from, to)) {
			return res.status(200).send({ from, to });
		}

		const [expenseRows, ruleRows, memberRows] = await Promise.all([
			categoryRows("expenses", req.profileId),
			categoryRows("vendor_rules", req.profileId),
			categoryRows("overarching_category_members", req.profileId),
		]);

		const taken = [...expenseRows, ...ruleRows, ...memberRows].some(
			(row) => namesMatch(row.category, to) && !namesMatch(row.category, from),
		);
		if (taken) {
			return res.status(409).send({ message: `"${to}" already exists` });
		}

		const expenseIds = matchingIds(expenseRows, from);
		const ruleIds = matchingIds(ruleRows, from);
		const memberIds = matchingIds(memberRows, from);

		if (expenseIds.length) {
			const { error } = await supabase
				.from("expenses")
				.update({ category: to })
				.in("id", expenseIds)
				.eq("profile_id", req.profileId);
			if (error) throw error;
		}
		if (ruleIds.length) {
			const { error } = await supabase
				.from("vendor_rules")
				.update({ category: to, updated_at: new Date().toISOString() })
				.in("id", ruleIds)
				.eq("profile_id", req.profileId);
			if (error) throw error;
		}
		if (memberIds.length) {
			const { error } = await supabase
				.from("overarching_category_members")
				.update({ category: to })
				.in("id", memberIds)
				.eq("profile_id", req.profileId);
			if (error) {
				if (isUniqueViolation(error)) {
					return res.status(409).send({ message: `"${to}" already exists` });
				}
				throw error;
			}
		}

		return res.status(200).send({ from, to });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.delete("/leaf", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const name = clip(req.body.name, MAX_MEMBER_CATEGORY);
		if (!name) {
			return res.status(400).send({ message: "name is required" });
		}
		if (namesMatch(name, UNCATEGORIZED)) {
			return res.status(400).send({ message: "Uncategorized cannot be deleted" });
		}

		const [expenseRows, ruleRows, memberRows] = await Promise.all([
			categoryRows("expenses", req.profileId),
			categoryRows("vendor_rules", req.profileId),
			categoryRows("overarching_category_members", req.profileId),
		]);

		const expenseIds = matchingIds(expenseRows, name);
		const ruleIds = matchingIds(ruleRows, name);
		const memberIds = matchingIds(memberRows, name);

		if (expenseIds.length) {
			const { error } = await supabase
				.from("expenses")
				.update({ category: UNCATEGORIZED })
				.in("id", expenseIds)
				.eq("profile_id", req.profileId);
			if (error) throw error;
		}
		if (ruleIds.length) {
			const { error } = await supabase
				.from("vendor_rules")
				.delete()
				.in("id", ruleIds)
				.eq("profile_id", req.profileId);
			if (error) throw error;
		}
		if (memberIds.length) {
			const { error } = await supabase
				.from("overarching_category_members")
				.delete()
				.in("id", memberIds)
				.eq("profile_id", req.profileId);
			if (error) throw error;
		}

		return res.status(200).send({ name, message: "Category deleted successfully!" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.get("/", isLoggedIn, requireProfile, async (req, res) => {
	try {
		const { data, error } = await supabase
			.from("overarching_categories")
			.select(GROUP_SELECT)
			.eq("profile_id", req.profileId)
			.order("name", { ascending: true });

		if (error) throw error;
		return res.status(200).json({
			groups: (data || []).map(mapGroup),
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.post("/", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const name = clip(req.body.name, MAX_GROUP_NAME);
		if (!name) {
			return res.status(400).send({ message: "Name is required" });
		}

		const { data, error } = await supabase
			.from("overarching_categories")
			.insert({
				user_id: req.userId,
				profile_id: req.profileId,
				name,
			})
			.select(GROUP_SELECT)
			.single();

		if (error) {
			if (isUniqueViolation(error)) {
				return res.status(409).send({
					message: "A group with that name already exists",
				});
			}
			throw error;
		}
		return res.status(201).send(mapGroup(data));
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.patch("/:id", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUuid(id)) {
			return res.status(400).send({ message: "Invalid group id" });
		}

		const name = clip(req.body.name, MAX_GROUP_NAME);
		if (!name) {
			return res.status(400).send({ message: "Name is required" });
		}

		const { data, error } = await supabase
			.from("overarching_categories")
			.update({ name })
			.eq("id", id)
			.eq("profile_id", req.profileId)
			.select(GROUP_SELECT)
			.maybeSingle();

		if (error) {
			if (isUniqueViolation(error)) {
				return res.status(409).send({
					message: "A group with that name already exists",
				});
			}
			throw error;
		}
		if (!data) {
			return res.status(404).send({ message: "Group not found" });
		}
		return res.status(200).send(mapGroup(data));
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.delete("/:id", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUuid(id)) {
			return res.status(400).send({ message: "Invalid group id" });
		}

		const { data, error } = await supabase
			.from("overarching_categories")
			.delete()
			.eq("id", id)
			.eq("profile_id", req.profileId)
			.select("id")
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Group not found" });
		}
		return res.status(200).send({ id, message: "Group deleted successfully!" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.put("/:id/members", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUuid(id)) {
			return res.status(400).send({ message: "Invalid group id" });
		}
		if (!Array.isArray(req.body.categories)) {
			return res.status(400).send({ message: "categories must be an array" });
		}

		const categories = uniqueCategories(req.body.categories);
		if (categories.length > MAX_MEMBERS) {
			return res.status(400).send({
				message: `A group can have at most ${MAX_MEMBERS} categories`,
			});
		}

		const existing = await loadGroup(req.profileId, id);
		if (!existing) {
			return res.status(404).send({ message: "Group not found" });
		}

		if (categories.length > 0) {
			const { data: others, error: othersError } = await supabase
				.from("overarching_category_members")
				.select("category, overarching_id, overarching_categories(name)")
				.eq("profile_id", req.profileId)
				.neq("overarching_id", id);

			if (othersError) throw othersError;

			const wanted = new Set(categories.map((name) => name.toLowerCase()));
			for (const row of others || []) {
				const leaf = String(row.category || "").trim();
				if (!wanted.has(leaf.toLowerCase())) continue;
				const related = row.overarching_categories;
				const groupName = Array.isArray(related)
					? related[0]?.name
					: related?.name;
				return res.status(409).send({
					message: `"${leaf}" is already in ${groupName || "another group"}`,
					category: leaf,
					groupName: groupName || "",
				});
			}
		}

		const { error: deleteError } = await supabase
			.from("overarching_category_members")
			.delete()
			.eq("overarching_id", id)
			.eq("profile_id", req.profileId);

		if (deleteError) throw deleteError;

		if (categories.length > 0) {
			const { error: insertError } = await supabase
				.from("overarching_category_members")
				.insert(
					categories.map((category) => ({
						user_id: req.userId,
						profile_id: req.profileId,
						overarching_id: id,
						category,
					}))
				);

			if (insertError) {
				if (isUniqueViolation(insertError)) {
					return res.status(409).send({
						message: "That category is already in another group",
					});
				}
				throw insertError;
			}
		}

		const saved = await loadGroup(req.profileId, id);
		return res.status(200).send(saved);
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.post("/:id/members", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		if (!isUuid(id)) {
			return res.status(400).send({ message: "Invalid group id" });
		}
		const category = clip(req.body.category, MAX_MEMBER_CATEGORY);
		if (!category) {
			return res.status(400).send({ message: "category is required" });
		}
		if (namesMatch(category, UNCATEGORIZED)) {
			return res.status(400).send({ message: "Uncategorized cannot be linked to a group" });
		}

		const existing = await loadGroup(req.profileId, id);
		if (!existing) {
			return res.status(404).send({ message: "Group not found" });
		}
		if (existing.categories.some((name) => namesMatch(name, category))) {
			return res.status(200).send(existing);
		}

		const { data: others, error: othersError } = await supabase
			.from("overarching_category_members")
			.select("category, overarching_id, overarching_categories(name)")
			.eq("profile_id", req.profileId)
			.neq("overarching_id", id);

		if (othersError) throw othersError;

		for (const row of others || []) {
			if (!namesMatch(row.category, category)) continue;
			const related = row.overarching_categories;
			const groupName = Array.isArray(related)
				? related[0]?.name
				: related?.name;
			return res.status(409).send({
				message: `"${String(row.category || "").trim()}" is already in ${groupName || "another group"}`,
				category: row.category,
				groupName: groupName || "",
			});
		}

		const { error: insertError } = await supabase
			.from("overarching_category_members")
			.insert({
				user_id: req.userId,
				profile_id: req.profileId,
				overarching_id: id,
				category,
			});

		if (insertError) {
			if (isUniqueViolation(insertError)) {
				return res.status(409).send({
					message: "That category is already in another group",
				});
			}
			throw insertError;
		}

		const saved = await loadGroup(req.profileId, id);
		return res.status(201).send(saved);
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

export default router;
