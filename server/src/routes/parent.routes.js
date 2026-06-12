// ============================================================
// Parent Routes — /api/parent
// ============================================================
// All routes in this file are protected by requireAuth +
// requireRole('PARENT') middleware applied at mount level in
// src/index.js.
//
// SECURITY: Every endpoint is READ-ONLY. Endpoints that accept
// a :studentId parameter verify that the student belongs to the
// authenticated parent before returning any data.
// ============================================================

import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// ─── Helper Functions ───────────────────────────────────────

/**
 * Get all student IDs belonging to this parent.
 * Used to validate that the parent can only access their own children's data.
 *
 * @param {string} mobile - The parent's mobile number (auth_identifier)
 * @returns {Promise<number[]>} Array of student IDs owned by this parent
 */
async function getParentStudentIds(mobile) {
  const students = await prisma.student.findMany({
    where: { parentMobile: mobile },
    select: { id: true },
  });
  return students.map((s) => s.id);
}

/**
 * Verify a student belongs to this parent. Returns the student or null.
 * This is the primary guard against Insecure Direct Object Reference (IDOR).
 *
 * @param {string} mobile - The parent's mobile number (auth_identifier)
 * @param {number} studentId - The student ID to verify
 * @returns {Promise<object|null>} The student record, or null if not owned by this parent
 */
async function verifyParentOwnership(mobile, studentId) {
  return prisma.student.findFirst({
    where: { id: studentId, parentMobile: mobile },
  });
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * GET /api/parent/dashboard
 *
 * Returns an overview of the parent's children with summary statistics.
 * For each child, includes attendance summary (total/present/absent/percentage)
 * and a count of marks entries.
 *
 * Response shape:
 * {
 *   mobile: "9876543210",
 *   children: [{
 *     id, name, className,
 *     attendanceSummary: { total, present, absent, percentage },
 *     marksCount
 *   }]
 * }
 */
router.get("/dashboard", async (req, res) => {
  const mobile = req.user.auth_identifier;

  // Fetch all students belonging to this parent, including attendance + marks counts
  const students = await prisma.student.findMany({
    where: { parentMobile: mobile },
    include: {
      attendance: {
        select: { status: true },
      },
      marks: {
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Build the response with computed summaries for each child
  const children = students.map((student) => {
    const total = student.attendance.length;
    const present = student.attendance.filter(
      (a) => a.status === "PRESENT"
    ).length;
    const absent = total - present;
    // Avoid division by zero; percentage rounded to 1 decimal place
    const percentage = total > 0
      ? Math.round((present / total) * 1000) / 10
      : 0;

    return {
      id: student.id,
      name: student.name,
      className: student.className,
      attendanceSummary: { total, present, absent, percentage },
      marksCount: student.marks.length,
    };
  });

  res.json({ mobile, children });
});

/**
 * GET /api/parent/children
 *
 * Returns a detailed list of all children linked to the authenticated parent.
 * No summary statistics — just the student records.
 *
 * Response shape:
 * { children: [{ id, name, className, parentMobile, createdAt }] }
 */
router.get("/children", async (req, res) => {
  const mobile = req.user.auth_identifier;

  const children = await prisma.student.findMany({
    where: { parentMobile: mobile },
    select: {
      id: true,
      name: true,
      className: true,
      parentMobile: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  res.json({ children });
});

/**
 * GET /api/parent/children/:studentId/attendance
 *
 * Returns attendance records for a specific child.
 * Supports optional month/year query parameters for filtering.
 *
 * Query params:
 *   ?month=6&year=2026  — filters to June 2026
 *   (defaults to current month/year if not provided)
 *
 * Security: Validates parent ownership of the student.
 *
 * Response shape:
 * {
 *   student: { id, name, className },
 *   month: 6, year: 2026,
 *   attendance: [{ id, date, status }],
 *   summary: { total, present, absent, percentage }
 * }
 */
router.get("/children/:studentId/attendance", async (req, res) => {
  const mobile = req.user.auth_identifier;
  const studentId = parseInt(req.params.studentId, 10);

  // Validate the studentId is a valid integer
  if (isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student ID" });
  }

  // SECURITY: Verify the student belongs to this parent
  const student = await verifyParentOwnership(mobile, studentId);
  if (!student) {
    return res
      .status(403)
      .json({ error: "You do not have access to this student's data" });
  }

  // Parse month and year from query params, defaulting to current date
  const now = new Date();
  const month = parseInt(req.query.month, 10) || (now.getMonth() + 1); // getMonth() is 0-indexed
  const year = parseInt(req.query.year, 10) || now.getFullYear();

  // Validate month range
  if (month < 1 || month > 12) {
    return res
      .status(400)
      .json({ error: "Month must be between 1 and 12" });
  }

  // Build date range for the requested month
  // startDate = first day of the month at midnight UTC
  // endDate   = first day of the NEXT month at midnight UTC (exclusive upper bound)
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  // Fetch attendance records within the date range
  const attendance = await prisma.attendance.findMany({
    where: {
      studentId,
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      id: true,
      date: true,
      status: true,
    },
    orderBy: { date: "desc" },
  });

  // Compute summary statistics
  const total = attendance.length;
  const present = attendance.filter((a) => a.status === "PRESENT").length;
  const absent = total - present;
  const percentage = total > 0
    ? Math.round((present / total) * 1000) / 10
    : 0;

  res.json({
    student: {
      id: student.id,
      name: student.name,
      className: student.className,
    },
    month,
    year,
    attendance,
    summary: { total, present, absent, percentage },
  });
});

/**
 * GET /api/parent/children/:studentId/marks
 *
 * Returns marks for a specific child with subject and teacher info.
 * Supports optional exam_name query parameter for filtering.
 *
 * Query params:
 *   ?exam_name=Term+1  — filters to "Term 1" exam only
 *
 * Security: Validates parent ownership of the student.
 *
 * Response shape:
 * {
 *   student: { id, name, className },
 *   marks: [{
 *     id, subject: { id, name }, score, examName,
 *     teacher: { name }
 *   }],
 *   examNames: ["Term 1", "Mid-term"]
 * }
 */
router.get("/children/:studentId/marks", async (req, res) => {
  const mobile = req.user.auth_identifier;
  const studentId = parseInt(req.params.studentId, 10);

  // Validate the studentId is a valid integer
  if (isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student ID" });
  }

  // SECURITY: Verify the student belongs to this parent
  const student = await verifyParentOwnership(mobile, studentId);
  if (!student) {
    return res
      .status(403)
      .json({ error: "You do not have access to this student's data" });
  }

  // Build the where clause; optionally filter by exam name
  const whereClause = { studentId };
  const examNameFilter = req.query.exam_name;
  if (examNameFilter) {
    whereClause.examName = examNameFilter;
  }

  // Fetch marks with related subject and teacher data
  const marks = await prisma.mark.findMany({
    where: whereClause,
    select: {
      id: true,
      score: true,
      examName: true,
      maxScore: true,
      subject: {
        select: { id: true, name: true },
      },
      teacher: {
        select: { name: true },
      },
    },
    orderBy: [
      { examName: "asc" },
      { subject: { name: "asc" } },
    ],
  });

  // Collect all distinct exam names for this student (regardless of filter)
  // so the frontend can render a dropdown / tabs for exam selection
  const allMarks = await prisma.mark.findMany({
    where: { studentId },
    select: { examName: true },
    distinct: ["examName"],
    orderBy: { examName: "asc" },
  });
  const examNames = allMarks.map((m) => m.examName);

  res.json({
    student: {
      id: student.id,
      name: student.name,
      className: student.className,
    },
    marks,
    examNames,
  });
});

/**
 * GET /api/parent/children/:studentId/marks/summary
 *
 * Returns a subject-wise performance summary for a child.
 * Groups all marks by subject and computes average, highest, lowest
 * scores plus the total number of exams per subject.
 *
 * Security: Validates parent ownership of the student.
 *
 * Response shape:
 * {
 *   student: { id, name, className },
 *   subjectSummary: [{
 *     subject: { id, name },
 *     average, highest, lowest, totalExams,
 *     marks: [{ examName, score }]
 *   }]
 * }
 */
router.get("/children/:studentId/marks/summary", async (req, res) => {
  const mobile = req.user.auth_identifier;
  const studentId = parseInt(req.params.studentId, 10);

  // Validate the studentId is a valid integer
  if (isNaN(studentId)) {
    return res.status(400).json({ error: "Invalid student ID" });
  }

  // SECURITY: Verify the student belongs to this parent
  const student = await verifyParentOwnership(mobile, studentId);
  if (!student) {
    return res
      .status(403)
      .json({ error: "You do not have access to this student's data" });
  }

  // Fetch all marks for this student, grouped by subject
  const marks = await prisma.mark.findMany({
    where: { studentId },
    select: {
      score: true,
      maxScore: true,
      examName: true,
      subject: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { subject: { name: "asc" } },
      { examName: "asc" },
    ],
  });

  // Group marks by subject ID and compute per-subject aggregates
  const subjectMap = new Map();

  for (const mark of marks) {
    const subjectId = mark.subject.id;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subject: mark.subject,
        scores: [],
        marks: [],
      });
    }

    const entry = subjectMap.get(subjectId);
    entry.scores.push(mark.score);
    entry.marks.push({
      examName: mark.examName,
      score: mark.score,
      maxScore: mark.maxScore,
    });
  }

  // Transform the grouped data into the final summary array
  const subjectSummary = Array.from(subjectMap.values()).map((entry) => {
    const { scores } = entry;
    const sum = scores.reduce((acc, s) => acc + s, 0);
    // Round average to 1 decimal place for readability
    const average = Math.round((sum / scores.length) * 10) / 10;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    return {
      subject: entry.subject,
      average,
      highest,
      lowest,
      totalExams: scores.length,
      marks: entry.marks,
    };
  });

  res.json({
    student: {
      id: student.id,
      name: student.name,
      className: student.className,
    },
    subjectSummary,
  });
});

/**
 * GET /api/parent/announcements
 * Fetch all announcements targeted to PARENT or BOTH.
 */
router.get("/announcements", async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        target: { in: ["PARENT", "BOTH"] },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(announcements);
  } catch (error) {
    console.error("Parent fetch announcements error:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

export default router;
