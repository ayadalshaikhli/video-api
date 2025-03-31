// server.js
import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

// Import your existing routes
import TestRoute from "./routes/TestRoute.js";
import videoRoutes from "./routes/videosRoute.js";
import syncRoute from "./routes/syncRoute.js";
import generateRouter from "./routes/generateRoute.js";
import uploadRoute from "./routes/uploadRoute.js";
import textToSpeechRoute from "./routes/textToSpeechRoute.js";
import speechToTextRoute from "./routes/speechToTextRoute.js";
import urlToVideoRoute from "./routes/urlToVideoRoute.js";
import videoToCaptionRoute from "./routes/videoToCaptionRoute.js";
// import lambdaVideoGenerationRoute from "./routes/lambdaVideoGenerationRoute.js";
// import instagramRoute from "./routes/instagramRoute.js";
// import subtitleStylesRoute from "./routes/subtitleStylesRoute.js";
import blogAutomationRoute from './routes/blogAutomationRoute.js';
import audioTranscriptionRoute from './routes/audioTranscriptionRoute.js';
import videoShortsRoute from "./routes/videoShortsRoute.js";
import authRoutes from "./routes/authRoute.js"; 
import audioRoute from "./routes/app/audioRoute.js";
import videooRoute from "./routes/app/videoRoute.js"; 

// Import the new conversion router
import convertRoute from "./routes/convertRoute.js";

const app = express();
const server = http.createServer(app);

// Allowed origins
const allowedOrigins = [
    "https://www.vairality.fun",
    "https://vairality.fun",
    'http://localhost:3000',
    'http://localhost:8082',
    'http://192.168.1.2:8082',
];

// const allowedOrigins = [
//     "https://www.vairality.fun",
//     "https://vairality.fun",
// ];


const restrictOriginMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    console.log(`[Middleware] Incoming request from origin: ${origin}`);
    
    if (!origin) {
        // Log but allow requests with no Origin header
        console.warn("[Middleware] No origin header present. Allowing request.");
        return next();
    }

    if (!allowedOrigins.includes(origin)) {
        console.error(`[Middleware] Access forbidden for origin: ${origin}`);
        return res.status(403).json({ error: "Access forbidden: Invalid origin." });
    }

    console.log(`[Middleware] Origin ${origin} is allowed.`);
    next();
};


const openCors = cors({ origin: "*" });
const restrictedCors = cors({ origin: allowedOrigins, credentials: true });

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Additional logging middleware
app.use((req, res, next) => {
    // console.log(`[Request] ${req.method} ${req.originalUrl}`);
    // console.log(`  Query: ${JSON.stringify(req.query)}`);
    // console.log(`  Headers: ${JSON.stringify(req.headers)}`);
    // console.log(`  Remote Address: ${req.ip}`);
    if (req.method !== "GET") {
        console.log(`  Body: ${JSON.stringify(req.body)}`);
    }
    next();
});

console.log("[Server] Registering routes...");
app.use("/api/auth", openCors, authRoutes);
app.use("/api/app/audio", openCors, audioRoute);
app.use("/api/app/video", openCors, videooRoute);

app.use("/api/generate", openCors, generateRouter);
app.use("/api/test-route", openCors, TestRoute);
app.use("/videos", openCors, videoRoutes);
app.use("/api/sync", restrictedCors, restrictOriginMiddleware, syncRoute);
app.use("/api/upload", restrictedCors, restrictOriginMiddleware, uploadRoute);
app.use("/api/text-to-speech", restrictedCors, restrictOriginMiddleware, textToSpeechRoute);
app.use("/api/speech-to-text", restrictedCors, restrictOriginMiddleware, speechToTextRoute);
app.use("/api/url-to-video", restrictedCors, restrictOriginMiddleware, urlToVideoRoute);
app.use("/api/tiktok/upload", restrictedCors, restrictOriginMiddleware, uploadRoute);
app.use("/api/tiktok/callback", openCors, syncRoute);
app.use("/api/video-caption", restrictedCors, restrictOriginMiddleware, videoToCaptionRoute);
app.use("/api/audio-text", restrictedCors, restrictOriginMiddleware, videoToCaptionRoute);
app.use('/api/blog-automation', restrictedCors, restrictOriginMiddleware, blogAutomationRoute);
app.use('/api/audio-transcription', restrictedCors, restrictOriginMiddleware, audioTranscriptionRoute);
app.use("/api/video-shorts", restrictedCors, restrictOriginMiddleware, videoShortsRoute);


// app.use("/api/lambda-video-generation", restrictedCors, restrictOriginMiddleware, lambdaVideoGenerationRoute);
// app.use("/api/instagram", openCors, instagramRoute);
// app.use("/api/convert", openCors, subtitleStylesRoute);


// New conversion route (you can decide if it should be open or restricted)
app.use("/api/convert", openCors, convertRoute);

// Error-handling middleware
app.use((err, req, res, next) => {
    // Handle multer file size limit error
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size should not exceed 5MB." });
    }
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
    res.send("you shell not pass");
});

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