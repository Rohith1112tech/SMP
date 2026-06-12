"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

function getNextEmpId(teachersList) {
  let maxNum = 0;
  let prefix = "EMP";
  
  if (Array.isArray(teachersList)) {
    teachersList.forEach((t) => {
      const empIdStr = String(t.empId || t.emp_id || "").trim();
      const match = empIdStr.match(/^([a-zA-Z-_]*[a-zA-Z])(\d+)$/);
      if (match) {
        prefix = match[1];
        const num = parseInt(match[2], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      } else {
        const numMatch = empIdStr.match(/^(\d+)$/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (num > maxNum) {
            maxNum = num;
            prefix = "";
          }
        }
      }
    });
  }
  
  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(3, "0");
  return `${prefix}${paddedNum}`;
}

export default function TeachersPage() {
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown data for inline assignment
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  // Teacher form
  const [form, setForm] = useState({ name: "", emp_id: "", phone: "", password: "" });

  // Inline assignments being built in the modal
  const [pendingAssignments, setPendingAssignments] = useState([]); // [{ class_name, subject_id }]
  const [assignForm, setAssignForm] = useState({ class_name: "", subject_id: "" });

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/teachers?limit=100");
      setTeachers(res.data || res);
    } catch (err) {
      showToast(err.data?.error || "Failed to load teachers", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [subRes, clsRes] = await Promise.all([
        apiClient.get("/admin/subjects"),
        apiClient.get("/admin/classes"),
      ]);
      setSubjects(Array.isArray(subRes) ? subRes : []);
      setClasses(Array.isArray(clsRes) ? clsRes : []);
    } catch {
      // Non-critical — dropdowns just won't populate
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
    fetchDropdowns();
  }, [fetchTeachers, fetchDropdowns]);

  function openAddModal() {
    setEditingTeacher(null);
    const nextId = getNextEmpId(teachers);
    setForm({ name: "", emp_id: nextId, phone: "", password: "" });
    setPendingAssignments([]);
    setAssignForm({ class_name: "", subject_id: "" });
    setModalOpen(true);
  }

  function openEditModal(teacher) {
    setEditingTeacher(teacher);
    setForm({
      name: teacher.name,
      emp_id: teacher.empId || teacher.emp_id,
      phone: teacher.phone || "",
      password: "",
    });
    // Pre-populate existing assignments
    const existing = (teacher.assignments || []).map((a) => ({
      class_name: a.className,
      subject_id: String(a.subjectId || a.subject?.id),
      subject_name: a.subject?.name,
      existing_id: a.id,
    }));
    setPendingAssignments(existing);
    setAssignForm({ class_name: "", subject_id: "" });
    setModalOpen(true);
  }

  function addPendingAssignment() {
    if (!assignForm.class_name || !assignForm.subject_id) {
      showToast("Select both a class and a subject", "warning");
      return;
    }
    // Prevent duplicates
    const duplicate = pendingAssignments.find(
      (a) => a.class_name === assignForm.class_name && String(a.subject_id) === String(assignForm.subject_id)
    );
    if (duplicate) {
      showToast("This class + subject combination is already added", "warning");
      return;
    }
    const subjectName = subjects.find((s) => String(s.id) === String(assignForm.subject_id))?.name;
    setPendingAssignments((prev) => [
      ...prev,
      { class_name: assignForm.class_name, subject_id: assignForm.subject_id, subject_name: subjectName },
    ]);
    setAssignForm({ class_name: "", subject_id: "" });
  }

  function removePendingAssignment(idx) {
    setPendingAssignments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.emp_id.trim()) {
      showToast("Name and Employee ID are required", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        emp_id: form.emp_id.trim(),
        phone: form.phone.trim() || null,
      };
      if (form.password) payload.password = form.password;

      let teacherId;
      if (editingTeacher) {
        await apiClient.put(`/admin/teachers/${editingTeacher.id}`, payload);
        teacherId = editingTeacher.id;
        showToast("Teacher updated successfully", "success");
      } else {
        const created = await apiClient.post("/admin/teachers", payload);
        teacherId = created.id;
        showToast("Teacher added successfully", "success");
      }

      // Sync assignments: add new ones (skip ones that already have an existing_id)
      const toAdd = pendingAssignments.filter((a) => !a.existing_id);
      for (const a of toAdd) {
        try {
          await apiClient.post("/admin/assignments", {
            teacher_id: teacherId,
            class_name: a.class_name,
            subject_id: parseInt(a.subject_id, 10),
          });
        } catch {
          // Duplicate or error — silently skip
        }
      }

      // If editing: remove assignments that were deleted from pending list
      if (editingTeacher) {
        const removedIds = (editingTeacher.assignments || [])
          .filter((a) => !pendingAssignments.some((p) => p.existing_id === a.id))
          .map((a) => a.id);
        for (const id of removedIds) {
          try {
            await apiClient.delete(`/admin/assignments/${id}`);
          } catch {
            // Silently skip
          }
        }
      }

      setModalOpen(false);
      fetchTeachers();
    } catch (err) {
      showToast(err.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/teachers/${deleteTarget.id}`);
      showToast("Teacher deleted successfully", "success");
      setDeleteTarget(null);
      fetchTeachers();
    } catch (err) {
      showToast(err.data?.error || "Failed to delete teacher", "error");
    }
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
            {(row.name || "?").charAt(0)}
          </div>
          <span className="font-medium text-slate-900">{row.name || "—"}</span>
        </div>
      ),
    },
    {
      key: "empId",
      label: "Employee ID",
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-mono">
          {row.empId || row.emp_id}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Phone Number",
      render: (row) => (
        <span className="text-slate-600 text-sm">
          {row.phone || "—"}
        </span>
      ),
    },
    {
      key: "assignments",
      label: "Assigned",
      render: (row) => {
        const count = row.assignments?.length || 0;
        return count > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.assignments.slice(0, 3).map((a) => (
              <span key={a.id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100">
                {a.className} · {a.subject?.name}
              </span>
            ))}
            {count > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium">
                +{count - 3} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">No assignments</span>
        );
      },
    },
  ];

  const classNames = classes.map((c) => c.name || c);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teacher Section</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your school&apos;s teaching staff</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Teacher
        </button>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        loading={loading}
        onEdit={openEditModal}
        onDelete={(t) => setDeleteTarget(t)}
        emptyMessage="No teachers found. Add your first teacher to get started."
        searchable
        searchPlaceholder="Search teachers..."
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTeacher ? "Edit Teacher" : "Add New Teacher"}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Basic Info ── */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter teacher's full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee ID *</label>
              <input
                type="text"
                value={form.emp_id}
                onChange={(e) => setForm({ ...form, emp_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. EMP002"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter phone number (for password reset)"
              />
            </div>
            {editingTeacher ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Override password"
                />
              </div>
            ) : (
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed">
                  ℹ️ <strong>Default Password Note:</strong> The teacher&apos;s initial password is set automatically to <strong>teacher</strong> followed by the numeric part of their Employee ID (e.g., employee <code>EMP002</code> will have default password <code>teacher002</code>). They will be prompted to change it when logging in for the first time.
                </p>
              </div>
            )}
          </div>

          {/* ── Inline Assignments ── */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📋</span>
              <h3 className="text-sm font-semibold text-slate-800">Class & Subject Assignments</h3>
            </div>

            {/* Assignment rows already added */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {pendingAssignments.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <span className="text-blue-600 text-xs font-semibold flex-1">
                      {a.class_name} · {a.subject_name || subjects.find((s) => String(s.id) === String(a.subject_id))?.name || `Subject #${a.subject_id}`}
                      {a.existing_id && <span className="ml-1.5 text-blue-400 font-normal">(existing)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAssignment(idx)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add row */}
            <div className="flex gap-2">
              <select
                value={assignForm.class_name}
                onChange={(e) => setAssignForm({ ...assignForm, class_name: e.target.value })}
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Class</option>
                {classNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={assignForm.subject_id}
                onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addPendingAssignment}
                className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-xl transition-colors flex-shrink-0"
              >
                + Add
              </button>
            </div>
            {classNames.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">⚠ No classes found — add classes first from the Classes page.</p>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingTeacher ? "Update Teacher" : "Add Teacher"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This will also remove their assignments and marks.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
