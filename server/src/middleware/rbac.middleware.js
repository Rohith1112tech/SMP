// ============================================================
// RBAC Middleware — Role-Based Access Control
// ============================================================
// Checks whether the authenticated user's role is among the
// allowed roles for a given route / router.
//
// Must be used AFTER requireAuth so that req.user is populated.
// ============================================================

/**
 * Higher-order middleware factory.
 * Returns an Express middleware that permits access only to
 * users whose role is included in the provided list.
 *
 * @param {...string} roles - One or more Role enum values (e.g. 'ADMIN', 'TEACHER')
 * @returns {Function} Express middleware
 *
 * @example
 *   // Allow only admins
 *   router.use(requireRole('ADMIN'));
 *
 *   // Allow admins and teachers
 *   router.use(requireRole('ADMIN', 'TEACHER'));
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    // req.user should already be set by requireAuth
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required before role check." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden. You do not have permission to access this resource.",
        requiredRoles: roles,
        yourRole: req.user.role,
      });
    }

    next();
  };
}
