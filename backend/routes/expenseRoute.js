import express from "express"
import { Expense } from "../models/expense.js"

const router = express.Router()

//Create a new expense
router.post("/add", async (req, res) => {
	try {
		if (
			req.body.date &&
			req.body.amount &&
			req.body.vendor &&
			req.body.account &&
			req.body.category
		) {
			const newExpense = {
				date: req.body.date,
				account: req.body.account,
				vendor: req.body.vendor,
				amount: req.body.amount,
				category: req.body.category,
				notes: req.body.notes,
			}
			const expense = await Expense.create(newExpense)

			return res.status(201).send(expense)
		} else {
			res.status(400).send({ message: "All fields are required!" })
		}
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.Expense })
	}
})

//Get all expenses
router.get("/", async (req, res) => {
	try {
		const expenses = await Expense.find({})
		return res.status(200).json({
			count: expenses.length,
			expenses: expenses,
		})
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

//Get an expense by ID
router.get("/:id", async (req, res) => {
	try {
		const { id } = req.params
		const expense = await Expense.findById(id)
		if (!expense) {
			return res.status(404).send({ message: "Expense not found" })
		}
		return res.status(200).json(expense)
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

//Update an expense with ID
router.put("/:id", async (req, res) => {
	try {
		if (
			!req.body.date ||
			!req.body.amount ||
			!req.body.vendor ||
			!req.body.account ||
			!req.body.category
		) {
			return res.status(400).send({ message: "All fields are required!" })
		}
		const { id } = req.params
		const result = await Expense.findByIdAndUpdate(id, req.body)
		if (!result) {
			return res.status(404).send({ message: "Expense not found" })
		}
		return res.status(200).send({ message: "Expense updated successfully!" })
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

//Delete an expense with ID
router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params
		const result = await Expense.findByIdAndDelete(id)
		if (!result) {
			return res.status(404).send({ message: "Expense not found" })
		}
		return res
			.status(200)
			.send({ _id: id, message: "Expense deleted successfully!" })
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

export default router
