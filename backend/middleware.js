import { getAuth } from "@clerk/express";
import { isUuid, loadActiveMembership } from "./lib/profile.js";

export const isLoggedIn = (req, res, next) => {
	const { userId } = getAuth(req);
	if (!userId) {
		return res.status(401).send({ message: "Not Logged In" });
	}
	req.userId = userId;
	next();
};

export const requireProfile = async (req, res, next) => {
	try {
		const profileId = req.get("x-profile-id");
		if (!isUuid(profileId)) {
			return res.status(400).send({ message: "Profile is required" });
		}
		const membership = await loadActiveMembership(req.userId, profileId);
		if (!membership) {
			return res
				.status(403)
				.send({ message: "You do not have access to this profile" });
		}
		req.profileId = profileId;
		req.profileRole = membership.role;
		req.profileMemberId = membership.id;
		next();
	} catch (err) {
		console.log(err.message);
		res.status(500).send({ message: err.message });
	}
};

export const requireProfileWrite = (req, res, next) => {
	if (req.profileRole === "viewer") {
		return res.status(403).send({ message: "Viewers cannot make changes" });
	}
	next();
};
