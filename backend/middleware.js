export const isLoggedIn = (req, res, next) => {
	if (!req.isAuthenticated()) {
		return res.status(500).send({ message: "Not Logged In" })
	}
	next()
}
