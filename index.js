// server.js
import express from "express";
import cors from "cors";
import http from "http";
import cookieParser from "cookie-parser";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
dotenv.config();

// Import doctor app routes
import authRoutes from "./routes/authRoute.js";
import patientsRoutes from "./routes/patientsRoute.js";
import appointmentsRoutes from "./routes/appointmentsRoute.js";
import visitsRoutes from "./routes/visitsRoute.js";
import medicalRoutes from "./routes/medicalRoute.js";
import billingRoutes from "./routes/billingRoute.js";
import documentsRoutes from "./routes/documentsRoute.js";
import notificationsRoutes from "./routes/notificationsRoute.js";
import settingsRoutes from "./routes/settingsRoute.js";
import staffRoutes from "./routes/staffRoute.js";
import dashboardRoutes from "./routes/dashboardRoute.js";
import reportsRoutes from "./routes/reportsRoute.js";
import analyticsRoutes from "./routes/analyticsRoute.js";
import scheduleRoutes from "./routes/scheduleRoute.js";
import clinicsRoutes from "./routes/clinicsRoute.js";
import departmentsRoutes from "./routes/departmentsRoute.js";
import auditRoutes from "./routes/auditRoute.js";
import advancedReportsRoutes from "./routes/advancedReportsRoute.js";

// Import authentication middleware
import { requireAuth } from "./middleware/auth.js";

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:8082",
    "http://localhost:9469",
    "http://192.168.1.2:8082",
    "exp://192.168.1.2:8081", // For Expo development
    "exp://localhost:8081",
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Additional logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.log(`  Origin: ${req.headers.origin || 'No origin'}`);
    console.log(`  User-Agent: ${req.headers['user-agent']}`);
    console.log(`  IP: ${req.ip}`);
    if (req.method !== "GET" && Object.keys(req.body || {}).length > 0) {
        console.log(`  Body keys: ${Object.keys(req.body || {}).join(', ')}`);
    }
    next();
});

// Security logging middleware for tracking authentication status
app.use((req, res, next) => {
    const isAuthRoute = req.originalUrl.startsWith('/api/auth/');
    const isHealthCheck = req.originalUrl === '/health' || req.originalUrl === '/';
    
    if (!isAuthRoute && !isHealthCheck) {
        console.log(`[Security] ${req.method} ${req.originalUrl} - Cookie present: ${!!req.cookies?.session}`);
    }
    next();
});

console.log("[Server] Registering routes...");

// Doctor app routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/visits", visitsRoutes);
app.use("/api/medical", medicalRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/clinics", clinicsRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/advanced-reports", advancedReportsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
    console.log("[Health Check] Server health check requested");
    res.json({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        service: "Aubra Doctor App API"
    });
});

// Base route
app.get("/", (req, res) => {
    console.log("[Route] GET / - Base route accessed");
    console.log(`  Request from: ${req.ip}`);
    res.json({ 
        message: "Aubra Doctor App API", 
        version: "1.0.0",
        endpoints: {
            auth: "/api/auth",
            patients: "/api/patients", 
            appointments: "/api/appointments",
            medical: "/api/medical",
            billing: "/api/billing",
            documents: "/api/documents",
            notifications: "/api/notifications",
            settings: "/api/settings",
            staff: "/api/staff",
            dashboard: "/api/dashboard",
            clinics: "/api/clinics",
            departments: "/api/departments",
            audit: "/api/audit"
        }
    });
});

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error("[Error Handler] An error occurred:");
    console.error(`  Error: ${err.message}`);
    console.error(`  Stack: ${err.stack}`);
    console.error(`  Request URL: ${req.originalUrl}`);
    console.error(`  Request Method: ${req.method}`);
    
    // Handle specific error types
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size should not exceed 10MB." });
    }
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: "Invalid JSON in request body." });
    }
    
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: "CORS policy violation." });
    }
    
    res.status(500).json({ 
        error: "Internal server error",
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Handle 404 routes
app.use('*', (req, res) => {
    console.log(`[404] Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: "Route not found",
        availableEndpoints: [
            "GET /",
            "GET /health",
            "POST /api/auth/signin",
            "POST /api/auth/signup", 
            "GET /api/auth/session",
            "GET /api/patients",
            "GET /api/appointments",
            "GET /api/dashboard",
            "GET /api/medical/visits",
            "GET /api/billing/invoices",
            "GET /api/billing/payments",
            "GET /api/billing/services",
            "GET /api/reports",
            "GET /api/analytics",
            "GET /api/clinics",
            "GET /api/departments",
            "GET /api/audit/logs"
        ]
    });
});

console.log("[Socket.IO] Setting up Socket.IO...");
const io = new SocketIOServer(server, {
    cors: corsOptions
});

io.on("connection", (socket) => {
    console.log(`[Socket.IO] A user connected: ${socket.id}`);
    
    // Join clinic room for real-time updates
    socket.on('join-clinic', (clinicId) => {
        socket.join(`clinic-${clinicId}`);
        console.log(`[Socket.IO] User ${socket.id} joined clinic-${clinicId}`);
    });
    
    // Leave clinic room
    socket.on('leave-clinic', (clinicId) => {
        socket.leave(`clinic-${clinicId}`);
        console.log(`[Socket.IO] User ${socket.id} left clinic-${clinicId}`);
    });
    
    socket.on("disconnect", () => {
        console.log(`[Socket.IO] User disconnected: ${socket.id}`);
    });
});

// Export io for use in controllers if needed
export { io };

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[Server] Aubra Doctor App API server running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] CORS origins: ${allowedOrigins.join(', ')}`);
});