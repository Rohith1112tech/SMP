"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RoleGuard({ children, allowedRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (user?.role?.toUpperCase() !== allowedRole?.toUpperCase()) {
      router.push("/login?error=unauthorized");
      return;
    }
  }, [user, loading, isAuthenticated, allowedRole, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/60 animate-spin-slow" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-b-white/30 animate-spin-slow" style={{ animationDirection: "reverse", animationDuration: "3s" }} />
          </div>
          <p className="text-sm text-slate-400 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated or wrong role
  if (!isAuthenticated || user?.role?.toUpperCase() !== allowedRole?.toUpperCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/60 animate-spin-slow" />
          <p className="text-sm text-slate-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
