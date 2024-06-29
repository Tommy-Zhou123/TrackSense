import express from "express"
import mongoose from "mongoose"
import { PORT, mongoDbUrl } from "./config.js"
import expenseRoute from "./routes/expenseRoute.js"
import cors from "cors"

const app = express()

app.use(express.json())

//middleware for handling CORS policy
app.use(cors())

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
