"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // On mount, restore auth state from localStorage
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      if (token && storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error("Failed to restore auth state:", err);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  // 🚀 FIXED: Now safely accepts the unified payload sent from LoginForm
  const login = useCallback(async (payload) => {
    const endpoint = "/auth/login";

    // Debug log to ensure the data reaching the client pipeline is structured correctly
    console.log("Submitting Auth Payload to Client:", payload);

    const data = await apiClient.post(endpoint, payload);

    const userData = data.user || data.data?.user || data;
    const token = data.accessToken || data.token || data.data?.accessToken || data.data?.token;

    if (token) {
      localStorage.setItem("token", token);
      if (typeof window !== "undefined") {
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }
    }

    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }

    const userToStore = {
      ...userData,
      role: userData.role || payload.role,
    };

    localStorage.setItem("user", JSON.stringify(userToStore));
    setUser(userToStore);
    setIsAuthenticated(true);

    return data;
  }, []);

  // Send OTP for parent login
  const sendOTP = useCallback(async (mobile) => {
    const data = await apiClient.post("/auth/send-otp", { mobile });
    return data;
  }, []);

  // Verify OTP for parent login
  const verifyOTP = useCallback(async (mobile, otp) => {
    const data = await apiClient.post("/auth/verify-otp", { mobile, otp });

    const userData = data.user || data.data?.user || data;
    const token = data.accessToken || data.token || data.data?.accessToken || data.data?.token;

    if (token) {
      localStorage.setItem("token", token);
      if (typeof window !== "undefined") {
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
      }
    }

    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }

    const userToStore = {
      ...userData,
      role: userData.role || "PARENT",
    };

    localStorage.setItem("user", JSON.stringify(userToStore));
    setUser(userToStore);
    setIsAuthenticated(true);

    return data;
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("refreshToken");
    if (typeof window !== "undefined") {
      document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    setUser(null);
    setIsAuthenticated(false);
    router.push("/login");
  }, [router]);

  // Get current user
  const getUser = useCallback(() => {
    return user;
  }, [user]);

  // Update user details locally and in localStorage
  const updateUser = useCallback((newData) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...newData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    sendOTP,
    verifyOTP,
    logout,
    getUser,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
