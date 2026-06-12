"use client";

import { useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: "📊" },
  { label: "Attendance", href: "/teacher/attendance", icon: "✅" },
  { label: "Marks", href: "/teacher/marks", icon: "📝" },
];

function TeacherShell({ children }) {
  const { user, logout, updateUser } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword) {
      setError("New password is required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post("/teacher/change-password", { newPassword });
      // Update local storage and context
      updateUser({ mustChangePassword: false });
    } catch (err) {
      setError(err.data?.error || err.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.mustChangePassword === true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
        {/* Orbs background to match login */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl overflow-hidden p-8 animate-fade-in-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl mx-auto mb-4">
                <span className="text-3xl">🔒</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Create New Password</h2>
              <p className="text-xs text-slate-400">
                This is your first login. Please create a new secure password to access your dashboard.
              </p>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <span className="text-red-400 text-sm flex-shrink-0">⚠</span>
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                {submitting ? "Saving..." : "Save Password & Proceed"}
              </button>

              <button
                type="button"
                onClick={logout}
                className="w-full py-2.5 text-slate-400 hover:text-white text-xs transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-blue-900 flex flex-col flex-shrink-0 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-6 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">SMP</h1>
              <p className="text-[10px] text-blue-300 font-medium uppercase tracking-widest">Teacher Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/10 text-white border-l-4 border-white -ml-px"
                    : "text-blue-200 hover:text-white hover:bg-white/5"
                }`}>
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold text-white">
              {(user?.auth_identifier || "T").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.auth_identifier || "Teacher"}</p>
              <p className="text-[11px] text-blue-300 truncate">Faculty</p>
            </div>
          </div>
          <button onClick={logout}
            className="mt-2 w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-200 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200">
            <span>↩️</span><span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-h-screen">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-sm font-bold text-slate-900">SMP Teacher</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

export default function TeacherLayout({ children }) {
  return (
    <RoleGuard allowedRole="TEACHER">
      <TeacherShell>{children}</TeacherShell>
    </RoleGuard>
  );
}
