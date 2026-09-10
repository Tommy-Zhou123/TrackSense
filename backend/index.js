import express from "express";
import cors from "cors";
import helmet from "helmet";
import { clerkMiddleware } from "@clerk/express";
import { PORT, frontendOrigins } from "./config.js";
import { ipLimiter, userLimiter, rejectBotlikeRequests } from "./lib/rateLimit.js";

import expenseRoute from "./routes/expenseRoute.js";
import vendorRuleRoute from "./routes/vendorRuleRoute.js";
import overarchingCategoryRoute from "./routes/overarchingCategoryRoute.js";
import profileRoute from "./routes/profileRoute.js";
import userRoute from "./routes/userRoute.js";

const app = express();

app.set("trust proxy", 1);
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" },
	})
);
app.use(
	cors({
		origin: frontendOrigins,
		credentials: true,
	})
);
app.use(rejectBotlikeRequests);
app.use(express.json({ limit: "1mb" }));
app.use("/api", ipLimiter);
app.use(
	clerkMiddleware({
		authorizedParties: frontendOrigins,
	})
);
app.use("/api", userLimiter);

app.use("/api", userRoute);
app.use("/api/profiles", profileRoute);
app.use("/api/expenses", expenseRoute);
app.use("/api/vendor-rules", vendorRuleRoute);
app.use("/api/overarching-categories", overarchingCategoryRoute);
app.use("/api/category-groups", overarchingCategoryRoute);

if (!process.env.VERCEL) {
	app.listen(PORT, () => {
		console.log(`Server is running on port ${PORT}`);
	});
}

export default app;
