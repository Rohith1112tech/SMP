"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

export default function TeacherDashboard() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [dashboardRes, announcementsRes] = await Promise.all([
          apiClient.get("/teacher/dashboard"),
          apiClient.get("/teacher/announcements"),
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

  const uniqueClasses = data?.assignments
    ? [...new Set(data.assignments.map((a) => a.className))]
    : [];
  const uniqueSubjects = data?.assignments
    ? [...new Map(data.assignments.map((a) => [a.subject.id, a.subject])).values()]
    : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-slate-500">
          Welcome{data?.teacher?.name ? `, ${data.teacher.name}` : ""}. Here are your assignments.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="h-12 w-12 bg-slate-100 rounded-xl animate-pulse mb-4" />
              <div className="h-8 w-16 bg-slate-100 rounded-lg animate-pulse mb-2" />
              <div className="h-4 w-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4"><span className="text-2xl">🏫</span></div>
              <p className="text-3xl font-bold text-slate-900 mb-1">{uniqueClasses.length}</p>
              <p className="text-sm text-slate-500">Assigned Classes</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4"><span className="text-2xl">📖</span></div>
              <p className="text-3xl font-bold text-slate-900 mb-1">{uniqueSubjects.length}</p>
              <p className="text-sm text-slate-500">Subjects Teaching</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4"><span className="text-2xl">📋</span></div>
              <p className="text-3xl font-bold text-slate-900 mb-1">{data?.assignments?.length || 0}</p>
              <p className="text-sm text-slate-500">Total Assignments</p>
            </div>
          </>
        )}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        <Link href="/teacher/attendance" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform"><span className="text-3xl">✅</span></div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Mark Attendance</h3>
              <p className="text-sm text-slate-500">Record daily student attendance for your classes</p>
            </div>
          </div>
        </Link>
        <Link href="/teacher/marks" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all group">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform"><span className="text-3xl">📝</span></div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">Upload Marks</h3>
              <p className="text-sm text-slate-500">Enter and edit student marks for your subjects</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">My Assignments</h2>
        </div>
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4"><div className="flex-1 h-5 bg-slate-100 rounded-lg animate-pulse" /><div className="flex-1 h-5 bg-slate-100 rounded-lg animate-pulse" /></div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Subject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.assignments || []).length === 0 ? (
                <tr><td colSpan={2} className="px-6 py-12 text-center text-slate-500">No assignments found</td></tr>
              ) : (
                data.assignments.map((a, idx) => (
                  <tr key={a.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{a.className}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{a.subject?.name || a.subjectName || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
