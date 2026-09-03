import { getAuth } from "@clerk/express";

export const isLoggedIn = (req, res, next) => {
	const { userId } = getAuth(req);
	if (!userId) {
		return res.status(401).send({ message: "Not Logged In" });
	}
	req.userId = userId;
	next();
};
