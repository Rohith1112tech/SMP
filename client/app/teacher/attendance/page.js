"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AttendancePage() {
  const { showToast } = useToast();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load classes on mount
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await apiClient.get("/teacher/my-classes");
        setClasses(res.classes || []);
        if (res.classes?.length > 0) {
          setSelectedClass(res.classes[0]);
        }
      } catch (err) {
        showToast(err.data?.error || "Failed to load classes", "error");
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, [showToast]);

  // Load attendance when class or date changes
  const loadAttendance = useCallback(async () => {
    if (!selectedClass || !selectedDate) return;
    setLoadingStudents(true);
    try {
      const res = await apiClient.get(
        `/teacher/attendance?class_name=${encodeURIComponent(selectedClass)}&date=${selectedDate}`
      );
      const studentList = res.students || [];
      setStudents(studentList);
      const newStatuses = {};
      studentList.forEach((s) => {
        if (s.attendance?.status) {
          newStatuses[s.id] = s.attendance.status;
        }
      });
      setStatuses(newStatuses);
    } catch (err) {
      showToast(err.data?.error || "Failed to load attendance", "error");
      setStudents([]);
      setStatuses({});
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedDate, showToast]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const toggleStatus = (studentId, status) => {
    setStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? undefined : status,
    }));
  };

  const markAll = (status) => {
    const newStatuses = {};
    students.forEach((s) => {
      newStatuses[s.id] = status;
    });
    setStatuses(newStatuses);
  };

  const handleSave = async () => {
    const records = students
      .filter((s) => statuses[s.id])
      .map((s) => ({ student_id: s.id, status: statuses[s.id] }));

    if (records.length === 0) {
      showToast("Please mark attendance for at least one student", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.post("/teacher/attendance", {
        class_name: selectedClass,
        date: selectedDate,
        records,
      });
      showToast(res.message || `Attendance saved for ${res.count} students`, "success");
    } catch (err) {
      showToast(err.data?.error || "Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const markedCount = Object.values(statuses).filter(Boolean).length;
  const presentCount = Object.values(statuses).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(statuses).filter((s) => s === "ABSENT").length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">Attendance</h1>
        <p className="text-slate-500">Mark daily attendance for your students</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            {loadingClasses ? (
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {students.length > 0 && !loadingStudents && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{students.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Students</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{presentCount}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Present</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            <p className="text-xs text-red-600 mt-0.5">Absent</p>
          </div>
        </div>
      )}

      {/* Student List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Students {selectedClass && <span className="text-blue-600">— {selectedClass}</span>}
          </h2>
          {students.length > 0 && !loadingStudents && (
            <div className="flex gap-2">
              <button
                onClick={() => markAll("PRESENT")}
                className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                Mark All Present
              </button>
              <button
                onClick={() => markAll("ABSENT")}
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Mark All Absent
              </button>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loadingStudents && (
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 h-5 bg-slate-100 rounded-lg animate-pulse" />
                <div className="w-24 h-9 bg-slate-100 rounded-lg animate-pulse" />
                <div className="w-24 h-9 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loadingStudents && !selectedClass && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-slate-500 font-medium">Select a class to view students</p>
          </div>
        )}

        {!loadingStudents && selectedClass && students.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-slate-500 font-medium">No students found in {selectedClass}</p>
          </div>
        )}

        {/* Student Rows */}
        {!loadingStudents && students.length > 0 && (
          <div className="divide-y divide-slate-100">
            {students.map((student, idx) => {
              const status = statuses[student.id];
              return (
                <div
                  key={student.id}
                  className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {(student.name || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{student.name || '—'}</p>
                    <p className="text-xs text-slate-500">{student.className || selectedClass}</p>
                  </div>

                  {/* Status Badge */}
                  {status && (
                    <span
                      className={`hidden sm:inline-flex px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                        status === "PRESENT"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {status}
                    </span>
                  )}

                  {/* Toggle Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(student.id, "PRESENT")}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 ${
                        status === "PRESENT"
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                          : "bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-600"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="hidden sm:inline">Present</span>
                      </span>
                    </button>
                    <button
                      onClick={() => toggleStatus(student.id, "ABSENT")}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 ${
                        status === "ABSENT"
                          ? "bg-red-500 text-white border-red-500 shadow-sm"
                          : "bg-white text-slate-600 border-slate-300 hover:border-red-400 hover:text-red-600"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="hidden sm:inline">Absent</span>
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button */}
      {!loadingStudents && students.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{markedCount}</span> of{" "}
            <span className="font-medium text-slate-900">{students.length}</span> students marked
          </p>
          <button
            onClick={handleSave}
            disabled={saving || markedCount === 0}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Save Attendance
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
