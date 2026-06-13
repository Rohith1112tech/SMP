"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

export default function ParentDashboard() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [dashboardRes, announcementsRes] = await Promise.all([
          apiClient.get("/parent/dashboard"),
          apiClient.get("/parent/announcements"),
        ]);
        setData(dashboardRes);
        setAnnouncements(announcementsRes || []);
      } catch (err) {
        showToast(err.data?.error || "Failed to load dashboard", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">My Children</h1>
        <p className="text-slate-500">View your children&apos;s academic progress and attendance.</p>
      </div>

      {/* Notice Board */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span>📢</span> Notice Board
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center">No announcements at this time.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:border-blue-200 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm sm:text-base">{ann.title}</h3>
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md font-medium whitespace-nowrap">
                    {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{ann.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-slate-100 animate-pulse" />
                <div>
                  <div className="h-5 w-32 bg-slate-100 rounded-lg animate-pulse mb-2" />
                  <div className="h-4 w-20 bg-slate-100 rounded-lg animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : data?.children?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <span className="text-5xl mb-4 block">👶</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Children Found</h3>
          <p className="text-slate-500">No students are linked to your mobile number yet. Please contact the school admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data?.children?.map((child) => (
            <div key={child.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Child Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                    {(child.name || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{child.name || '—'}</h3>
                    <p className="text-sm text-slate-500">Class: {child.className}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 rounded-xl bg-emerald-50">
                    <p className="text-2xl font-bold text-emerald-700">
                      {child.attendanceSummary?.percentage != null
                        ? `${Number(child.attendanceSummary.percentage).toFixed(1)}%`
                        : "—"}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Attendance</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-blue-50">
                    <p className="text-2xl font-bold text-blue-700">
                      {child.attendanceSummary?.present ?? 0}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Days Present</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-purple-50">
                    <p className="text-2xl font-bold text-purple-700">
                      {child.marksCount ?? 0}
                    </p>
                    <p className="text-xs text-purple-600 mt-1">Exams Taken</p>
                  </div>
                </div>

                {/* Action Links */}
                <div className="flex gap-3">
                  <Link href={`/parent/attendance?child=${child.id}`}
                    className="flex-1 text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
                    📅 Attendance
                  </Link>
                  <Link href={`/parent/marks?child=${child.id}`}
                    className="flex-1 text-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors">
                    📝 Marks
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
