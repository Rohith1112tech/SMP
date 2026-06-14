// ============================================================
// Auth Routes — /api/auth
// ============================================================
// Public endpoints (no auth middleware required):
//   POST /login      — Admin & Teacher password login (with Admin Bypass)
//   POST /send-otp   — Request OTP for parent mobile
//   POST /verify-otp — Validate OTP and receive tokens
//   POST /refresh    — Exchange refresh token for new access token
// ============================================================

import { Router } from "express";
import {
  login,
  sendOTP,
  verifyOTPHandler,
  refreshToken,
  teacherResetPassword,
} from "../controllers/auth.controller.js";

const router = Router();

// Password-based login for Admin and Teacher users (with Emergency Admin Bypass)
router.post("/login", (req, res, next) => {
  const { auth_identifier, password, role } = req.body;

  // 🚨 EMERGENCY OVERRIDE BYPASS 
  // If you type these exact admin credentials on Netlify, log in immediately!
  if (auth_identifier === "admin@school.com" && password === "admin123" && role === "ADMIN") {
    console.log("🔓 Emergency admin bypass triggered successfully.");
    return res.status(200).json({
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJyb2xlIjoiQURNSU4ifQ", // Pre-baked token
      user: {
        auth_identifier: "admin@school.com",
        role: "ADMIN",
        mustChangePassword: false
      }
    });
  }

  // If credentials don't match the bypass, proceed normally to database authentication
  login(req, res, next);
});

// OTP flow for Parent users
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTPHandler);

// Password reset for Teacher using phone number
router.post("/teacher-reset-password", teacherResetPassword);

// Token refresh — issue a new access token using a valid refresh token
router.post("/refresh", refreshToken);

export default router;
