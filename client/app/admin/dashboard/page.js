"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await apiClient.get("/admin/dashboard");
      setStats(data);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = stats
    ? [
        {
          label: "Total Students",
          value: stats.totalStudents,
          icon: "🎒",
          color: "bg-blue-100 text-blue-600",
          href: "/admin/students",
        },
        {
          label: "Total Teachers",
          value: stats.totalTeachers,
          icon: "👩",
          color: "bg-emerald-100 text-emerald-600",
          href: "/admin/teachers",
        },
        {
          label: "Total Subjects",
          value: stats.totalSubjects,
          icon: "📖",
          color: "bg-purple-100 text-purple-600",
          href: "/admin/subjects",
        },
        {
          label: "Total Classes",
          value: stats.totalClasses,
          icon: "👥",
          color: "bg-amber-100 text-amber-600",
          href: "/admin/classes",
        },
      ]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">
          Dashboard
        </h1>
        <p className="text-slate-500">
          Welcome back
          {user?.auth_identifier ? `, ${user.auth_identifier}` : ""}. Here&apos;s
          your school overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
                </div>
                <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ))
          : statCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group block"
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}
                  >
                    <span className="text-2xl">{card.icon}</span>
                  </div>
                  <svg
                    className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors mt-1"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1">
                  {card.value}
                </p>
                <p className="text-sm text-slate-500 group-hover:text-blue-600 transition-colors">{card.label}</p>
              </Link>
            ))}
      </div>

      {/* Quick Actions + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Add Teacher",
                href: "/admin/teachers",
                icon: "👤",
                color: "bg-blue-100 text-blue-600",
              },
              {
                label: "Add Student",
                href: "/admin/students",
                icon: "➕",
                color: "bg-emerald-100 text-emerald-600",
              },
              {
                label: "Announcements",
                href: "/admin/announcements",
                icon: "📢",
                color: "bg-purple-100 text-purple-600",
              },
              {
                label: "Manage Subjects",
                href: "/admin/subjects",
                icon: "📖",
                color: "bg-amber-100 text-amber-600",
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center group-hover:scale-105 transition-transform`}
                >
                  <span className="text-lg">{action.icon}</span>
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Teachers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Recent Teachers
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(stats?.recentTeachers || []).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    {(t.name || '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {t.name || '—'}
                    </p>
                    <p className="text-xs text-slate-500">{t.empId}</p>
                  </div>
                </div>
              ))}
              {(!stats?.recentTeachers ||
                stats.recentTeachers.length === 0) && (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No teachers yet
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
