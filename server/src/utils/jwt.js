// ============================================================
// JWT Utility — Token generation and verification helpers
// ============================================================
// Uses two separate secrets:
//   - JWT_SECRET        → short-lived access tokens (15 min)
//   - JWT_REFRESH_SECRET → long-lived refresh tokens (7 days)
// ============================================================

import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

/**
 * Generate a short-lived access token.
 * Payload includes user id, role, and auth_identifier so downstream
 * middleware / controllers can identify the user without a DB query.
 *
 * @param {object} user - User record from Prisma
 * @returns {string} Signed JWT (15-minute expiry)
 */
export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, auth_identifier: user.auth_identifier },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

/**
 * Generate a long-lived refresh token.
 * Contains only the minimum data needed to re-issue an access token.
 *
 * @param {object} user - User record from Prisma
 * @returns {string} Signed JWT (7-day expiry)
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Verify and decode an access token.
 *
 * @param {string} token - JWT string
 * @returns {object} Decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify and decode a refresh token.
 *
 * @param {string} token - JWT string
 * @returns {object} Decoded payload
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}
