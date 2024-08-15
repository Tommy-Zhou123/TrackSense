import express from "express"
import mongoose, { mongo } from "mongoose"
import cors from "cors"
import { isLoggedIn } from "./middleware.js"
import { PORT, mongoDbUrl, secret } from "./config.js"

import expenseRoute from "./routes/expenseRoute.js"
import loginRoute from "./routes/loginRoute.js"

import passport from "passport"
import session from "express-session"
import LocalStrategy from "passport-local"

import { User } from "./models/user.js"
import { Expense } from "./models/expense.js"

const app = express()

app.use(express.urlencoded({ extended: false }))
app.use(
	session({
		secret: secret,
		resave: false,
		saveUninitialized: true,
	})
)

const strategy = new LocalStrategy(User.authenticate())
passport.use(strategy)
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.use(passport.initialize())
app.use(passport.session())

app.use(express.json())

//middleware for handling CORS policy
app.use(cors())

app.use("/", loginRoute)
app.use("/expenses", expenseRoute)

mongoose
	.connect(mongoDbUrl)
	.then(() => {
		console.log("Connected to MongoDB!")

		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`)
		})
	})
	.catch((err) => {
		console.log(err)
	})

export default app