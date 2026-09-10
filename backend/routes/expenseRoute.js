import express from "express";
import multer from "multer";
import { isLoggedIn, requireProfile, requireProfileWrite } from "../middleware.js";
import { supabase } from "../lib/supabase.js";
import { mapExpense, toDateValue, isSplitAssignment } from "../lib/expense.js";
import { activeMemberOnProfile, isUuid } from "../lib/profile.js";
import { geminiApiKey } from "../config.js";
import { maskPan, parseStatementPdf } from "../lib/statementParse.js";
import {
	writeLimiter,
	importLimiter,
	parseStatementLimiter,
	MAX_IMPORT_ROWS,
	MAX_PDF_BYTES,
} from "../lib/rateLimit.js";

const uploadPdf = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_PDF_BYTES, files: 1 },
	fileFilter(_req, file, cb) {
		const name = (file.originalname || "").toLowerCase();
		const type = (file.mimetype || "").toLowerCase();
		if (type === "application/pdf" || name.endsWith(".pdf")) {
			cb(null, true);
			return;
		}
		cb(new Error("Only PDF files are accepted"));
	},
}).single("file");

function acceptPdfUpload(req, res, next) {
	uploadPdf(req, res, (err) => {
		if (!err) return next();
		if (err.code === "LIMIT_FILE_SIZE") {
			return res.status(413).send({
				message: "PDF must be 12MB or smaller",
			});
		}
		return res.status(400).send({
			message: maskPan(err.message) || "Could not upload file",
		});
	});
}

async function resolveAssignedMemberId(profileId, value) {
	if (isSplitAssignment(value)) return null;
	const member = await activeMemberOnProfile(profileId, value);
	if (!member) {
		const error = new Error("That person is not on this profile");
		error.status = 400;
		throw error;
	}
	return member.id;
}

function expenseFields(body) {
	const date = toDateValue(body.date);
	if (
		!date ||
		body.amount == null ||
		!body.vendor ||
		!body.account ||
		!body.category
	) {
		return null;
	}
	return {
		date,
		account: body.account,
		vendor: body.vendor,
		amount: body.amount,
		category: body.category,
		notes: body.notes || "",
	};
}

const router = express.Router();

router.post("/add", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const date = toDateValue(req.body.date);
		if (
			date &&
			req.body.amount != null &&
			req.body.vendor &&
			req.body.account &&
			req.body.category
		) {
			const assignedMemberId = await resolveAssignedMemberId(
				req.profileId,
				req.body.assignedMemberId
			);
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
					profile_id: req.profileId,
					assigned_member_id: assignedMemberId,
				})
				.select()
				.single();

			if (error) throw error;
			return res.status(201).send(mapExpense(data));
		}

		res.status(400).send({ message: "All fields are required!" });
	} catch (err) {
		if (err.status) {
			return res.status(err.status).send({ message: err.message });
		}
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.post("/import", isLoggedIn, requireProfile, requireProfileWrite, importLimiter, async (req, res) => {
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
				profile_id: req.profileId,
				assigned_member_id: null,
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
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.post(
	"/parse-statement",
	isLoggedIn,
	requireProfile,
	requireProfileWrite,
	parseStatementLimiter,
	acceptPdfUpload,
	async (req, res) => {
		try {
			if (!geminiApiKey) {
				return res.status(503).send({
					message: "Statement parsing is not configured",
				});
			}
			if (!req.file?.buffer?.length) {
				return res.status(400).send({ message: "Upload a PDF statement" });
			}

			const result = await parseStatementPdf(req.file.buffer);
			return res.status(200).send(result);
		} catch (err) {
			console.log(maskPan(err.message));
			const status = err.status || 500;
			return res.status(status).send({
				message: maskPan(err.message) || "Could not parse statement",
			});
		} finally {
			if (req.file) req.file.buffer = null;
		}
	}
);

router.get("/", isLoggedIn, requireProfile, async (req, res) => {
	try {
		const { data, error } = await supabase
			.from("expenses")
			.select("*")
			.eq("profile_id", req.profileId)
			.order("date", { ascending: false });

		if (error) throw error;
		const expenses = (data || []).map(mapExpense);
		return res.status(200).json({
			count: expenses.length,
			expenses,
		});
	} catch (err) {
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.get("/:id", isLoggedIn, requireProfile, async (req, res) => {
	try {
		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.select("*")
			.eq("id", id)
			.eq("profile_id", req.profileId)
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Expense not found" });
		}
		return res.status(200).json(mapExpense(data));
	} catch (err) {
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.put("/batch", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const rows = req.body.expenses;
		if (!Array.isArray(rows) || rows.length === 0) {
			return res.status(400).send({ message: "No expenses to update" });
		}
		if (rows.length > MAX_IMPORT_ROWS) {
			return res.status(400).send({
				message: `Update is limited to ${MAX_IMPORT_ROWS} expenses at a time`,
			});
		}

		const updated = [];
		for (const row of rows) {
			const id = row._id || row.id;
			const fields = expenseFields(row);
			if (!isUuid(id) || !fields) {
				const error = new Error("All fields are required!");
				error.status = 400;
				throw error;
			}
			const assignedMemberId = await resolveAssignedMemberId(
				req.profileId,
				row.assignedMemberId
			);
			const { data, error } = await supabase
				.from("expenses")
				.update({
					...fields,
					assigned_member_id: assignedMemberId,
				})
				.eq("id", id)
				.eq("profile_id", req.profileId)
				.select("id")
				.maybeSingle();
			if (error) throw error;
			if (!data) {
				const notFound = new Error("Expense not found");
				notFound.status = 404;
				throw notFound;
			}
			updated.push(data.id);
		}

		return res.status(200).send({
			count: updated.length,
			message: "Expenses updated successfully!",
		});
	} catch (err) {
		if (err.status) {
			return res.status(err.status).send({ message: err.message });
		}
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.put("/:id", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const fields = expenseFields(req.body);
		if (!fields) {
			return res.status(400).send({ message: "All fields are required!" });
		}

		const assignedMemberId = await resolveAssignedMemberId(
			req.profileId,
			req.body.assignedMemberId
		);
		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.update({
				...fields,
				assigned_member_id: assignedMemberId,
			})
			.eq("id", id)
			.eq("profile_id", req.profileId)
			.select("id")
			.maybeSingle();

		if (error) throw error;
		if (!data) {
			return res.status(404).send({ message: "Expense not found" });
		}
		return res.status(200).send({ message: "Expense updated successfully!" });
	} catch (err) {
		if (err.status) {
			return res.status(err.status).send({ message: err.message });
		}
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

router.delete("/:id", isLoggedIn, requireProfile, requireProfileWrite, writeLimiter, async (req, res) => {
	try {
		const { id } = req.params;
		const { data, error } = await supabase
			.from("expenses")
			.delete()
			.eq("id", id)
			.eq("profile_id", req.profileId)
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
		console.log(maskPan(err.message));
		res.status(500).send({ message: err.message });
	}
});

export default router;
