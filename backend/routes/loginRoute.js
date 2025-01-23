import express from "express"
import passport from "passport"
import { User } from "../models/user.js"
import { Expense } from "../models/expense.js"

const router = express.Router()

router.post("/register", function (req, res) {
	User.register(
		new User({
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
		}),
		req.body.password,
		function (err, msg) {
			if (err) {
				res.send({ message: err })
			} else {
				res.send({ message: "Successfully Registered" })
			}
		}
	)
})

router.post("/login", passport.authenticate("local"), (err, req, res, next) => {
	if (err) next("Login Failed")
})

router.get("/login-failure", (req, res, next) => {
	res.status(404).statusMessage("Login Attempt Failed.")
})

router.get("/login-success", (req, res, next) => {
	res.status(200).send("Login Attempt was successful.")
})

router.get("/user", async (req, res) => {
	try {
		let user = req?.user
		if (!user) {
			return res.status(404).send({ message: "User not found" })
		}
		return res.status(200).json(user)
	} catch (err) {
		console.log(err.message)
		res.status(500).send({ message: err.message })
	}
})

router.post(
	"/login",
	passport.authenticate("local", {
		keepSessionInfo: true,
		failureRedirect: "/login-failure",
		successRedirect: "/login-success",
	}),
	(err, req, res, next) => {
		if (err) next(err)
	}
)

router.post("/logout", function (req, res, next) {
	req.logout(function (err) {
		if (err) {
			return next(err)
		}
		return res.status(200).send({ message: "Logged out" })
	})
})

export default router
