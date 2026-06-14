// ============================================================
// Teacher Routes — /api/teacher
// ============================================================
// All routes in this file are protected by requireAuth +
// requireRole('TEACHER') middleware applied at mount level in
// server.js.
//
// The JWT payload for authenticated teachers contains:
//   { id: userId, role: 'TEACHER', auth_identifier: empId }
// So req.user.id = User.id, req.user.auth_identifier = Teacher.empId
//
// SECURITY: Every endpoint first resolves the Teacher profile
// from req.user.auth_identifier (employeeId) and verifies that the
// teacher is assigned to the requested class/subject before
// returning or modifying any data. No bypass mock layers allowed.
// ============================================================

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const router = Router();
const prisma = new PrismaClient();

// ─── Helper Functions (NO BYPASS - STRICT DATA MATCHING) ─────

/**
 * Finds a Teacher record by their employee ID from the token context,
 * eagerly loading all of their class/subject assignments.
 *
 * @param {string} empId - The teacher's unique employee identifier
 * @returns {Promise<object|null>} Teacher with assignments or null
 */
async function getTeacherByEmpId(empId) {
  if (!empId) return null;

  return prisma.teacher.findFirst({
    where: { employeeId: String(empId).trim() },
    include: {
      assignments: {
        include: { subject: true },
      },
    },
  });
}

/**
 * Checks whether a teacher has a valid assignment for a given
 * class (and optionally a specific subject UUID). Used as a strict RBAC guard.
 *
 * @param {string}      teacherId  - Teacher's primary key UUID String
 * @param {string}      className  - The class name to verify
 * @param {string|null} subjectId  - Optional subject UUID String to verify
 * @returns {Promise<boolean>} true if assignment exists
 */
async function verifyTeacherAssignment(teacherId, className, subjectId = null) {
  const where = { teacherId, className: String(className).trim() };
  
  if (subjectId !== null && subjectId !== undefined) {
    where.subjectId = String(subjectId).trim();
  }

  const assignment = await prisma.teacherAssignment.findFirst({ where });
  return !!assignment;
}

// ─── 1. GET /dashboard ──────────────────────────────────────

/**
 * GET /api/teacher/dashboard
 */
router.get("/dashboard", async (req, res) => {
  try {
    const teacher = await getTeacherByEmpId(req.user.auth_identifier);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile matching active login credentials not found" });
    }

    res.json({
      teacher: {
        id: teacher.id,
        name: teacher.name,
        empId: teacher.employeeId,
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
  } catch (error) {
    console.error("🔥 Dashboard Fetch Error:", error);
    res.status(500).json({ error: "Internal server error reading dashboard profiling aggregates." });
  }
});

// ─── 2. GET /my-classes ─────────────────────────────────────

/**
 * GET /api/teacher/my-classes
 */
router.get("/my-classes", async (req, res) => {
  try {
    const teacher = await getTeacherByEmpId(req.user.auth_identifier);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile context not found" });
    }

    const classSet = new Set(teacher.assignments.map((a) => a.className));
    const classes = [...classSet].sort();

    res.json({ classes });
  } catch (error) {
    console.error("🔥 My Classes Fetch Error:", error);
    res.status(500).json({ error: "Internal server error parsing assigned classroom namespaces." });
  }
});

// ─── 3. GET /my-subjects ────────────────────────────────────

/**
 * GET /api/teacher/my-subjects
 */
router.get("/my-subjects", async (req, res) => {
  try {
    const teacher = await getTeacherByEmpId(req.user.auth_identifier);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile context not found" });
    }

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
  } catch (error) {
    console.error("🔥 My Subjects Fetch Error:", error);
    res.status(500).json({ error: "Internal server error checking subject allocations." });
  }
});

// ─── 4. GET /students ───────────────────────────────────────

/**
 * GET /api/teacher/students?class_name=10-A
 */
router.get("/students", async (req, res) => {
  try {
    const { class_name } = req.query;

    if (!class_name) {
      return res.status(400).json({ error: "class_name query parameter is required" });
    }

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile context not found" });
    }

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
    if (!isAssigned) {
      return res.status(403).json({ error: "Access Denied: You are not assigned to manage this classroom segment" });
    }

    const students = await prisma.student.findMany({
      where: { className: String(class_name).trim() },
      select: {
        id: true,
        name: true,
        className: true,
        parentMobile: true,
      },
      orderBy: { name: "asc" },
    });

    res.json({ students });
  } catch (error) {
    console.error("🔥 Students Listing Fetch Error:", error);
    res.status(500).json({ error: "Internal server error looking up classroom enrollment registers." });
  }
});

// ─── 5. GET /attendance ─────────────────────────────────────

/**
 * GET /api/teacher/attendance?class_name=10-A&date=2026-06-14
 */
router.get("/attendance", async (req, res) => {
  try {
    const { class_name, date } = req.query;

    if (!class_name || !date) {
      return res.status(400).json({ error: "class_name and date query parameters are required" });
    }

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher context missing" });
    }

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
    if (!isAssigned) {
      return res.status(403).json({ error: "Access Denied: Classroom unallocated to active session identifier" });
    }

    const attendanceDate = new Date(date + "T00:00:00.000Z");
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const students = await prisma.student.findMany({
      where: { className: String(class_name).trim() },
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
  } catch (error) {
    console.error("🔥 Attendance Fetch Error:", error);
    res.status(500).json({ error: "Internal server error processing attendance sheets." });
  }
});

// ─── 6. POST /attendance ────────────────────────────────────

/**
 * POST /api/teacher/attendance
 */
router.post("/attendance", async (req, res) => {
  try {
    const { class_name, date, records } = req.body;

    if (!class_name || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "class_name, date, and a non-empty records array are required" });
    }

    const attendanceDate = new Date(date + "T00:00:00.000Z");
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name);
    if (!isAssigned) {
      return res.status(403).json({ error: "Unauthorized access path attempted on target resource" });
    }

    const studentIds = records.map((r) => String(r.student_id));
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        className: String(class_name).trim(),
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
    res.json({ message: "Attendance records securely written to database storage engine", count: records.length });
  } catch (error) {
    console.error("🔥 Attendance Mutation Process Error:", error);
    res.status(500).json({ error: "Internal server error persisting modified tracking records." });
  }
});

// ─── 7. GET /marks ──────────────────────────────────────────

/**
 * GET /api/teacher/marks?class_name=10-A&subject_id=uuid-here&exam_name=Term+1
 */
router.get("/marks", async (req, res) => {
  try {
    const { class_name, subject_id, exam_name } = req.query;

    if (!class_name || !subject_id || !exam_name) {
      return res.status(400).json({
        error: "class_name, subject_id, and exam_name query parameters are required",
      });
    }

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const targetSubjectId = String(subject_id).trim();

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name, targetSubjectId);
    if (!isAssigned) {
      return res.status(403).json({
        error: "You are not assigned to this class and subject combination",
      });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: targetSubjectId },
      select: { id: true, name: true },
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject context database item completely missing" });
    }

    const students = await prisma.student.findMany({
      where: { className: String(class_name).trim() },
      select: {
        id: true,
        name: true,
        marks: {
          where: {
            subjectId: targetSubjectId,
            examName: String(exam_name).trim(),
          },
          select: { id: true, marksObtained: true, examName: true, maxMarks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = students.map((s) => ({
      id: s.id,
      name: s.name,
      mark: s.marks.length > 0 ? {
        id: s.marks[0].id,
        score: s.marks[0].marksObtained, 
        examName: s.marks[0].examName,
        maxScore: s.marks[0].maxMarks
      } : null,
    }));

    res.json({
      students: result,
      className: class_name,
      subject,
      examName: exam_name,
    });
  } catch (error) {
    console.error("🔥 Marks Fetch Error:", error);
    res.status(500).json({ error: "Internal server error fetching grade books." });
  }
});

// ─── 8. POST /marks ─────────────────────────────────────────

/**
 * POST /api/teacher/marks
 */
router.post("/marks", async (req, res) => {
  try {
    const { class_name, subject_id, exam_name, marks, total_mark } = req.body;

    if (!class_name || !subject_id || !exam_name || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ error: "class_name, subject_id, exam_name, and a non-empty marks array are required" });
    }

    const targetSubjectId = String(subject_id).trim();
    const maxScoreVal = total_mark !== undefined ? parseFloat(total_mark) : 100;

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name, targetSubjectId);
    if (!isAssigned) {
      return res.status(403).json({ error: "Forbidden: Relational verification mapping validation failed" });
    }

    const studentIds = marks.map((m) => String(m.student_id));
    const validStudents = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        className: String(class_name).trim(),
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

    const upserts = marks.map((entry) =>
      prisma.mark.upsert({
        where: {
          studentId_subjectId_examName: {
            studentId: entry.student_id,
            subjectId: targetSubjectId,
            examName: String(exam_name).trim(),
          },
        },
        update: {
          marksObtained: entry.score,
          maxMarks: maxScoreVal,
          teacherId: teacher.id,
        },
        create: {
          studentId: entry.student_id,
          subjectId: targetSubjectId,
          teacherId: teacher.id,
          marksObtained: entry.score,
          maxMarks: maxScoreVal,
          examName: String(exam_name).trim(),
        },
      })
    );

    await prisma.$transaction(upserts);
    res.json({ message: "Marks saved directly to live tracking index", count: marks.length });
  } catch (error) {
    console.error("🔥 Marks Update Write Transaction Error:", error);
    res.status(500).json({ error: "Internal server error recording student grade matrix points." });
  }
});

// ─── 9. GET /exams ──────────────────────────────────────────

/**
 * GET /api/teacher/exams?subject_id=uuid&class_name=10-A
 */
router.get("/exams", async (req, res) => {
  try {
    const { subject_id, class_name } = req.query;

    if (!subject_id || !class_name) {
      return res.status(400).json({ error: "subject_id and class_name query parameters are required" });
    }

    const teacher = await getTeacherByEmpId(req.user.auth_identifier);
    if (!teacher) {
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    const targetSubjectId = String(subject_id).trim();

    const isAssigned = await verifyTeacherAssignment(teacher.id, class_name, targetSubjectId);
    if (!isAssigned) {
      return res.status(403).json({ error: "You are not assigned to this class and subject configuration" });
    }

    const studentsInClass = await prisma.student.findMany({
      where: { className: String(class_name).trim() },
      select: { id: true },
    });

    const studentIds = studentsInClass.map((s) => s.id);

    const examGroups = await prisma.mark.groupBy({
      by: ["examName"],
      where: {
        subjectId: targetSubjectId,
        studentId: { in: studentIds },
      },
      orderBy: { examName: "asc" },
    });

    res.json({ exams: examGroups.map((g) => g.examName) });
  } catch (error) {
    console.error("🔥 Distinct Exam Name Tabulation Error:", error);
    res.status(500).json({ error: "Internal server error aggregating matching assessment descriptors." });
  }
});

// ─── 10. POST /change-password ────────────────────────────────

/**
 * POST /api/teacher/change-password
 */
router.post("/change-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: "New password payload is required" });
    }

    const userId = req.user.id;
    const empId = req.user.auth_identifier;

    const teacher = await prisma.teacher.findFirst({
      where: { userId, employeeId: empId },
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher verification context match failed" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.teacher.update({
        where: { id: teacher.id },
        data: { mustChangePassword: false },
      }),
    ]);

    res.json({ message: "Password updated successfully inside active user index matrix" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to update security credentials records" });
  }
});

export default router;
