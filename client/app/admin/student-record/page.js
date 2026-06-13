"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";

export default function StudentRecordPage() {
  const { showToast } = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [performanceData, setPerformanceData] = useState({ classAverage: null, students: [] });
  const [loading, setLoading] = useState(false);

  // Student specific details modal states
  const [viewingStudentId, setViewingStudentId] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState("marks"); // "marks" | "attendance"

  const fetchClasses = useCallback(async () => {
    try {
      const res = await apiClient.get("/admin/classes");
      setClasses(res || []);
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  }, []);

  const fetchClassPerformance = useCallback(async (className) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/admin/classes/${encodeURIComponent(className)}/performance`);
      setPerformanceData(res || { classAverage: null, students: [] });
    } catch (err) {
      showToast(err.data?.error || "Failed to load class performance record", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchStudentDetails = useCallback(async (id) => {
    try {
      setLoadingDetails(true);
      const res = await apiClient.get(`/admin/students/${id}`);
      setStudentDetails(res);
    } catch (err) {
      showToast(err.data?.error || "Failed to load student details", "error");
    } finally {
      setLoadingDetails(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassPerformance(selectedClass);
    } else {
      setPerformanceData({ classAverage: null, students: [] });
    }
  }, [selectedClass, fetchClassPerformance]);

  useEffect(() => {
    if (viewingStudentId) {
      fetchStudentDetails(viewingStudentId);
    } else {
      setStudentDetails(null);
    }
  }, [viewingStudentId, fetchStudentDetails]);

  const columns = [
    {
      key: "name",
      label: "Student Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
            {(row.name || '?').charAt(0)}
          </div>
          <button
            onClick={() => {
              setViewingStudentId(row.id);
              setActiveDetailsTab("marks");
            }}
            className="font-semibold text-slate-800 hover:text-blue-600 hover:underline text-left focus:outline-none transition-all"
          >
            {row.name || '—'}
          </button>
        </div>
      ),
    },
    {
      key: "parentMobile",
      label: "Parent Contact",
      render: (row) => (
        <span className="text-slate-500 font-mono text-xs">{row.parentMobile || "—"}</span>
      ),
    },
    {
      key: "avgMark",
      label: "Average Score",
      render: (row) => (
        <span className={`font-semibold text-sm ${
          row.avgMark === null
            ? "text-slate-400"
            : row.avgMark >= 75
            ? "text-emerald-600"
            : row.avgMark >= 40
            ? "text-slate-700"
            : "text-red-500"
        }`}>
          {row.avgMark !== null ? `${row.avgMark}` : "No marks"}
        </span>
      ),
    },
    {
      key: "attendancePercent",
      label: "Attendance Rate",
      render: (row) => (
        <span className={`font-semibold text-sm ${
          row.attendancePercent === null
            ? "text-slate-400"
            : row.attendancePercent >= 75
            ? "text-emerald-600"
            : "text-amber-500"
        }`}>
          {row.attendancePercent !== null ? `${row.attendancePercent}%` : "No logs"}
        </span>
      ),
    },
  ];

  // Calculate student average for detail modal
  const studentAverage = studentDetails?.marks?.length > 0
    ? Math.round((studentDetails.marks.reduce((acc, m) => acc + m.score, 0) / studentDetails.marks.length) * 10) / 10
    : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Record</h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor class averages and individual student progress summaries.
        </p>
      </div>

      {/* Class Selector dropdown and Class Average card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Select Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Choose Class...</option>
            {classes.map((cls) => {
              const name = cls.name || cls;
              return (
                <option key={name} value={name}>{name}</option>
              );
            })}
          </select>
        </div>

        {/* Class Average card */}
        {selectedClass && (
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between animate-fade-in">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Class Average
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${
                performanceData.classAverage === null
                  ? "text-slate-400"
                  : performanceData.classAverage >= 75
                  ? "text-emerald-600"
                  : "text-blue-900"
              }`}>
                {performanceData.classAverage !== null ? performanceData.classAverage : "—"}
              </span>
              {performanceData.classAverage !== null && (
                <span className="text-xs text-slate-400 font-medium">/ 100 overall score</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
              Aggregated exam performance across all subjects.
            </p>
          </div>
        )}
      </div>

      {selectedClass ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Students in {selectedClass}
            </h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {performanceData.students.length} students
            </span>
          </div>

          <DataTable
            columns={columns}
            data={performanceData.students}
            loading={loading}
            emptyMessage={`No student records found in ${selectedClass}.`}
            searchable
            searchPlaceholder="Search class students..."
          />
        </div>
      ) : (
        <div className="py-12 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center p-6 space-y-2">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl">
            📚
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Class Selected</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Please choose a class from the dropdown above to view student lists, scores, and class averages.
          </p>
        </div>
      )}

      {/* Student Details modal comparing to Class Average */}
      <Modal
        isOpen={!!viewingStudentId}
        onClose={() => setViewingStudentId(null)}
        title={studentDetails ? `${studentDetails.name}'s Progress Record` : "Loading Records..."}
      >
        {loadingDetails ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Retrieving details...</p>
          </div>
        ) : studentDetails ? (
          <div className="space-y-6">
            {/* Profile Card with stats compared to Class Average */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Student Avg</p>
                <p className={`text-base font-extrabold mt-1 ${
                  studentAverage === null
                    ? "text-slate-400"
                    : studentAverage >= (performanceData.classAverage || 0)
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}>
                  {studentAverage !== null ? studentAverage : "—"}
                </p>
                {studentAverage !== null && performanceData.classAverage !== null && (
                  <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                    {studentAverage >= performanceData.classAverage
                      ? `+${Math.round((studentAverage - performanceData.classAverage)*10)/10} vs Class`
                      : `${Math.round((studentAverage - performanceData.classAverage)*10)/10} vs Class`}
                  </p>
                )}
              </div>
              <div className="text-center border-x border-slate-200">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Class Avg</p>
                <p className="text-base font-extrabold text-blue-900 mt-1">
                  {performanceData.classAverage !== null ? performanceData.classAverage : "—"}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-medium">Reference Target</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Attendance %</p>
                <p className={`text-base font-extrabold mt-1 ${
                  (studentDetails.attendanceSummary?.present / (studentDetails.attendanceSummary?.total || 1)) * 100 >= 75
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}>
                  {studentDetails.attendanceSummary?.total > 0
                    ? `${Math.round((studentDetails.attendanceSummary.present / studentDetails.attendanceSummary.total) * 100)}%`
                    : "0%"}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                  {studentDetails.attendanceSummary?.present} / {studentDetails.attendanceSummary?.total} days
                </p>
              </div>
            </div>

            {/* Tab selector */}
            <div className="flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => setActiveDetailsTab("marks")}
                className={`py-2 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                  activeDetailsTab === "marks"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                📝 Detailed Marks
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailsTab("attendance")}
                className={`py-2 px-4 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
                  activeDetailsTab === "attendance"
                    ? "text-blue-600 border-blue-600"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                ✅ Attendance Log
              </button>
            </div>

            {/* Marks Tab content */}
            {activeDetailsTab === "marks" && (
              <div className="space-y-4">
                {studentDetails.marks?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Score</th>
                          <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider">Graded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentDetails.marks.map((mark) => (
                          <tr key={mark.id} className="hover:bg-slate-50/30">
                            <td className="py-2.5 px-3 font-medium text-slate-800">{mark.subject?.name}</td>
                            <td className="py-2.5 px-3">{mark.examName}</td>
                            <td className={`py-2.5 px-3 text-right font-bold ${
                              mark.score >= 40 ? "text-slate-800" : "text-red-500"
                            }`}>
                              {mark.score} / {mark.maxScore || 100}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{mark.teacher?.name || "Faculty"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No exam marks uploaded for this student yet.
                  </div>
                )}
              </div>
            )}

            {/* Attendance Tab content */}
            {activeDetailsTab === "attendance" && (
              <div className="space-y-4">
                {studentDetails.attendance?.length > 0 ? (
                  <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 sticky top-0">
                          <th className="py-2 px-3 font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">Date</th>
                          <th className="py-2 px-3 font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentDetails.attendance.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50/30">
                            <td className="py-2 px-3">{new Date(att.date).toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td className="py-2 px-3 text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                att.status === "PRESENT"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}>
                                {att.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No attendance records logged for this student yet.
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingStudentId(null)}
                className="px-5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-red-500">
            Failed to retrieve student record.
          </div>
        )}
      </Modal>
    </div>
  );
}
