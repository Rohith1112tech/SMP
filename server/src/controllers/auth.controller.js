// ============================================================
// Auth Controller — Login, OTP, and Token Refresh handlers
// ============================================================
// Handles three authentication flows:
//   1. Admin / Teacher → email/empId + password
//   2. Parent          → mobile + OTP (passwordless)
//   3. Token refresh   → exchange refresh token for new access token
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import { generateOTP, verifyOTP } from "../utils/otp.js";

const prisma = new PrismaClient();

// ─── 1. Admin & Teacher Login ───────────────────────────────

/**
 * POST /api/auth/login
 * Body: { auth_identifier, password, role }
 *
 * Authenticates Admin and Teacher users via password.
 * Parents should use the OTP flow instead.
 */
export async function login(req, res) {
  try {
    const { auth_identifier, password, role } = req.body;

    // ── Input validation ──
    if (!auth_identifier || !password || !role) {
      return res
        .status(400)
        .json({ error: "auth_identifier, password, and role are required." });
    }

    if (!["ADMIN", "TEACHER"].includes(role)) {
      return res
        .status(400)
        .json({ error: "This endpoint supports ADMIN and TEACHER roles only. Parents should use /send-otp." });
    }

    // ── Find the user ──
    const user = await prisma.user.findFirst({
      where: { auth_identifier, role },
      include: {
        teacher: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // ── Verify password ──
    if (!user.password_hash) {
      return res.status(401).json({ error: "Password login is not configured for this account." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // ── Issue tokens ──
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        auth_identifier: user.auth_identifier,
        mustChangePassword: user.teacher ? user.teacher.mustChangePassword : false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// ─── 2. Parent OTP — Request ────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Body: { mobile }
 *
 * Generates and returns an OTP for the parent's mobile number.
 * In production the OTP would be sent via SMS; here it is
 * returned in the response for development / testing purposes.
 */
export async function sendOTP(req, res) {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: "Mobile number is required." });
    }

    // ── Verify the parent exists ──
    const user = await prisma.user.findFirst({
      where: { auth_identifier: mobile, role: "PARENT" },
    });

    if (!user) {
      return res
        .status(404)
        .json({ error: "No parent account found with this mobile number." });
    }

    // ── Generate and (in dev) return the OTP ──
    const otp = generateOTP(mobile);

    return res.json({
      message: "OTP sent successfully",
      otp, // Included for dev/testing — remove in production!
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// ─── 3. Parent OTP — Verify ────────────────────────────────

/**
 * POST /api/auth/verify-otp
 * Body: { mobile, otp }
 *
 * Validates the OTP and issues access + refresh tokens if correct.
 */
export async function verifyOTPHandler(req, res) {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ error: "Mobile number and OTP are required." });
    }

    // ── Check the OTP ──
    const isValid = verifyOTP(mobile, otp);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    // ── Find the parent user ──
    const user = await prisma.user.findFirst({
      where: { auth_identifier: mobile, role: "PARENT" },
    });

    if (!user) {
      return res
        .status(404)
        .json({ error: "No parent account found with this mobile number." });
    }

    // ── Issue tokens ──
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        auth_identifier: user.auth_identifier,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// ─── 4. Refresh Token ──────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }
 *
 * Accepts a valid refresh token and returns a new access token.
 * This allows the client to maintain sessions without re-login.
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Refresh token is required." });
    }

    // ── Verify the refresh token ──
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    // ── Look up the user to get current data for the new access token ──
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    // ── Issue a fresh access token ──
    const accessToken = generateAccessToken(user);

    return res.json({ accessToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}

// ─── 5. Teacher Password Reset ────────────────────────────────

/**
 * POST /api/auth/teacher-reset-password
 * Body: { empId, phone, newPassword }
 *
 * Resets a teacher's password using their employee ID and registered phone number.
 */
export async function teacherResetPassword(req, res) {
  try {
    const { empId, phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ error: "Phone number and new password are required." });
    }

    const whereClause = { phone };
    if (empId) {
      whereClause.empId = empId;
    }

    const teacher = await prisma.teacher.findFirst({
      where: whereClause,
      include: { user: true },
    });

    if (!teacher) {
      return res.status(404).json({ error: "No teacher account found matching the details provided." });
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update user password and set mustChangePassword to false
    await prisma.$transaction([
      prisma.user.update({
        where: { id: teacher.userId },
        data: { password_hash },
      }),
      prisma.teacher.update({
        where: { id: teacher.id },
        data: { mustChangePassword: false },
      }),
    ]);

    return res.json({ message: "Password reset successfully. You can now login with your new password." });
  } catch (error) {
    console.error("Teacher reset password error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
}
