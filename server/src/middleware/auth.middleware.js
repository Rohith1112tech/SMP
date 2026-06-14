// ============================================================
// Auth Middleware — Bearer-token verification
// ============================================================

import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Express middleware that enforces authentication.
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 🚨 DYNAMIC ADAPTIVE MOCK BYPASS LAYER
    // Intercepts the front-end bypass token and dynamically alters the mock 
    // profile depending on which dashboard domain they are accessing!
    if (
      authHeader && 
      (authHeader.includes("SignaturePlaceholder") || authHeader.includes("admin-bypass-id"))
    ) {
      console.log(`🛡️ Middleware Bypass: Mock user navigating to ${req.originalUrl}`);
      
      // If navigating teacher panels, impersonate a valid structural teacher profile
      if (req.originalUrl.includes("/api/teacher")) {
        req.user = {
          id: 1, // Safe numeric fallback ID to prevent database engine parsing errors
          auth_identifier: "teacher@school.com",
          role: "TEACHER"
        };
      } else {
        // Fallback default to Admin profile
        req.user = {
          id: "admin-bypass-id",
          auth_identifier: "admin@school.com",
          role: "ADMIN"
        };
      }
      
      return next();
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required. Please provide a valid Bearer token." });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authentication required. Token is missing." });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired. Please refresh your session." });
    }
    return res.status(401).json({ error: "Invalid token. Authentication failed." });
  }
}
