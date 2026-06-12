"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import DataTable from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function AnnouncementsPage() {
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    target: "BOTH", // Default to BOTH
  });

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/announcements");
      setAnnouncements(res || []);
    } catch (err) {
      showToast(err.data?.error || "Failed to load announcements", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  function openAddModal() {
    setForm({ title: "", content: "", target: "BOTH" });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Title is required", "warning");
      return;
    }
    if (!form.content.trim()) {
      showToast("Message content is required", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post("/admin/announcements", {
        title: form.title.trim(),
        content: form.content.trim(),
        target: form.target,
      });
      showToast("Announcement posted successfully", "success");
      setModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      showToast(err.data?.error || "Failed to post announcement", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/admin/announcements/${deleteTarget.id}`);
      showToast("Announcement deleted successfully", "success");
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch (err) {
      showToast(err.data?.error || "Failed to delete announcement", "error");
    }
  }

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <div className="font-semibold text-slate-900">{row.title}</div>
      ),
    },
    {
      key: "content",
      label: "Message",
      render: (row) => (
        <div className="max-w-md truncate text-slate-600" title={row.content}>
          {row.content}
        </div>
      ),
    },
    {
      key: "target",
      label: "Audience",
      render: (row) => {
        let bg = "bg-emerald-50 text-emerald-700 border-emerald-200";
        let label = "Both";
        if (row.target === "TEACHER") {
          bg = "bg-blue-50 text-blue-700 border-blue-200";
          label = "Teachers Only";
        } else if (row.target === "PARENT") {
          bg = "bg-purple-50 text-purple-700 border-purple-200";
          label = "Parents Only";
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-semibold ${bg}`}>
            {label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Posted Date",
      render: (row) => (
        <span className="text-slate-500 text-xs">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>📢</span> Announcements
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create and manage school notices for teachers, parents, or both.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm shadow-blue-500/20 hover:shadow-blue-500/30"
        >
          <span>➕</span> Post Announcement
        </button>
      </div>

      {/* Main announcements table */}
      <DataTable
        columns={columns}
        data={announcements}
        loading={loading}
        onDelete={(row) => setDeleteTarget(row)}
        emptyMessage="No announcements found. Click 'Post Announcement' to create one."
      />

      {/* Create Announcement Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. School Holiday Notice, Staff Meeting"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Message Content
            </label>
            <textarea
              required
              rows={4}
              placeholder="Write the details of the announcement here..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Target Audience
            </label>
            <select
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="BOTH">Both (Teachers & Parents)</option>
              <option value="TEACHER">Teachers Only</option>
              <option value="PARENT">Parents Only</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              {submitting ? "Posting..." : "Post Announcement"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm deletion dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Announcement"
        message={`Are you sure you want to delete the announcement "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
