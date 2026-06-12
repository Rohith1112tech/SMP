"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function SubjectsPage() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/subjects");
      setSubjects(res || []);
    } catch (err) {
      showToast(err.data?.error || "Failed to load subjects", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  async function handleAddSubject(e) {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      showToast("Subject name is required", "warning");
      return;
    }

    try {
      setAdding(true);
      await apiClient.post("/admin/subjects", { name: newSubjectName.trim() });
      showToast("Subject added successfully", "success");
      setNewSubjectName("");
      fetchSubjects();
    } catch (err) {
      showToast(err.data?.error || "Failed to add subject", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/subjects/${deleteTarget.id}`);
      showToast("Subject deleted successfully", "success");
      setDeleteTarget(null);
      fetchSubjects();
    } catch (err) {
      showToast(err.data?.error || "Failed to delete subject", "error");
    }
  }

  // Color palette for subject cards
  const colorPalette = [
    { bg: "bg-blue-50", border: "border-blue-200", icon: "bg-blue-100 text-blue-600", text: "text-blue-900" },
    { bg: "bg-emerald-50", border: "border-emerald-200", icon: "bg-emerald-100 text-emerald-600", text: "text-emerald-900" },
    { bg: "bg-purple-50", border: "border-purple-200", icon: "bg-purple-100 text-purple-600", text: "text-purple-900" },
    { bg: "bg-amber-50", border: "border-amber-200", icon: "bg-amber-100 text-amber-600", text: "text-amber-900" },
    { bg: "bg-rose-50", border: "border-rose-200", icon: "bg-rose-100 text-rose-600", text: "text-rose-900" },
    { bg: "bg-cyan-50", border: "border-cyan-200", icon: "bg-cyan-100 text-cyan-600", text: "text-cyan-900" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subjects</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage subjects offered at your school
        </p>
      </div>

      {/* Add Subject Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">
          Add New Subject
        </h2>
        <form onSubmit={handleAddSubject} className="flex items-end gap-3">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Subject Name
            </label>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Mathematics, Science, English"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {adding ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Subject
              </>
            )}
          </button>
        </form>
      </div>

      {/* Subjects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
                <div className="h-5 w-28 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📖</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            No subjects yet
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Add your first subject using the form above to get started with
            subject management.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((subject, index) => {
            const colors = colorPalette[index % colorPalette.length];
            return (
              <div
                key={subject.id}
                className={`${colors.bg} rounded-2xl border ${colors.border} p-5 hover:shadow-md transition-shadow group`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center`}
                    >
                      <span className="text-lg">📖</span>
                    </div>
                    <div>
                      <h3
                        className={`text-base font-semibold ${colors.text}`}
                      >
                        {subject.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID: {subject.id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(subject)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all"
                    title="Delete subject"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total count */}
      {!loading && subjects.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-400">
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""} total
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This may affect existing assignments.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
