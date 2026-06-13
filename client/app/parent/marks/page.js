"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useSearchParams } from "next/navigation";

function getScoreColor(score) {
  if (score >= 80) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500" };
  if (score >= 60) return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", bar: "bg-blue-500" };
  if (score >= 40) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", bar: "bg-amber-500" };
  return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", bar: "bg-red-500" };
}

function getGradeLetter(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function MarksContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const childParam = searchParams.get("child");

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(childParam || "");
  const [summary, setSummary] = useState(null);
  const [marks, setMarks] = useState(null);
  const [examNames, setExamNames] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");

  // Fetch children list
  useEffect(() => {
    async function fetchChildren() {
      try {
        const res = await apiClient.get("/parent/children");
        setChildren(res.children || []);
        if (childParam && res.children?.some((c) => String(c.id) === String(childParam))) {
          setSelectedChild(String(childParam));
        } else if (res.children?.length > 0 && !selectedChild) {
          setSelectedChild(String(res.children[0].id));
        }
      } catch (err) {
        showToast(err.data?.error || "Failed to load children", "error");
      } finally {
        setLoadingChildren(false);
      }
    }
    fetchChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  // Fetch summary when child changes
  const fetchSummary = useCallback(async () => {
    if (!selectedChild) return;
    setLoadingSummary(true);
    try {
      const res = await apiClient.get(`/parent/children/${selectedChild}/marks/summary`);
      setSummary(res);
    } catch (err) {
      showToast(err.data?.error || "Failed to load marks summary", "error");
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedChild, showToast]);

  // Fetch detailed marks when child or exam filter changes
  const fetchMarks = useCallback(async () => {
    if (!selectedChild) return;
    setLoadingMarks(true);
    try {
      const query = selectedExam ? `?exam_name=${encodeURIComponent(selectedExam)}` : "";
      const res = await apiClient.get(`/parent/children/${selectedChild}/marks${query}`);
      setMarks(res.marks || []);
      setExamNames(res.examNames || []);
    } catch (err) {
      showToast(err.data?.error || "Failed to load marks", "error");
      setMarks(null);
    } finally {
      setLoadingMarks(false);
    }
  }, [selectedChild, selectedExam, showToast]);

  useEffect(() => {
    fetchSummary();
    fetchMarks();
  }, [fetchSummary, fetchMarks]);

  const selectedChildData = children.find((c) => String(c.id) === String(selectedChild));

  const filteredSummary = useMemo(() => {
    if (!summary || !summary.subjectSummary) return null;
    if (!selectedExam) return summary;

    const filteredList = summary.subjectSummary
      .map((subj) => {
        const filteredMarks = (subj.marks || []).filter(
          (m) => (m.examName || m.exam_name) === selectedExam
        );

        if (filteredMarks.length === 0) return null;

        const scores = filteredMarks.map((m) => Number(m.score) || 0);
        const sum = scores.reduce((acc, s) => acc + s, 0);
        const average = Math.round((sum / scores.length) * 10) / 10;
        const highest = Math.max(...scores);
        const lowest = Math.min(...scores);

        return {
          ...subj,
          average,
          highest,
          lowest,
          totalExams: filteredMarks.length,
          marks: filteredMarks,
        };
      })
      .filter(Boolean);

    return {
      ...summary,
      subjectSummary: filteredList,
    };
  }, [summary, selectedExam]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-1">Academic Performance</h1>
        <p className="text-slate-500">Review your child&apos;s exam scores and subject performance.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Child selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Child</label>
            {loadingChildren ? (
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedChild}
                onChange={(e) => {
                  setSelectedChild(e.target.value);
                  setSelectedExam("");
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select a child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name} — {child.className}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Exam filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Filter by Exam
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">All Exams</option>
              {examNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedChild ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <span className="text-5xl mb-4 block">👆</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a Child</h3>
          <p className="text-slate-500">Choose a child above to view their academic performance.</p>
        </div>
      ) : (
        <>
          {/* Student info */}
          {selectedChildData && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold">
                {selectedChildData.name?.charAt(0) || "S"}
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">{selectedChildData.name}</h3>
                <p className="text-sm text-slate-500">{selectedChildData.className}</p>
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-1 w-fit">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "summary"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              📊 Subject Summary
            </button>
            <button
              onClick={() => setActiveTab("detailed")}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "detailed"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              📋 Detailed Marks
            </button>
          </div>

          {/* Subject Summary Tab */}
          {activeTab === "summary" && (
            <>
              {loadingSummary ? (
                <div className="space-y-6">
                  {/* Graph Skeleton */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
                    <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse mb-4" />
                    <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-xl animate-pulse" />
                          <div className="flex-1">
                            <div className="h-5 w-24 bg-slate-100 rounded-lg animate-pulse mb-2" />
                            <div className="h-4 w-32 bg-slate-100 rounded-lg animate-pulse" />
                          </div>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : filteredSummary?.subjectSummary?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                  <span className="text-5xl mb-4 block">📝</span>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Marks Yet</h3>
                  <p className="text-slate-500">No exam scores have been recorded yet.</p>
                </div>
              ) : (
                <>
                  {/* Graphical Summary Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <span>📈</span> Performance Graph Summary
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">Visual representation of subject average scores</p>
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-800">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600 shadow-sm"></span> Excellent (≥80)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600 shadow-sm"></span> Good (60-79)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-600 shadow-sm"></span> Average (40-59)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-600 shadow-sm"></span> Needs Improvement (&lt;40)</span>
                      </div>
                    </div>

                    {/* The Graph */}
                    <div className="relative h-48 flex items-end gap-2 sm:gap-6 border-b border-l border-slate-200 pb-2 pl-2">
                      {/* Y-Axis Gridlines & Labels */}
                      <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-400 font-semibold pl-2">
                        <div className="w-full border-t border-slate-100 pt-1">100</div>
                        <div className="w-full border-t border-slate-100 pt-1">80</div>
                        <div className="w-full border-t border-slate-100 pt-1">60</div>
                        <div className="w-full border-t border-slate-100 pt-1">40</div>
                        <div className="w-full border-t border-slate-100 pt-1">20</div>
                        <div className="w-full pt-1">0</div>
                      </div>

                      {/* Bars */}
                      <div className="flex-1 h-full flex items-end justify-around relative z-10 pt-4 px-2 sm:px-6">
                        {filteredSummary?.subjectSummary?.map((subj, idx) => {
                          const avg = Number(subj.average) || 0;
                          const colors = getScoreColor(avg);
                          let gradClass = "from-emerald-400 to-emerald-600";
                          if (avg >= 80) gradClass = "from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700";
                          else if (avg >= 60) gradClass = "from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700";
                          else if (avg >= 40) gradClass = "from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700";
                          else gradClass = "from-red-400 to-red-600 hover:from-red-500 hover:to-red-700";

                          return (
                            <div key={idx} className="flex flex-col items-center flex-1 max-w-[44px] group relative h-full justify-end">
                              {/* Tooltip on Hover */}
                              <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-30 transform translate-y-2 group-hover:translate-y-0">
                                <div className="bg-slate-900 text-white rounded-lg p-2.5 text-xs shadow-xl min-w-[140px] text-center border border-slate-800">
                                  <p className="font-bold text-slate-200">{subj.subject?.name || subj.subject}</p>
                                  <p className="text-sm font-extrabold text-white mt-1">{avg.toFixed(1)} / 100</p>
                                  <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
                                    <div>Min: <span className="font-bold text-white">{subj.lowest}</span></div>
                                    <div>Max: <span className="font-bold text-white">{subj.highest}</span></div>
                                  </div>
                                </div>
                                <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 mx-auto -mt-1 border-r border-b border-slate-800"></div>
                              </div>

                              {/* Score label on top of bar */}
                              <span className="text-[11px] font-extrabold text-slate-700 mb-1 opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all">
                                {avg.toFixed(0)}
                              </span>

                              {/* The Visual Bar */}
                              <div
                                className={`w-full rounded-t-lg bg-gradient-to-t ${gradClass} shadow-md transition-all duration-700 ease-out group-hover:shadow-lg`}
                                style={{ height: `${Math.min(Math.max(avg, 5), 100)}%` }}
                              ></div>

                              {/* Subject label below bar */}
                              <span className="text-[10px] sm:text-xs font-bold text-slate-500 mt-2 truncate w-full text-center group-hover:text-slate-800 transition-colors">
                                {subj.subject?.name || subj.subject}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSummary?.subjectSummary?.map((subj, idx) => {
                      const avg = Number(subj.average) || 0;
                      const colors = getScoreColor(avg);
                      return (
                        <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                          <div className="p-5">
                            {/* Subject header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center`}>
                                  <span className={`text-lg font-bold ${colors.text}`}>{getGradeLetter(avg)}</span>
                                </div>
                                <div>
                                  <h3 className="text-base font-semibold text-slate-900">{subj.subject?.name || subj.subject}</h3>
                                  <p className="text-xs text-slate-500">{subj.totalExams} exam{subj.totalExams !== 1 ? "s" : ""}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-2xl font-bold ${colors.text}`}>{avg.toFixed(1)}</p>
                                <p className="text-[11px] text-slate-400">Average</p>
                              </div>
                            </div>

                            {/* Score bar */}
                            <div className="mb-4">
                              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                  style={{ width: `${Math.min(avg, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Min/Max */}
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                <span className="text-slate-500">Lowest: <span className="font-semibold text-slate-700">{subj.lowest}</span></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span className="text-slate-500">Highest: <span className="font-semibold text-slate-700">{subj.highest}</span></span>
                              </div>
                            </div>

                            {/* Individual exam scores */}
                            {subj.marks?.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs font-medium text-slate-500 mb-2">Exam Breakdown</p>
                                <div className="space-y-2">
                                  {subj.marks.map((m, mIdx) => {
                                    const sc = Number(m.score) || 0;
                                    const mColors = getScoreColor(sc);
                                    return (
                                      <div key={mIdx} className="flex items-center justify-between">
                                        <span className="text-sm text-slate-700">{m.examName || m.exam_name}</span>
                                        <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-lg ${mColors.bg} ${mColors.text} border ${mColors.border}`}>
                                          {sc} / {m.maxScore || 100}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Detailed Marks Tab */}
          {activeTab === "detailed" && (
            <>
              {loadingMarks ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4 py-3">
                        <div className="h-5 w-24 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-5 w-20 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-5 w-16 bg-slate-100 rounded-lg animate-pulse" />
                        <div className="h-5 w-24 bg-slate-100 rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : marks?.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                  <span className="text-5xl mb-4 block">📝</span>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Marks Found</h3>
                  <p className="text-slate-500">
                    {selectedExam
                      ? `No marks recorded for "${selectedExam}".`
                      : "No exam scores have been recorded yet."}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">
                      {selectedExam ? `Marks — ${selectedExam}` : "All Exam Marks"}
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                      {marks?.length} record{marks?.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Table for larger screens */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Teacher</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {marks?.map((mark, idx) => {
                          const sc = Number(mark.score) || 0;
                          const colors = getScoreColor(sc);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3.5 text-sm font-medium text-slate-900">{mark.subject?.name || mark.subject}</td>
                              <td className="px-6 py-3.5 text-sm text-slate-600">{mark.examName || mark.exam_name}</td>
                              <td className="px-6 py-3.5 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                                  {sc} / {mark.maxScore || 100}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-sm text-slate-600">{mark.teacher?.name || mark.teacher || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Card view for mobile */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {marks?.map((mark, idx) => {
                      const sc = Number(mark.score) || 0;
                      const colors = getScoreColor(sc);
                      return (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-900">{mark.subject?.name || mark.subject}</h4>
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                              {sc} / {mark.maxScore || 100}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{mark.examName || mark.exam_name}</span>
                            {mark.teacher && (
                              <>
                                <span>•</span>
                                <span>{mark.teacher?.name || mark.teacher}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function MarksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-56 bg-slate-100 rounded-lg animate-pulse mb-2" />
            <div className="h-5 w-72 bg-slate-100 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <MarksContent />
    </Suspense>
  );
}
