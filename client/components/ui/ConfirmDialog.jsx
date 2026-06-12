"use client";

import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  type = "danger",
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onCancel();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onCancel]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onCancel();
  };

  if (!isOpen) return null;

  const isDanger = type === "danger";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="max-w-sm w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        <div className="p-6 text-center">
          {/* Icon */}
          <div
            className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              isDanger ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
            }`}
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1 1 0 002.56 20h16.88a1 1 0 00.87-1.28l-8.6-14.86a1 1 0 00-1.72 0z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 mb-6">{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors ${
                isDanger
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
