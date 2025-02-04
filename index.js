// server.js
import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";

// Import routes
import TestRoute from "./routes/TestRoute.js";
import videoRoutes from "./routes/videosRoute.js";

puppeteer.use(StealthPlugin());
dotenv.config();

const app = express();
const server = http.createServer(app);

export const io = new SocketIOServer(server, {
    cors: {
        origin: "https://www.vairality.fun",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const PORT = process.env.PORT || 3001;
const corsOptions = {
    origin: "https://www.vairality.fun",
    credentials: true
};

app.use(express.json());
app.use(cors(corsOptions));

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
});

// Root endpoint
app.get("/", (req, res) => {
    res.send("Hello from Express with Puppeteer");
});

// Use test route
app.use("/api/v1/test-route", TestRoute);

// Use video routes
app.use("/videos", videoRoutes);

// Socket.io connection
io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

console.log("Starting server...");
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
console.log("Server listen command issued.");
