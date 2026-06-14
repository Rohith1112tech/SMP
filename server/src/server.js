// ============================================================
// Express Server Entry Point — School Management Platform
// ============================================================
// Bootstraps the Express application with:
//   - CORS (configured for React dev server & Production Netlify)
//   - JSON body parsing
//   - Root landing route & Health-check endpoint
//   - Auth, Admin, Teacher, and Parent route groups
//   - Global error handler
// ============================================================

import "dotenv/config"; // Load .env before anything else
import express from "express";
import cors from "cors";

// ── Route imports ──
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import parentRoutes from "./routes/parent.routes.js";

// ── Middleware imports ──
import { requireAuth } from "./middleware/auth.middleware.js";
import { requireRole } from "./middleware/rbac.middleware.js";

// ── Create Express app ──
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ──────────────────────────────────────

// Allowed origins for CORS (Development + Live Production)
const allowedOrigins = [
  "http://localhost:3000",
  "https://turbosmp.netlify.app" // 🚀 Your live frontend link
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, or curl) 
      // or if the origin is explicitly allowed
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Parse incoming JSON request bodies
app.use(express.json());

// ─── Base Routes ────────────────────────────────────────────

/**
 * GET /
 * Root endpoint to verify server is live via browser.
 */
app.get("/", (_req, res) => {
  res.json({
    status: "online",
    message: "Welcome to the School Management Platform API",
    healthCheck: "/api/health"
  });
});

/**
 * GET /api/health
 * Simple liveness probe — returns 200 if the server is running.
 */
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Route Mounting ─────────────────────────────────────────

// Public auth routes (login, OTP, refresh)
app.use("/api/auth", authRoutes);

// Protected admin routes — requires ADMIN role
app.use("/api/admin", requireAuth, requireRole("ADMIN"), adminRoutes);

// Protected teacher routes — requires TEACHER role
app.use("/api/teacher", requireAuth, requireRole("TEACHER"), teacherRoutes);

// Protected parent routes — requires PARENT role
app.use("/api/parent", requireAuth, requireRole("PARENT"), parentRoutes);

// ─── Global Error Handler ───────────────────────────────────

// Express 5 catches async errors automatically, but we still
// provide a safety-net error handler for unexpected issues.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ─── Start Server ───────────────────────────────────────────

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`🚀 SMP Server running on port ${PORT}`);
    console.log(`    Health check available at /api/health`);
  });
}

export default app;
