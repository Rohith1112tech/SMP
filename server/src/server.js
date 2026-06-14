// ============================================================
// Express Server Entry Point — School Management Platform
// ============================================================
// Bootstraps the Express application with:
//   - CORS (configured for React dev server & Production Netlify)
//   - JSON body parsing
//   - Root landing route & Health-check endpoint
//   - Auth, Admin, Teacher, and Parent route groups
//   - Automatic initial admin database bootstrapper
//   - Global error handler
// ============================================================

import "dotenv/config"; // Load .env before anything else
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";

// ── Route imports ──
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import parentRoutes from "./routes/parent.routes.js";

// ── Middleware imports ──
import { requireAuth } from "./middleware/auth.middleware.js";
import { requireRole } from "./middleware/rbac.middleware.js";

// ── Database / Model Import ──
// NOTE: If you use a different ORM or database helper (like Prisma, mongoose, or raw pg/knex),
// replace or adjust this import path to point to your User model or db helper.
import { User } from "./models/user.model.js"; 

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
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"], // Added explicitly for JWT tokens
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

// ─── Automatic Database Admin Seeder ────────────────────────

/**
 * Automatically runs on startup. Checks if any ADMIN users exist; 
 * if none are found, creates a baseline account to prevent login lockouts.
 */
async function bootstrapAdmin() {
  try {
    // 1. Verify db connection/model is active before executing query
    if (User && typeof User.findOne === "function") {
      const adminExists = await User.findOne({ role: "ADMIN" });
      
      if (!adminExists) {
        console.log("ℹ️ No admin account detected. Seeding fallback admin account...");
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        await User.create({
          auth_identifier: "admin@school.com",
          password: hashedPassword,
          role: "ADMIN",
          mustChangePassword: false, // Prevents forced loop blocks on first boot
        });
        
        console.log("✅ Default admin user successfully seeded!");
        console.log("👉 Identifier: admin@school.com | Password: admin123");
      } else {
        console.log("ℹ️ Database check: Admin account configuration exists.");
      }
    }
  } catch (err) {
    console.error("⚠️ Database auto-seeder skipped or encountered an error:", err.message);
  }
}

// ─── Start Server ───────────────────────────────────────────

// Binding explicitly to host "0.0.0.0" so cloud platforms (Render) can discover the port
if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 SMP Server securely running on port ${PORT} and bound to 0.0.0.0`);
    console.log(`   Health check available at /api/health`);
    
    // Execute database seed assessment immediately following successful port binding
    await bootstrapAdmin();
  });
}

export default app;
