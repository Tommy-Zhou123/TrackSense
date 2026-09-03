import express from "express";
import { clerkClient } from "@clerk/express";
import { isLoggedIn } from "../middleware.js";

const router = express.Router();

router.get("/user", isLoggedIn, async (req, res) => {
	try {
		const user = await clerkClient.users.getUser(req.userId);
		return res.status(200).json({
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.primaryEmailAddress?.emailAddress ?? "",
		});
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
});

export default router;
