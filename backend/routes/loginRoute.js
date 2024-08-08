import express from "express"
import passport from "passport"
import { User } from "../models/user.js"
import { Expense } from "../models/expense.js"

const router = express.Router()

router.post("/register", function (req, res) {
	User.register(
		new User({
			email: req.body.email,
			username: req.body.username,
		}),
		req.body.password,
		function (err, msg) {
			if (err) {
				res.send(err)
			} else {
				res.send({ message: "Successful" })
			}
		}
	)
})

router.post(
	"/login",
	passport.authenticate("local", {
		failureRedirect: "/login-failure",
		successRedirect: "/login-success",
	}),
	(err, req, res, next) => {
		if (err) next(err)
	}
)

router.get("/login-failure", (req, res, next) => {
	res.send("Login Attempt Failed.")
})

router.get("/login-success", (req, res, next) => {
	res.send("Login Attempt was successful.")
})

router.get("/user/:id", async (req, res) => {
	try {
		const { id } = req.params
		const user = await Expense.findById(id)
		if (!user) {
			return res.status(404).send({ message: "User not found" })
		}
		return res.status(200).json(user)
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

export default router
