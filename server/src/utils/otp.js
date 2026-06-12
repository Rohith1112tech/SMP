// ============================================================
// OTP Utility — In-memory one-time password store
// ============================================================
// For production, replace this with Redis or a similar store.
// The in-memory Map is sufficient for development / demo use.
// ============================================================

/** @type {Map<string, { code: string, expiresAt: number, timerId: NodeJS.Timeout }>} */
const otpStore = new Map();

/** OTP validity duration in milliseconds (5 minutes) */
const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a random 6-digit OTP for the given mobile number.
 * If an existing OTP is present for the same mobile, it is
 * overwritten (and its cleanup timer is cleared).
 *
 * @param {string} mobile - The parent's mobile number
 * @returns {string} The generated 6-digit OTP code
 */
export function generateOTP(mobile) {
  // Clear any previous OTP & timer for this mobile
  if (otpStore.has(mobile)) {
    clearTimeout(otpStore.get(mobile).timerId);
  }

  // Generate a random 6-digit code, zero-padded
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  // Schedule automatic cleanup after TTL
  const timerId = setTimeout(() => {
    otpStore.delete(mobile);
  }, OTP_TTL_MS);

  otpStore.set(mobile, { code, expiresAt, timerId });

  return code;
}

/**
 * Verify the OTP supplied by the user.
 * On successful verification the OTP is consumed (deleted).
 *
 * @param {string} mobile - The parent's mobile number
 * @param {string} otp    - The OTP code to verify
 * @returns {boolean} true if the OTP is valid and not expired
 */
export function verifyOTP(mobile, otp) {
  const entry = otpStore.get(mobile);

  if (!entry) {
    return false; // No OTP was generated for this mobile
  }

  if (Date.now() > entry.expiresAt) {
    // Expired — clean up immediately
    clearTimeout(entry.timerId);
    otpStore.delete(mobile);
    return false;
  }

  if (entry.code !== otp) {
    return false; // Code mismatch
  }

  // Valid — consume the OTP so it cannot be reused
  clearTimeout(entry.timerId);
  otpStore.delete(mobile);
  return true;
}
