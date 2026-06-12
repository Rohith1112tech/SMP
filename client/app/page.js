"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated && user?.role) {
      const role = user.role.toLowerCase();
      router.push(`/${role}/dashboard`);
    } else {
      router.push("/login");
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 gradient-mesh">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo / Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <span className="text-3xl">🎓</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-20 blur-lg" />
        </div>

        {/* Loading spinner */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-400 animate-spin-slow" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-1">
            School Management Platform
          </h1>
          <p className="text-sm text-slate-400">Loading your experience...</p>
        </div>
      </div>
    </div>
  );
}
