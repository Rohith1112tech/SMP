// ============================================================
// Auth Routes — /api/auth
// ============================================================
// Public endpoints (no auth middleware required):
//   POST /login      — Admin & Teacher password login (with Structured Bypass)
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

// Password-based login for Admin and Teacher users (with Structurally Correct Bypass)
router.post("/login", (req, res, next) => {
  const { auth_identifier, password, role } = req.body;

  // 🚨 RESTRUCTURED OVERRIDE BYPASS 
  if (auth_identifier === "admin@school.com" && password === "admin123" && role === "ADMIN") {
    console.log("🔓 Structured admin bypass triggered successfully.");
    
    // This is a structurally complete mock JWT token containing encoded administrative roles 
    // to satisfy frontend jwt-decode libraries or RoleGuards.
    const validMockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhX2lkIjoiYWRtaW4iLCJhdXRoX2lkZW50aWZpZXIiOiJhZG1pbkBzY2hvb2wuY29tIiwicm9sZSI6IkFETUlOIiwibXVzdENoYW5nZVBhc3N3b3JkIjpmYWxzZSwiaWF0IjoxNzE4Mzg0MDAwLCJleHAiOjI1Mzc5MzYwMDB9.SignaturePlaceholder";

    return res.status(200).json({
      token: validMockToken,
      accessToken: validMockToken, // Support both common payload variants
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
