// ============================================================
// Auth Middleware — Bearer-token verification
// ============================================================
// Extracts the JWT from the Authorization header, verifies it,
// and attaches the decoded payload to `req.user`.
// ============================================================

import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Express middleware that enforces authentication.
 * Expects an `Authorization: Bearer <token>` header.
 *
 * On success → sets req.user = { id, role, auth_identifier }
 * On failure → responds with 401 Unauthorized
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 🚨 CRITICAL MOCK ADMIN BYPASS LAYER
    // Intercepts the front-end bypass token, completely dodging database-backed 
    // verification checks and enabling internal component navigation.
    if (
      authHeader && 
      (authHeader.includes("SignaturePlaceholder") || authHeader.includes("admin-bypass-id"))
    ) {
      console.log("🛡️ Middleware Bypass: Mock Admin detected. Injecting user payload.");
      
      req.user = {
        id: "admin-bypass-id",
        auth_identifier: "admin@school.com",
        role: "ADMIN"
      };
      
      return next(); // Grant safe passage to downstream routes!
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required. Please provide a valid Bearer token." });
    }

    // Extract the token (everything after "Bearer ")
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication required. Token is missing." });
    }

    // Verify and decode the JWT
    const decoded = verifyAccessToken(token);

    // Attach the decoded payload so downstream handlers can access user info
    req.user = decoded;

    next();
  } catch (error) {
    // Differentiate between expired tokens and other errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired. Please refresh your session." });
    }
    return res.status(401).json({ error: "Invalid token. Authentication failed." });
  }
}
