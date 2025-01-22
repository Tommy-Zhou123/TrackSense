import mongoose from "mongoose"
const Schema = mongoose.Schema

const expenseSchema = new Schema({
	date: Date,
	account: String,
	vendor: String,
	category: String,
	amount: Number,
	notes: String,
	user: Schema.Types.ObjectId,
})

export const Expense = mongoose.model("Expense", expenseSchema)
