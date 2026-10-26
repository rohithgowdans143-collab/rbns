
"use strict";

require("dotenv").config();
require("dns").setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Validate required environment settings
if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.startsWith("REPLACE_")
) {
    throw new Error("Set a strong JWT_SECRET in your .env file.");
}

if (!process.env.FRONTEND_ORIGIN) {
    throw new Error("Set FRONTEND_ORIGIN in your .env file.");
}



app.disable("x-powered-by");

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

// API health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "MicroLoanX API"
    });
});

// Authentication rate limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Too many authentication attempts. Please try again later."
    }
});

// AI rate limiter
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Too many AI requests. Please try again later."
    }
});

// Register routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);
app.use("/api/loans", require("./routes/loan"));

// Handle unknown endpoints
app.use((req, res) => {
    res.status(404).json({
        message: "API endpoint not found."
    });
});

// Central error handler
app.use((error, req, res, next) => {
    console.error("API error:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        message: "A server error occurred. Please try again."
    });
});

// Start server
async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`MicroLoanX API running on port ${PORT}`);
    });
}

startServer().catch(error => {
    console.error("Unable to start server:", error.message);
    process.exit(1);
});
