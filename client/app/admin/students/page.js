"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function StudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [form, setForm] = useState({
    name: "",
    class_name: "",
    parent_mobile: "",
  });

  const fetchClasses = useCallback(async () => {
    try {
      const res = await apiClient.get("/admin/classes");
      setClasses(res || []);
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const query = classFilter
        ? `/admin/students?limit=100&class=${encodeURIComponent(classFilter)}`
        : "/admin/students?limit=100";
      const res = await apiClient.get(query);
      setStudents(res.data || res);
    } catch (err) {
      showToast(err.data?.error || "Failed to load students", "error");
    } finally {
      setLoading(false);
    }
  }, [classFilter, showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  function openAddModal() {
    setEditingStudent(null);
    setForm({ name: "", class_name: "", parent_mobile: "" });
    setModalOpen(true);
  }

  function openEditModal(student) {
    setEditingStudent(student);
    setForm({
      name: student.name,
      class_name: student.className || student.class_name,
      parent_mobile: student.parentMobile || student.parent_mobile || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.class_name.trim()) {
      showToast("Name and Class are required", "warning");
      return;
    }
    if (!form.parent_mobile.trim()) {
      showToast("Parent mobile number is required", "warning");
      return;
    }
    if (!/^\d{10}$/.test(form.parent_mobile.trim())) {
      showToast("Parent mobile must be a 10-digit number", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        class_name: form.class_name.trim(),
        parent_mobile: form.parent_mobile.trim(),
      };

      if (editingStudent) {
        await apiClient.put(`/admin/students/${editingStudent.id}`, payload);
        showToast("Student updated successfully", "success");
      } else {
        await apiClient.post("/admin/students", payload);
        showToast("Student added successfully", "success");
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err) {
      showToast(err.data?.error || "Operation failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/students/${deleteTarget.id}`);
      showToast("Student deleted successfully", "success");
      setDeleteTarget(null);
      fetchStudents();
    } catch (err) {
      showToast(err.data?.error || "Failed to delete student", "error");
    }
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm font-bold">
            {(row.name || '?').charAt(0)}
          </div>
          <span className="font-medium text-slate-900">{row.name || '—'}</span>
        </div>
      ),
    },
    {
      key: "className",
      label: "Class",
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
          {row.className || row.class_name}
        </span>
      ),
    },
    {
      key: "parentMobile",
      label: "Parent Mobile",
      render: (row) => (
        <span className="text-slate-600 text-sm font-mono">
          {row.parentMobile || row.parent_mobile || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage your school&apos;s student records
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Student
        </button>
      </div>

      {/* Class Filter */}
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">
            Filter by Class:
          </label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
          >
            <option value="">All Classes</option>
            {classes.map((cls) => {
              const name = cls.name || cls;
              return (
                <option key={name} value={name}>{name}</option>
              );
            })}
          </select>
          {classFilter && (
            <button
              onClick={() => setClassFilter("")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        onEdit={openEditModal}
        onDelete={(s) => setDeleteTarget(s)}
        emptyMessage="No students found. Add your first student to get started."
        searchable
        searchPlaceholder="Search students..."
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStudent ? "Edit Student" : "Add New Student"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter student&apos;s full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Class *
            </label>
            <select
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => {
                const name = cls.name || cls;
                return (
                  <option key={name} value={name}>{name}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Parent Mobile *
            </label>
            <input
              type="tel"
              value={form.parent_mobile}
              onChange={(e) =>
                setForm({
                  ...form,
                  parent_mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            {form.parent_mobile && form.parent_mobile.length < 10 && (
              <p className="text-xs text-amber-600 mt-1">
                {10 - form.parent_mobile.length} more digits needed
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
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
              {submitting
                ? "Saving..."
                : editingStudent
                ? "Update Student"
                : "Add Student"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteTarget?.name}? This will also remove their attendance and marks records.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
