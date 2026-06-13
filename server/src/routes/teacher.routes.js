// ============================================================
// Teacher Routes — /api/teacher
// ============================================================
// All routes in this file are protected by requireAuth +
// requireRole('TEACHER') middleware applied at mount level in
// src/index.js.
//
// The JWT payload for authenticated teachers contains:
//   { id: userId, role: 'TEACHER', auth_identifier: empId }
// So req.user.id = User.id, req.user.auth_identifier = Teacher.empId
//
// SECURITY: Every endpoint first resolves the Teacher profile
// from req.user.auth_identifier (emp_id) and verifies that the
// teacher is assigned to the requested class/subject before
// returning or modifying any data.
// ============================================================

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const router = Router();
const prisma = new PrismaClient();

// ─── Helper Functions ───────────────────────────────────────

/**
 * Finds a Teacher record by their employee ID, eagerly loading
 * all of their class/subject assignments with subject details.
 *
 * @param {string} empId - The teacher's employee identifier
 * @returns {Promise<object|null>} Teacher with assignments or null
 */
async function getTeacherByEmpId(empId) {
  return prisma.teacher.findFirst({
    where: { empId },
    include: {
      assignments: {
        include: { subject: true },
      },
    },
  });
}

/**
 * Checks whether a teacher has a valid assignment for a given
 * class (and optionally a specific subject). Used as a guard
 * before any data access or mutation on class/subject data.
 *
 * @param {number}      teacherId  - Teacher's primary key
 * @param {string}      className  - The class name to verify
 * @param {number|null} subjectId  - Optional subject ID to also verify
 * @returns {Promise<boolean>} true if assignment exists
 */
async function verifyTeacherAssignment(teacherId, className, subjectId = null) {
  const where = { teacherId, className };
  if (subjectId !== null && subjectId !== undefined) {
    where.subjectId = subjectId;
  }
  const assignment = await prisma.teacherAssignment.findFirst({ where });
  return !!assignment;
}

// ─── 1. GET /dashboard ──────────────────────────────────────

/**
 * GET /api/teacher/dashboard
 *
 * Fetches the authenticated teacher's profile and all of their
 * class-subject assignments. This is the landing page data.
 *
 * Response: {
 *   teacher: { id, name, empId },
 *   assignments: [{ id, className, subject: { id, name } }]
 * }
 */
router.get("/dashboard", async (req, res) => {
  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  res.json({
    teacher: {
      id: teacher.id,
      name: teacher.name,
      empId: teacher.empId,
    },
    assignments: teacher.assignments.map((a) => ({
      id: a.id,
      className: a.className,
      subject: {
        id: a.subject.id,
        name: a.subject.name,
      },
    })),
  });
});

// ─── 2. GET /my-classes ─────────────────────────────────────

/**
 * GET /api/teacher/my-classes
 *
 * Returns the distinct class names the teacher is assigned to.
 * Useful for populating class selector dropdowns in the UI.
 *
 * Response: { classes: ["10-A", "10-B", ...] }
 */
router.get("/my-classes", async (req, res) => {
  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Extract unique class names from assignments
  const classSet = new Set(teacher.assignments.map((a) => a.className));
  const classes = [...classSet].sort();

  res.json({ classes });
});

// ─── 3. GET /my-subjects ────────────────────────────────────

/**
 * GET /api/teacher/my-subjects
 *
 * Returns the distinct subjects the teacher is assigned to,
 * deduplicated by subject ID (a teacher may teach the same
 * subject in multiple classes).
 *
 * Response: { subjects: [{ id, name }, ...] }
 */
router.get("/my-subjects", async (req, res) => {
  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Deduplicate subjects by ID using a Map
  const subjectMap = new Map();
  for (const a of teacher.assignments) {
    if (!subjectMap.has(a.subject.id)) {
      subjectMap.set(a.subject.id, {
        id: a.subject.id,
        name: a.subject.name,
      });
    }
  }

  res.json({ subjects: [...subjectMap.values()] });
});

// ─── 4. GET /students ───────────────────────────────────────

/**
 * GET /api/teacher/students?class_name=10-A
 *
 * Fetches all students enrolled in a specific class. The teacher
 * must be assigned to the requested class; otherwise a 403 is
 * returned.
 *
 * Query params:
 *   - class_name (required): The class to list students for
 *
 * Response: { students: [{ id, name, className, parentMobile }] }
 */
router.get("/students", async (req, res) => {
  const { class_name } = req.query;

  if (!class_name) {
    return res.status(400).json({ error: "class_name query parameter is required" });
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class
  const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
  if (!isAssigned) {
    return res.status(403).json({ error: "You are not assigned to this class" });
  }

  const students = await prisma.student.findMany({
    where: { className: class_name },
    select: {
      id: true,
      name: true,
      className: true,
      parentMobile: true,
    },
    orderBy: { name: "asc" },
  });

  res.json({ students });
});

// ─── 5. GET /attendance ─────────────────────────────────────

/**
 * GET /api/teacher/attendance?class_name=10-A&date=2026-06-10
 *
 * Fetches attendance records for all students in a class on a
 * specific date. Students without an attendance record for that
 * date will have `attendance: null` (unmarked).
 *
 * Query params:
 *   - class_name (required): The class to fetch attendance for
 *   - date (required): Date in YYYY-MM-DD format
 *
 * Response: {
 *   students: [{ id, name, attendance: { id, status } | null }],
 *   date, className
 * }
 */
router.get("/attendance", async (req, res) => {
  const { class_name, date } = req.query;

  if (!class_name || !date) {
    return res
      .status(400)
      .json({ error: "class_name and date query parameters are required" });
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class
  const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
  if (!isAssigned) {
    return res.status(403).json({ error: "You are not assigned to this class" });
  }

  // Parse the date string into a UTC Date object (midnight)
  const attendanceDate = new Date(date + "T00:00:00.000Z");

  if (isNaN(attendanceDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  // Fetch students with their attendance for the specific date
  const students = await prisma.student.findMany({
    where: { className: class_name },
    select: {
      id: true,
      name: true,
      attendance: {
        where: { date: attendanceDate },
        select: { id: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Flatten: if attendance array is empty → null, else take first entry
  const result = students.map((s) => ({
    id: s.id,
    name: s.name,
    attendance: s.attendance.length > 0 ? s.attendance[0] : null,
  }));

  res.json({
    students: result,
    date,
    className: class_name,
  });
});

// ─── 6. POST /attendance ────────────────────────────────────

/**
 * POST /api/teacher/attendance
 *
 * Marks or updates attendance for multiple students in a class
 * on a given date. Uses upsert to handle both create and update
 * scenarios, wrapped in a transaction for atomicity.
 *
 * Body: {
 *   class_name: "10-A",
 *   date: "2026-06-10",
 *   records: [
 *     { student_id: 1, status: "PRESENT" },
 *     { student_id: 2, status: "ABSENT" }
 *   ]
 * }
 *
 * Response: { message: "Attendance saved", count: N }
 */
router.post("/attendance", async (req, res) => {
  const { class_name, date, records } = req.body;

  // ── Input validation ────────────────────────────────────
  if (!class_name || !date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      error: "class_name, date, and a non-empty records array are required",
    });
  }

  const attendanceDate = new Date(date + "T00:00:00.000Z");
  if (isNaN(attendanceDate.getTime())) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  // Validate status values
  const validStatuses = ["PRESENT", "ABSENT"];
  for (const record of records) {
    if (!record.student_id || !record.status) {
      return res.status(400).json({
        error: "Each record must have student_id and status",
      });
    }
    if (!validStatuses.includes(record.status)) {
      return res.status(400).json({
        error: `Invalid status "${record.status}". Must be PRESENT or ABSENT`,
      });
    }
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class
  const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
  if (!isAssigned) {
    return res.status(403).json({ error: "You are not assigned to this class" });
  }

  // Validate that all student_ids belong to the given class
  const studentIds = records.map((r) => r.student_id);
  const validStudents = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      className: class_name,
    },
    select: { id: true },
  });

  const validStudentIds = new Set(validStudents.map((s) => s.id));
  const invalidIds = studentIds.filter((id) => !validStudentIds.has(id));

  if (invalidIds.length > 0) {
    return res.status(400).json({
      error: `Students with IDs [${invalidIds.join(", ")}] do not belong to class ${class_name}`,
    });
  }

  // ── Upsert attendance in a transaction ──────────────────
  const upserts = records.map((record) =>
    prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId: record.student_id,
          date: attendanceDate,
        },
      },
      update: { status: record.status },
      create: {
        studentId: record.student_id,
        date: attendanceDate,
        status: record.status,
      },
    })
  );

  await prisma.$transaction(upserts);

  res.json({ message: "Attendance saved", count: records.length });
});

// ─── 7. GET /marks ──────────────────────────────────────────

/**
 * GET /api/teacher/marks?class_name=10-A&subject_id=1&exam_name=Term+1
 *
 * Fetches marks for all students in a class for a specific
 * subject and exam. Students without a mark record will have
 * `mark: null`.
 *
 * Query params:
 *   - class_name  (required): The class
 *   - subject_id  (required): The subject ID
 *   - exam_name   (required): The exam name
 *
 * Response: {
 *   students: [{ id, name, mark: { id, score, examName } | null }],
 *   className, subject, examName
 * }
 */
router.get("/marks", async (req, res) => {
  const { class_name, subject_id, exam_name } = req.query;

  if (!class_name || !subject_id || !exam_name) {
    return res.status(400).json({
      error: "class_name, subject_id, and exam_name query parameters are required",
    });
  }

  const subjectIdInt = parseInt(subject_id, 10);
  if (isNaN(subjectIdInt)) {
    return res.status(400).json({ error: "subject_id must be a valid integer" });
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class + subject
  const isAssigned = await verifyTeacherAssignment(
    teacher.id,
    class_name,
    subjectIdInt
  );
  if (!isAssigned) {
    return res.status(403).json({
      error: "You are not assigned to this class and subject combination",
    });
  }

  // Look up the subject for the response payload
  const subject = await prisma.subject.findUnique({
    where: { id: subjectIdInt },
    select: { id: true, name: true },
  });

  if (!subject) {
    return res.status(404).json({ error: "Subject not found" });
  }

  // Fetch students with their marks for this subject + exam
  const students = await prisma.student.findMany({
    where: { className: class_name },
    select: {
      id: true,
      name: true,
      marks: {
        where: {
          subjectId: subjectIdInt,
          examName: exam_name,
        },
        select: { id: true, score: true, examName: true, maxScore: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Flatten: marks array → single mark or null
  const result = students.map((s) => ({
    id: s.id,
    name: s.name,
    mark: s.marks.length > 0 ? s.marks[0] : null,
  }));

  res.json({
    students: result,
    className: class_name,
    subject,
    examName: exam_name,
  });
});

// ─── 8. POST /marks ─────────────────────────────────────────

/**
 * POST /api/teacher/marks
 *
 * Uploads or updates marks for multiple students in a class
 * for a given subject and exam. Uses upsert with a transaction.
 *
 * Body: {
 *   class_name: "10-A",
 *   subject_id: 1,
 *   exam_name: "Term 1",
 *   total_mark: 100, // Optional; defaults to 100
 *   marks: [
 *     { student_id: 1, score: 85.5 },
 *     { student_id: 2, score: 72 }
 *   ]
 * }
 *
 * Response: { message: "Marks saved", count: N }
 */
router.post("/marks", async (req, res) => {
  const { class_name, subject_id, exam_name, marks, total_mark } = req.body;

  // ── Input validation ────────────────────────────────────
  if (!class_name || subject_id === undefined || !exam_name || !Array.isArray(marks) || marks.length === 0) {
    return res.status(400).json({
      error: "class_name, subject_id, exam_name, and a non-empty marks array are required",
    });
  }

  if (typeof exam_name !== "string" || exam_name.trim() === "") {
    return res.status(400).json({ error: "exam_name must be a non-empty string" });
  }

  const subjectIdInt = parseInt(subject_id, 10);
  if (isNaN(subjectIdInt)) {
    return res.status(400).json({ error: "subject_id must be a valid integer" });
  }

  const maxScoreVal = total_mark !== undefined ? parseFloat(total_mark) : 100;
  if (isNaN(maxScoreVal) || maxScoreVal <= 0) {
    return res.status(400).json({ error: "total_mark must be a positive number" });
  }

  // Validate individual mark entries
  for (const entry of marks) {
    if (!entry.student_id) {
      return res.status(400).json({ error: "Each mark entry must have a student_id" });
    }
    if (typeof entry.score !== "number" || isNaN(entry.score)) {
      return res.status(400).json({
        error: `Invalid score for student_id ${entry.student_id}. Score must be a number`,
      });
    }
    if (entry.score < 0 || entry.score > maxScoreVal) {
      return res.status(400).json({
        error: `Score ${entry.score} for student_id ${entry.student_id} is out of range. Must be between 0 and ${maxScoreVal}`,
      });
    }
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class + subject
  const isAssigned = await verifyTeacherAssignment(
    teacher.id,
    class_name,
    subjectIdInt
  );
  if (!isAssigned) {
    return res.status(403).json({
      error: "You are not assigned to this class and subject combination",
    });
  }

  // Validate that all student_ids belong to the given class
  const studentIds = marks.map((m) => m.student_id);
  const validStudents = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      className: class_name,
    },
    select: { id: true },
  });

  const validStudentIds = new Set(validStudents.map((s) => s.id));
  const invalidIds = studentIds.filter((id) => !validStudentIds.has(id));

  if (invalidIds.length > 0) {
    return res.status(400).json({
      error: `Students with IDs [${invalidIds.join(", ")}] do not belong to class ${class_name}`,
    });
  }

  // ── Upsert marks in a transaction ───────────────────────
  const upserts = marks.map((entry) =>
    prisma.mark.upsert({
      where: {
        studentId_subjectId_examName: {
          studentId: entry.student_id,
          subjectId: subjectIdInt,
          examName: exam_name.trim(),
        },
      },
      update: {
        score: entry.score,
        maxScore: maxScoreVal,
        teacherId: teacher.id, // Update teacher in case of re-assignment
      },
      create: {
        studentId: entry.student_id,
        subjectId: subjectIdInt,
        teacherId: teacher.id,
        score: entry.score,
        maxScore: maxScoreVal,
        examName: exam_name.trim(),
      },
    })
  );

  await prisma.$transaction(upserts);

  res.json({ message: "Marks saved", count: marks.length });
});

// ─── 9. GET /exams ──────────────────────────────────────────

/**
 * GET /api/teacher/exams?subject_id=1&class_name=10-A
 *
 * Returns the distinct exam names for a given subject within a
 * class. This lets the teacher see which exams already have
 * marks recorded.
 *
 * Query params:
 *   - subject_id  (required): The subject ID
 *   - class_name  (required): The class name
 *
 * Response: { exams: ["Term 1", "Mid-term", ...] }
 */
router.get("/exams", async (req, res) => {
  const { subject_id, class_name } = req.query;

  if (!subject_id || !class_name) {
    return res.status(400).json({
      error: "subject_id and class_name query parameters are required",
    });
  }

  const subjectIdInt = parseInt(subject_id, 10);
  if (isNaN(subjectIdInt)) {
    return res.status(400).json({ error: "subject_id must be a valid integer" });
  }

  const teacher = await getTeacherByEmpId(req.user.auth_identifier);

  if (!teacher) {
    return res.status(404).json({ error: "Teacher profile not found" });
  }

  // Authorization: teacher must be assigned to this class + subject
  const isAssigned = await verifyTeacherAssignment(
    teacher.id,
    class_name,
    subjectIdInt
  );
  if (!isAssigned) {
    return res.status(403).json({
      error: "You are not assigned to this class and subject combination",
    });
  }

  // Find all students in the class, then query distinct exam names
  // from marks for those students and this subject
  const studentsInClass = await prisma.student.findMany({
    where: { className: class_name },
    select: { id: true },
  });

  const studentIds = studentsInClass.map((s) => s.id);

  // Use groupBy to get distinct examName values
  const examGroups = await prisma.mark.groupBy({
    by: ["examName"],
    where: {
      subjectId: subjectIdInt,
      studentId: { in: studentIds },
    },
    orderBy: { examName: "asc" },
  });

  const exams = examGroups.map((g) => g.examName);

  res.json({ exams });
});

// ─── 10. POST /change-password ────────────────────────────────

/**
 * POST /api/teacher/change-password
 *
 * Changes the authenticated teacher's password and sets mustChangePassword to false.
 */
router.post("/change-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password is required." });
    }

    const userId = req.user.id;
    const empId = req.user.auth_identifier;

    // Find the teacher profile to verify
    const teacher = await prisma.teacher.findFirst({
      where: { userId, empId },
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found." });
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Update password hash and mustChangePassword
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password_hash },
      }),
      prisma.teacher.update({
        where: { id: teacher.id },
        data: { mustChangePassword: false },
      }),
    ]);

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to update password." });
  }
});

/**
 * GET /api/teacher/announcements
 * Fetch all announcements targeted to TEACHER or BOTH.
 */
router.get("/announcements", async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        target: { in: ["TEACHER", "BOTH"] },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(announcements);
  } catch (error) {
    console.error("Teacher fetch announcements error:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

export default router;
