import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";

function ipKey(req) {
	return ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown", 56);
}

function clientKey(req) {
	try {
		const { userId } = getAuth(req);
		if (userId) return `user:${userId}`;
	} catch {
		// clerkMiddleware has not run yet
	}
	return ipKey(req);
}

const tooMany = (retryMinutes) => ({
	message: `Too many requests. Please try again in ${retryMinutes} minutes.`,
});

export const ipLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 120,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	keyGenerator: ipKey,
	message: tooMany(15),
});

export const userLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 80,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	keyGenerator: clientKey,
	message: tooMany(15),
});

export const writeLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	keyGenerator: clientKey,
	message: tooMany(15),
});

export const importLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	keyGenerator: clientKey,
	message: tooMany(15),
});

export const MAX_IMPORT_ROWS = 1000;

export function rejectBotlikeRequests(req, res, next) {
	const ua = req.get("user-agent");
	if (!ua || ua.trim().length < 12) {
		return res.status(403).send({ message: "Forbidden" });
	}

	if (
		["POST", "PUT", "PATCH"].includes(req.method) &&
		!req.is("application/json")
	) {
		return res
			.status(415)
			.send({ message: "Content-Type must be application/json" });
	}

	next();
}
