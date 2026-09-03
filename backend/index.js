import express from "express";
import cors from "cors";
import helmet from "helmet";
import { clerkMiddleware } from "@clerk/express";
import { PORT, frontendUrl } from "./config.js";
import { ipLimiter, userLimiter, rejectBotlikeRequests } from "./lib/rateLimit.js";

import expenseRoute from "./routes/expenseRoute.js";
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
		origin: frontendUrl,
		credentials: true,
	})
);
app.use(rejectBotlikeRequests);
app.use(express.json({ limit: "1mb" }));
app.use("/api", ipLimiter);
app.use(
	clerkMiddleware({
		authorizedParties: [frontendUrl],
	})
);
app.use("/api", userLimiter);

app.use("/api", userRoute);
app.use("/api/expenses", expenseRoute);

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

export default app;
