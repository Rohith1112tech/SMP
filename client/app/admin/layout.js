"use client";

import { useState } from "react";
import RoleGuard from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/admin/dashboard",   icon: "📊" },
  { label: "Teacher Section", href: "/admin/teachers",    icon: "👩" },
  { label: "Students",        href: "/admin/students",    icon: "🎒" },
  { label: "Student Record",  href: "/admin/student-record", icon: "📝" },
  { label: "Announcements",   href: "/admin/announcements", icon: "📢" },
  { label: "Classes",         href: "/admin/classes",     icon: "👥" },
  { label: "Subjects",        href: "/admin/subjects",    icon: "📖" },
];

function AdminShell({ children }) {
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Admin Settings states
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [updatingSettings, setUpdatingSettings] = useState(false);

  function openSettings() {
    setEmailInput(user?.auth_identifier || "");
    setPasswordInput("");
    setConfirmPasswordInput("");
    setSettingsModalOpen(true);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!emailInput.trim()) {
      showToast("Email is required", "warning");
      return;
    }
    if (passwordInput && passwordInput !== confirmPasswordInput) {
      showToast("Passwords do not match", "warning");
      return;
    }

    try {
      setUpdatingSettings(true);
      const payload = { email: emailInput.trim() };
      if (passwordInput) {
        payload.password = passwordInput;
      }
      
      await apiClient.put("/admin/profile", payload);
      
      updateUser({ auth_identifier: emailInput.trim() });
      showToast("Profile settings updated successfully", "success");
      setSettingsModalOpen(false);
    } catch (err) {
      showToast(err.data?.error || "Failed to update profile", "error");
    } finally {
      setUpdatingSettings(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-blue-900 flex flex-col flex-shrink-0 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-xl">🎓</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">
                SMP
              </h1>
              <p className="text-[10px] text-blue-300 font-medium uppercase tracking-widest">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-white/10 text-white border-l-4 border-white -ml-px"
                    : "text-blue-200 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-blue-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-sm font-bold text-white">
              {(user?.auth_identifier || "A").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.auth_identifier || "Admin"}
              </p>
              <p className="text-[11px] text-blue-300 truncate">
                Administrator
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={openSettings}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-blue-200 hover:text-white hover:bg-white/10 rounded-xl bg-white/5 transition-all duration-200"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-blue-200 hover:text-white hover:bg-white/10 rounded-xl bg-white/5 transition-all duration-200"
            >
              <span>↩️</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-6 h-6 text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-sm font-bold text-slate-900">SMP Admin</h1>
        </div>
        {children}
      </main>

      {/* Admin Settings Modal */}
      <Modal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title="Admin Settings">
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email Address / Login ID
            </label>
            <input
              type="email"
              required
              placeholder="admin@school.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              New Password (leave blank to keep current)
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPasswordInput}
              onChange={(e) => setConfirmPasswordInput(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingSettings}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              {updatingSettings ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <RoleGuard allowedRole="ADMIN">
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
