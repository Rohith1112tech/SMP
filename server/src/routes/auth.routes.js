// ============================================================
// Auth Routes — /api/auth
// ============================================================
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "super-secure-school-secret-key";

router.post("/login", async (req, res) => {
  try {
    const { auth_identifier, password, role } = req.body;

    if (!auth_identifier || !password || !role) {
      return res.status(400).json({ error: "All login credentials are required" });
    }

    const cleanIdentifier = String(auth_identifier).trim();
    const cleanPassword = String(password).trim();

    // 1. Look up user record in db
    const user = await prisma.user.findUnique({
      where: { identifier: cleanIdentifier },
      include: { teacherProfile: true },
    });

    if (!user || user.role !== role) {
      return res.status(401).json({ error: "Invalid credentials or incorrect role dashboard selective choice" });
    }

    // 2. Verify hashed password
    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Generate a real structural JWT signed token payload
    const tokenPayload = {
      id: user.id,
      role: user.role,
      auth_identifier: user.role === "TEACHER" ? user.teacherProfile?.employeeId : user.identifier
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "1d" });

    // 4. Configure Cookies 
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000
    };

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        identifier: user.identifier,
        role: user.role,
        name: user.role === "TEACHER" ? user.teacherProfile?.name : "Administrator"
      }
    });

  } catch (error) {
    console.error("Login Engine Fault:", error);
    return res.status(500).json({ error: "Internal Server Authentication Fault occurred" });
  }
});

// Profile Session Check-In Route
router.get("/me", async (req, res) => {
  // Simple extraction block for session checks
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1] || req.cookies?.token;

  if (!token) return res.status(401).json({ error: "No active session found" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { teacherProfile: true }
    });

    if (!user) return res.status(404).json({ error: "User context not found" });

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        identifier: user.identifier,
        role: user.role,
        name: user.role === "TEACHER" ? user.teacherProfile?.name : "Admin"
      }
    });
  } catch {
    return res.status(401).json({ error: "Expired or malformed session validation token" });
  }
});

export default router;
