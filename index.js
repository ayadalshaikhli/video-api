// server.js
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

import TestRoute from "./routes/TestRoute.js";
import videoRoutes from "./routes/videosRoute.js";
import syncRoute from "./routes/syncRoute.js";
import generateRouter from "./routes/generateRoute.js";

const app = express();
const server = http.createServer(app);

// Define your allowed origin for restricted routes
const allowedOrigins = ["https://www.vairality.fun", "https://vairality.fun"];

const restrictOriginMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: "Access forbidden: Invalid origin." });
    }
    next();
};

const openCors = cors({ origin: "*" });
const restrictedCors = cors({ origin: allowedOrigins, credentials: true });

app.use(express.json());


app.use("/api/generate", openCors, generateRouter);
app.use("/api/v1/test-route", restrictedCors, restrictOriginMiddleware, TestRoute);
app.use("/videos", openCors, videoRoutes);
app.use("/api/sync", restrictedCors, restrictOriginMiddleware, syncRoute);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
});

app.get("/", (req, res) => {
    res.send("Hello from Express with Puppeteer");
});

const io = new SocketIOServer(server, {
    cors: {
        origin: allowedOrigin,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
