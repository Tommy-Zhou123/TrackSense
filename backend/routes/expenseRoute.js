import express from "express";
import { isLoggedIn } from "../middleware.js";
import { supabase } from "../lib/supabase.js";
import { mapExpense, toDateValue } from "../lib/expense.js";
import {
	writeLimiter,
	importLimiter,
	MAX_IMPORT_ROWS,
} from "../lib/rateLimit.js";

const router = express.Router();

router.post("/add", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const date = toDateValue(req.body.date);
		if (
			date &&
			req.body.amount != null &&
			req.body.vendor &&
			req.body.account &&
			req.body.category
		) {
			const { data, error } = await supabase
				.from("expenses")
				.insert({
					date,
					account: req.body.account,
					vendor: req.body.vendor,
					amount: req.body.amount,
					category: req.body.category,
					notes: req.body.notes || "",
					user_id: req.userId,
				})
				.select()
				.single();

			if (error) throw error;
			return res.status(201).send(mapExpense(data));
		}

		res.status(400).send({ message: "All fields are required!" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.post("/import", isLoggedIn, importLimiter, async (req, res) => {
	try {
		const rows = req.body.expenses;
		if (!Array.isArray(rows) || rows.length === 0) {
			return res.status(400).send({ message: "No expenses to import" });
		}
		if (rows.length > MAX_IMPORT_ROWS) {
			return res.status(400).send({
				message: `Import is limited to ${MAX_IMPORT_ROWS} expenses at a time`,
			});
		}

		const docs = [];
		for (const row of rows) {
			const amount = Number(row.amount);
			const date = toDateValue(row.date);
			if (
				!date ||
				!row.vendor ||
				!row.account ||
				!row.category ||
				!Number.isFinite(amount)
			) {
				continue;
			}
			docs.push({
				date,
				account: row.account,
				vendor: row.vendor,
				amount,
				category: row.category,
				notes: row.notes || "",
				user_id: req.userId,
			});
		}

		if (docs.length === 0) {
			return res.status(400).send({ message: "No valid expenses to import" });
		}

		const { data, error } = await supabase
			.from("expenses")
			.insert(docs)
			.select();

		if (error) throw error;
		const created = (data || []).map(mapExpense);
		return res.status(201).send({ count: created.length, expenses: created });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.get("/", isLoggedIn, async (req, res) => {
	try {
		const { data, error } = await supabase
			.from("expenses")
			.select("*")
			.eq("user_id", req.userId)
			.order("date", { ascending: false });

		if (error) throw error;
		const expenses = (data || []).map(mapExpense);
		return res.status(200).json({
			count: expenses.length,
			expenses,
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.get("/:id", isLoggedIn, async (req, res) => {
	try {
		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.select("*")
			.eq("id", id)
			.eq("user_id", req.userId)
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Expense not found" });
		}
		return res.status(200).json(mapExpense(data));
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.put("/:id", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		if (
			!req.body.date ||
			req.body.amount == null ||
			!req.body.vendor ||
			!req.body.account ||
			!req.body.category
		) {
			return res.status(400).send({ message: "All fields are required!" });
		}

		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.update({
				date: toDateValue(req.body.date),
				account: req.body.account,
				vendor: req.body.vendor,
				amount: req.body.amount,
				category: req.body.category,
				notes: req.body.notes || "",
			})
			.eq("id", id)
			.eq("user_id", req.userId)
			.select("id")
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Expense not found" });
		}
		return res.status(200).send({ message: "Expense updated successfully!" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

router.delete("/:id", isLoggedIn, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.delete()
			.eq("id", id)
			.eq("user_id", req.userId)
			.select("id")
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Expense not found" });
		}
		return res
			.status(200)
			.send({ _id: id, message: "Expense deleted successfully!" });
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

export default router;
