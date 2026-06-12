"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function MarksPage() {
  const { showToast } = useToast();

  // Dropdown data
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [existingExams, setExistingExams] = useState([]);

  // Selected values
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [examName, setExamName] = useState("");
  const [totalMark, setTotalMark] = useState("100"); // Dynamic max score
  const totalMarkInputRef = useRef(null);

  // Student data
  const [students, setStudents] = useState([]);
  const [scores, setScores] = useState({});

  // Loading states
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dropdown visibility for exam suggestions
  const [showExamSuggestions, setShowExamSuggestions] = useState(false);

  // Load classes and assignments on mount
  useEffect(() => {
    async function init() {
      try {
        const [classesRes, dashRes] = await Promise.all([
          apiClient.get("/teacher/my-classes"),
          apiClient.get("/teacher/dashboard"),
        ]);
        setClasses(classesRes.classes || []);
        setAssignments(dashRes.assignments || []);
      } catch (err) {
        showToast(err.data?.error || "Failed to load data", "error");
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, [showToast]);

  // Subjects available for the selected class
  const subjectsForClass = selectedClass
    ? assignments
        .filter((a) => a.className === selectedClass)
        .map((a) => a.subject)
        .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
    : [];

  // Reset subject when class changes
  useEffect(() => {
    setSelectedSubject("");
    setExamName("");
    setTotalMark("100");
    setStudents([]);
    setScores({});
    setExistingExams([]);
  }, [selectedClass]);

  // Reset exam when subject changes
  useEffect(() => {
    setExamName("");
    setTotalMark("100");
    setStudents([]);
    setScores({});
  }, [selectedSubject]);

  // Load existing exams when class + subject selected
  useEffect(() => {
    if (!selectedClass || !selectedSubject) {
      setExistingExams([]);
      return;
    }
    async function loadExams() {
      setLoadingExams(true);
      try {
        const res = await apiClient.get(
          `/teacher/exams?subject_id=${selectedSubject}&class_name=${encodeURIComponent(selectedClass)}`
        );
        setExistingExams(res.exams || []);
      } catch {
        setExistingExams([]);
      } finally {
        setLoadingExams(false);
      }
    }
    loadExams();
  }, [selectedClass, selectedSubject]);

  // Load students and marks when all three filters are set
  const loadMarks = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !examName.trim()) return;
    setLoadingStudents(true);
    try {
      const res = await apiClient.get(
        `/teacher/marks?class_name=${encodeURIComponent(selectedClass)}&subject_id=${selectedSubject}&exam_name=${encodeURIComponent(examName.trim())}`
      );
      const studentList = res.students || [];
      setStudents(studentList);
      
      let detectedTotalMark = "100";
      const newScores = {};
      studentList.forEach((s) => {
        if (s.mark?.score != null) {
          newScores[s.id] = String(s.mark.score);
          if (s.mark.maxScore != null) {
            detectedTotalMark = String(s.mark.maxScore);
          }
        }
      });
      setScores(newScores);
      setTotalMark(detectedTotalMark);
    } catch (err) {
      showToast(err.data?.error || "Failed to load marks", "error");
      setStudents([]);
      setScores({});
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, selectedSubject, examName, showToast]);

  // Debounce the marks loading on examName change
  useEffect(() => {
    if (!examName.trim()) {
      setStudents([]);
      setScores({});
      return;
    }
    const timer = setTimeout(() => {
      loadMarks();
    }, 600);
    return () => clearTimeout(timer);
  }, [loadMarks, examName]);

  const handleScoreChange = (studentId, value) => {
    const maxVal = totalMark ? parseFloat(totalMark) : 100;
    if (value === "" || value === undefined) {
      setScores((prev) => ({ ...prev, [studentId]: "" }));
      return;
    }
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= maxVal) {
      setScores((prev) => ({ ...prev, [studentId]: String(num) }));
    }
  };

  const handleSave = async () => {
    const maxVal = totalMark ? parseFloat(totalMark) : 100;
    const marks = [];
    let hasError = false;

    students.forEach((s) => {
      const raw = scores[s.id];
      if (raw === "" || raw == null) return; // skip empty
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0 || num > maxVal) {
        hasError = true;
      } else {
        marks.push({ student_id: s.id, score: num });
      }
    });

    if (hasError) {
      showToast(`Some scores are invalid. Please enter values between 0 and ${maxVal}.`, "error");
      return;
    }

    if (marks.length === 0) {
      showToast("Please enter marks for at least one student", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.post("/teacher/marks", {
        class_name: selectedClass,
        subject_id: parseInt(selectedSubject, 10),
        exam_name: examName.trim(),
        total_mark: maxVal,
        marks,
      });
      showToast(res.message || `Marks saved for ${res.count} students`, "success");
    } catch (err) {
      showToast(err.data?.error || "Failed to save marks", "error");
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.values(scores).filter((v) => v !== "" && v != null).length;

  // Get subject name for display
  const selectedSubjectObj = subjectsForClass.find((s) => String(s.id) === String(selectedSubject));

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">Student Marks</h1>
        <p className="text-slate-500">Enter and manage exam marks for your students</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Class Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Class</label>
            {loadingInit ? (
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

          {/* Subject Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedClass}
              className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">Select a subject</option>
              {subjectsForClass.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Exam Name Input with suggestions */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Exam Name</label>
            <input
              type="text"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              onFocus={() => setShowExamSuggestions(true)}
              onBlur={() => setTimeout(() => setShowExamSuggestions(false), 200)}
              disabled={!selectedSubject}
              placeholder={loadingExams ? "Loading exams..." : "e.g. Term 1, Midterm"}
              className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
            {/* Exam suggestions dropdown */}
            {showExamSuggestions && existingExams.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                  Existing Exams
                </div>
                {existingExams.map((exam) => (
                  <button
                    key={exam}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setExamName(exam);
                      setShowExamSuggestions(false);
                      // Auto-focus and select the total mark input
                      setTimeout(() => {
                        if (totalMarkInputRef.current) {
                          totalMarkInputRef.current.focus();
                          totalMarkInputRef.current.select();
                        }
                      }, 100);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                      examName === exam ? "text-blue-600 font-medium bg-blue-50/50" : "text-slate-700"
                    }`}
                  >
                    {exam}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Total Mark Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Mark</label>
            <input
              ref={totalMarkInputRef}
              type="number"
              min="1"
              value={totalMark}
              onChange={(e) => setTotalMark(e.target.value)}
              disabled={!selectedSubject}
              placeholder="e.g. 100, 50"
              className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Total Mark Reminder Banner */}
      {examName.trim() && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all animate-pulse-once">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-xl">
              🔔
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-amber-950">
                Enter Total Mark for &ldquo;{examName}&rdquo;
              </h3>
              <p className="text-xs text-amber-800 font-semibold mt-0.5">
                Specify if this exam is out of 100, 50, 20, etc. Student scores will be validated against this limit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-200">
            <span className="text-xs font-bold text-slate-700">Out of:</span>
            <input
              type="number"
              min="1"
              value={totalMark}
              onChange={(e) => setTotalMark(e.target.value)}
              className="w-16 text-center font-extrabold text-slate-950 bg-slate-50 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 py-1 text-sm"
              placeholder="e.g. 50"
            />
          </div>
        </div>
      )}

      {/* Info Banner */}
      {selectedClass && selectedSubjectObj && examName.trim() && !loadingStudents && students.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">📝</span>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">
              {selectedSubjectObj.name} — {examName} — {selectedClass}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              {filledCount} of {students.length} scores entered
            </p>
          </div>
        </div>
      )}

      {/* Student Marks Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Student Scores
            {selectedClass && <span className="text-blue-600"> — {selectedClass}</span>}
          </h2>
        </div>

        {/* Loading State */}
        {loadingStudents && (
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 h-5 bg-slate-100 rounded-lg animate-pulse" />
                <div className="w-28 h-10 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Empty: No class/subject/exam selected */}
        {!loadingStudents && (!selectedClass || !selectedSubject || !examName.trim()) && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-slate-500 font-medium">
              {!selectedClass
                ? "Select a class to get started"
                : !selectedSubject
                ? "Select a subject"
                : "Enter an exam name to load students"}
            </p>
          </div>
        )}

        {/* Empty: No students found */}
        {!loadingStudents && selectedClass && selectedSubject && examName.trim() && students.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-slate-500 font-medium">No students found</p>
          </div>
        )}

        {/* Student Rows */}
        {!loadingStudents && students.length > 0 && (
          <>
            {/* Table Header */}
            <div className="hidden sm:flex items-center gap-4 px-6 py-3 bg-blue-600 text-white font-bold">
              <div className="w-10" />
              <div className="flex-1 text-xs font-bold uppercase tracking-wider">Student Name</div>
              <div className="w-36 text-xs font-bold uppercase tracking-wider text-center">Score (Out of {totalMark || 100})</div>
            </div>

            <div className="divide-y divide-slate-100">
              {students.map((student, idx) => {
                const score = scores[student.id] ?? "";
                const maxVal = totalMark ? parseFloat(totalMark) : 100;
                const isValid = score === "" || (parseFloat(score) >= 0 && parseFloat(score) <= maxVal);
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
                      <p className="text-sm font-semibold text-slate-900 truncate">{student.name || '—'}</p>
                      <p className="text-sm font-semibold text-slate-700 sm:hidden">
                        Score: <span className="font-extrabold text-slate-950">{score || "—"}</span> / <span className="font-extrabold text-slate-950">{totalMark || 100}</span>
                      </p>
                    </div>

                    {/* Score Input */}
                    <div className="w-36 flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min="0"
                        max={maxVal}
                        value={score}
                        onChange={(e) => handleScoreChange(student.id, e.target.value)}
                        placeholder="—"
                        className={`w-20 px-3 py-2 text-base text-center font-extrabold text-slate-950 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all placeholder-slate-600 ${
                          !isValid
                            ? "border-red-600 focus:ring-red-500/30 bg-red-50"
                            : "border-slate-700 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 focus:bg-white shadow-sm"
                        }`}
                      />
                      <span className="text-base text-slate-950 font-extrabold hidden sm:inline">/ {totalMark || 100}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      {!loadingStudents && students.length > 0 && (
        <div className="mt-6 flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{filledCount}</span> of{" "}
            <span className="font-medium text-slate-900">{students.length}</span> scores entered
          </p>
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
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
                Save Marks
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
