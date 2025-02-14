// server.js
import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser"; // <--- Added cookie-parser import
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

// Import your existing routes
import TestRoute from "./routes/TestRoute.js";
import videoRoutes from "./routes/videosRoute.js";
import syncRoute from "./routes/syncRoute.js";
import generateRouter from "./routes/generateRoute.js";

// Import the upload route we created
import uploadRoute from "./routes/uploadRoute.js";

const app = express();
const server = http.createServer(app);

// Define allowed origins for restricted routes
const allowedOrigins = [
    "https://www.vairality.fun",
    "https://vairality.fun",
];

// Middleware to restrict origins
const restrictOriginMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    console.log(`[Middleware] Incoming request from origin: ${origin}`);
    if (!origin || !allowedOrigins.includes(origin)) {
        console.error(`[Middleware] Access forbidden for origin: ${origin}`);
        return res.status(403).json({ error: "Access forbidden: Invalid origin." });
    }
    console.log(`[Middleware] Origin ${origin} is allowed.`);
    next();
};

const openCors = cors({ origin: "*" });
const restrictedCors = cors({ origin: allowedOrigins, credentials: true });

// Enable parsing of JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ** Add cookie-parser middleware **
app.use(cookieParser());

// Log every incoming request for debugging
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.originalUrl}`);
    next();
});

// Register your routes
console.log("[Server] Registering routes...");
app.use("/api/generate", openCors, generateRouter);
app.use("/api/v1/test-route", restrictedCors, restrictOriginMiddleware, TestRoute);
app.use("/videos", openCors, videoRoutes);
app.use("/api/sync", restrictedCors, restrictOriginMiddleware, syncRoute);
app.use("/api/upload", restrictedCors, restrictOriginMiddleware, uploadRoute);

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error("[Error Handler]", err.stack);
    res.status(500).send("Something broke!");
});

// Base route
app.get("/", (req, res) => {
    console.log("[Route] GET /");
    res.send("Hello from Express with Puppeteer");
});

// Set up Socket.IO with CORS configuration
console.log("[Socket.IO] Setting up Socket.IO...");
const io = new SocketIOServer(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

io.on("connection", (socket) => {
    console.log(`[Socket.IO] A user connected: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[Server] Server running on port ${PORT}`);
});
