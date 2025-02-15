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
import textToSpeechRoute from "./routes/textToSpeechRoute.js";

const app = express();
const server = http.createServer(app);

// Define allowed origins for restricted routes
const allowedOrigins = [
  "https://www.vairality.fun",
  "https://vairality.fun",
  "http://localhost:3000",
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

// Set up CORS configurations
const openCors = cors({ origin: "*" });
const restrictedCors = cors({ origin: allowedOrigins, credentials: true });

// Use built-in middleware to parse JSON, URL-encoded bodies, and cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Additional logging middleware: log method, URL, query, headers, and remote IP
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.originalUrl}`);
  console.log(`  Query: ${JSON.stringify(req.query)}`);
  console.log(`  Headers: ${JSON.stringify(req.headers)}`);
  console.log(`  Remote Address: ${req.ip}`);
  // Optionally log body (be cautious with sensitive info)
  if (req.method !== "GET") {
    console.log(`  Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

console.log("[Server] Registering routes...");
app.use("/api/generate", openCors, generateRouter);
app.use("/api/v1/test-route", restrictedCors, restrictOriginMiddleware, TestRoute);
app.use("/videos", openCors, videoRoutes);
app.use("/api/sync", restrictedCors, restrictOriginMiddleware, syncRoute);
app.use("/api/upload", restrictedCors, restrictOriginMiddleware, uploadRoute);
app.use("/api/text-to-speech", restrictedCors, restrictOriginMiddleware, textToSpeechRoute);

// Error-handling middleware with extra logging
app.use((err, req, res, next) => {
  console.error("[Error Handler] An error occurred:");
  console.error(`  Error: ${err.message}`);
  console.error(`  Stack: ${err.stack}`);
  console.error(`  Request URL: ${req.originalUrl}`);
  res.status(500).send("Something broke!");
});

// Base route
app.get("/", (req, res) => {
  console.log("[Route] GET /");
  console.log(`  Request from: ${req.ip}`);
  res.send("Hello from Express with Puppeteer");
});

// Set up Socket.IO with CORS configuration and extra logging
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
