"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const COLORS = ["YELLOW", "PINK", "BLUE"];

export default function ClassesPage() {
  const { showToast } = useToast();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Tabs and quick select state
  const [activeTab, setActiveTab] = useState("manual"); // "manual" or "quick"
  const [selectedRoman, setSelectedRoman] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/classes");
      setClasses(Array.isArray(res) ? res : []);
    } catch (err) {
      showToast(err.data?.error || "Failed to load classes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) {
      showToast("Class name is required", "warning");
      return;
    }
    try {
      setAdding(true);
      await apiClient.post("/admin/classes", { name: newName.trim() });
      showToast(`Class "${newName.trim()}" created`, "success");
      setNewName("");
      fetchClasses();
    } catch (err) {
      showToast(err.data?.error || "Failed to create class", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleQuickAdd() {
    if (!selectedRoman || !selectedColor) {
      showToast("Please select both a grade and a color", "warning");
      return;
    }
    const classFullName = `${selectedRoman}-${selectedColor}`;
    try {
      setAdding(true);
      await apiClient.post("/admin/classes", { name: classFullName });
      showToast(`Class "${classFullName}" created`, "success");
      setSelectedRoman("");
      setSelectedColor("");
      fetchClasses();
    } catch (err) {
      showToast(err.data?.error || "Failed to create class", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/classes/${deleteTarget.id}`);
      showToast(`Class "${deleteTarget.name}" deleted`, "success");
      setDeleteTarget(null);
      fetchClasses();
    } catch (err) {
      showToast(err.data?.error || "Failed to delete class", "error");
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">Classes</h1>
        <p className="text-slate-500">Manage school classes and sections</p>
      </div>

      {/* Add Class Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h2 className="text-base font-semibold text-slate-900">Add New Class</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("manual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "manual"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              ✍️ Manual Type
            </button>
            <button
              onClick={() => setActiveTab("quick")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "quick"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🎯 Quick Selector
            </button>
          </div>
        </div>

        {activeTab === "manual" ? (
          <form onSubmit={handleAdd} className="flex gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">🏫</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. 10-A, 9-B, Class 8"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Adding...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Class
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Roman Letters Selector */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Select Grade (1 - 12)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {ROMAN_NUMERALS.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedRoman(num)}
                      className={`py-2 text-sm font-semibold rounded-xl border transition-all duration-200 ${
                        selectedRoman === num
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Select Section / Color
                </span>
                <div className="flex flex-col gap-2">
                  {COLORS.map((col) => {
                    let colorStyles = "";
                    if (col === "YELLOW") {
                      colorStyles = selectedColor === col 
                        ? "bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/20" 
                        : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800";
                    } else if (col === "PINK") {
                      colorStyles = selectedColor === col 
                        ? "bg-rose-500 border-rose-500 text-white shadow-sm shadow-rose-500/20" 
                        : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-800";
                    } else if (col === "BLUE") {
                      colorStyles = selectedColor === col 
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20" 
                        : "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800";
                    }
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setSelectedColor(col)}
                        className={`py-2 px-4 text-sm font-semibold rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${colorStyles}`}
                      >
                        <span>{col}</span>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.toLowerCase() }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Preview and Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="text-sm">
                <span className="text-slate-500">Preview: </span>
                {selectedRoman && selectedColor ? (
                  <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg animate-pulse">
                    {selectedRoman}-{selectedColor}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Select grade and color</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={adding || !selectedRoman || !selectedColor}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Class
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Classes List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">All Classes</h2>
          {!loading && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              {classes.length} {classes.length === 1 ? "class" : "classes"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
                <div className="flex-1 h-5 w-32 bg-slate-100 rounded-lg animate-pulse" />
                <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-5xl mb-4 block">🏫</span>
            <h3 className="text-base font-semibold text-slate-900 mb-1">No Classes Yet</h3>
            <p className="text-sm text-slate-500">Add your first class above to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {classes.map((cls, idx) => (
              <div
                key={cls.id}
                className={`flex items-center gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60 ${
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                }`}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-base font-bold flex-shrink-0">
                  {cls.name.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{cls.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Added {new Date(cls.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setDeleteTarget(cls)}
                  className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete class"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Class"
        message={`Are you sure you want to delete class "${deleteTarget?.name}"? This won't affect existing students or assignments.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
