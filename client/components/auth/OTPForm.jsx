"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function OTPForm() {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [timer, setTimer] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);
  const router = useRouter();
  const { sendOTP, verifyOTP } = useAuth();

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) {
      if (step === 2) setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, step]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");

    if (!mobile || mobile.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    try {
      const data = await sendOTP(mobile);
      // Store dev OTP if returned from API
      if (data?.otp) {
        setDevOtp(String(data.otp));
      } else if (data?.data?.otp) {
        setDevOtp(String(data.data.otp));
      }
      setStep(2);
      setTimer(300); // 5 minutes
      setCanResend(false);
      // Focus first OTP input after transition
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = useCallback((index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    setOtp((prev) => {
      const newOtp = [...prev];
      newOtp[index] = value;
      return newOtp;
    });

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleOtpKeyDown = useCallback((index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleOtpPaste = useCallback((e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  }, []);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(mobile, otpString);
      router.push("/parent/dashboard");
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setCanResend(false);
    setLoading(true);
    try {
      const data = await sendOTP(mobile);
      if (data?.otp) {
        setDevOtp(String(data.otp));
      } else if (data?.data?.otp) {
        setDevOtp(String(data.data.otp));
      }
      setTimer(300);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || "Failed to resend OTP.");
      setCanResend(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-enter">
      {step === 1 ? (
        /* Step 1: Mobile Number */
        <form onSubmit={handleSendOTP} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Mobile Number
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                +91
              </span>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setMobile(val);
                }}
                placeholder="Enter your mobile number"
                className="w-full pl-14 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                autoComplete="tel"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || mobile.length < 10}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-pink-600 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending OTP...
              </span>
            ) : (
              "Send OTP"
            )}
          </button>
        </form>
      ) : (
        /* Step 2: OTP Verification */
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          {/* Dev banner showing OTP */}
          {devOtp && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-amber-400 text-sm">🔑</span>
              <p className="text-sm text-amber-300">
                <span className="font-medium">Dev Mode:</span> OTP is{" "}
                <span className="font-mono font-bold tracking-wider">{devOtp}</span>
              </p>
            </div>
          )}

          <div>
            <p className="text-sm text-slate-400 mb-1">OTP sent to</p>
            <p className="text-white font-medium">
              +91 {mobile.slice(0, 3)}●●●●{mobile.slice(-3)}
            </p>
          </div>

          {/* OTP Input Boxes */}
          <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                className="otp-input"
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-center">
            {timer > 0 ? (
              <p className="text-sm text-slate-400">
                OTP expires in{" "}
                <span className="text-purple-400 font-mono font-medium">
                  {formatTime(timer)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-red-400">OTP has expired</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.join("").length !== 6}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              "Verify OTP"
            )}
          </button>

          {/* Resend & Back */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
                setOtp(["", "", "", "", "", ""]);
                setDevOtp("");
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Change Number
            </button>
            {canResend && (
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Resend OTP
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
