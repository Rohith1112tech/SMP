// ============================================================
// Admin Routes — /api/admin
// ============================================================
// All routes in this file are protected by requireAuth +
// requireRole('ADMIN') middleware applied at mount level in
// src/index.js, so no per-route guards are needed here.
//
// Provides full CRUD for:
//   - Dashboard statistics
//   - Teachers (with linked User records)
//   - Students (with auto-created Parent users)
//   - Subjects
//   - Teacher ↔ Class ↔ Subject assignments
//   - Distinct class listing
// ============================================================

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const router = Router();
const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────

/**
 * Parse pagination query params with sensible defaults.
 * @param {object} query - Express req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build a standard paginated response envelope.
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 *
 * Returns aggregate statistics for the admin overview panel:
 *   - totalStudents, totalTeachers, totalSubjects
 *   - totalClasses (distinct class_name values)
 *   - recentStudents (last 5 created)
 *   - recentTeachers (last 5 created)
 */
router.get("/dashboard", async (req, res) => {
  try {
    // Fire independent counts in parallel for speed
    const [
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalClasses,
      recentStudents,
      recentTeachers,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.subject.count(),
      prisma.class.count(),
      prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { parent: { select: { auth_identifier: true } } },
      }),
      prisma.teacher.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { user: { select: { auth_identifier: true, role: true } } },
      }),
    ]);

    res.json({
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalClasses,
      recentStudents,
      recentTeachers,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
});

// ─────────────────────────────────────────────────────────────
// TEACHERS CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/teachers
 *
 * List all teachers with their linked User record.
 * Query params:
 *   ?search=<name>  — case-insensitive partial match on teacher name
 *   ?page=1         — page number (1-indexed)
 *   ?limit=10       — items per page (max 100)
 */
router.get("/teachers", async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search } = req.query;

    // Build a dynamic Prisma `where` clause
    // Note: MySQL collations are case-insensitive by default,
    // so mode:'insensitive' (PostgreSQL-only) is not needed here.
    const where = search
      ? { name: { contains: search } }
      : {};

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              auth_identifier: true,
              createdAt: true,
            },
          },
          assignments: {
            include: {
              subject: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.teacher.count({ where }),
    ]);

    res.json(paginatedResponse(teachers, total, page, limit));
  } catch (error) {
    console.error("List teachers error:", error);
    res.status(500).json({ error: "Failed to list teachers" });
  }
});

/**
 * GET /api/admin/teachers/:id
 *
 * Get a single teacher by ID, including user info and all
 * class↔subject assignments.
 */
router.get("/teachers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            auth_identifier: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        assignments: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    res.json(teacher);
  } catch (error) {
    console.error("Get teacher error:", error);
    res.status(500).json({ error: "Failed to fetch teacher" });
  }
});

/**
 * POST /api/admin/teachers
 *
 * Create a new teacher and its associated User record in a
 * single transaction.
 *
 * Body: { name, emp_id, password, email? }
 *   - name:     Display name for the teacher
 *   - emp_id:   Unique employee ID (also used as auth_identifier)
 *   - password: Plain-text password (hashed before storage)
 *   - email:    Optional; stored for reference but not used for auth
 */
router.post("/teachers", async (req, res) => {
  try {
    const { name, emp_id, phone } = req.body;

    // ── Validation ──
    if (!name || !emp_id) {
      return res
        .status(400)
        .json({ error: "name and emp_id are required" });
    }

    // Check for duplicate emp_id (which doubles as auth_identifier)
    const existingUser = await prisma.user.findUnique({
      where: { auth_identifier: emp_id },
    });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: `A user with identifier "${emp_id}" already exists` });
    }

    // Check for duplicate phone if provided
    if (phone) {
      const existingPhone = await prisma.teacher.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        return res
          .status(409)
          .json({ error: `A teacher with phone number "${phone}" already exists` });
      }
    }

    // Auto-generate default password: teacher + digits of emp_id
    const digits = emp_id.replace(/\D/g, "");
    const defaultPass = "teacher" + (digits || "001");

    // Hash the password with a cost factor of 10
    const password_hash = await bcrypt.hash(defaultPass, 10);

    // Create User + Teacher atomically
    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: "TEACHER",
          auth_identifier: emp_id,
          password_hash,
        },
      });

      return tx.teacher.create({
        data: {
          userId: user.id,
          name,
          empId: emp_id,
          phone: phone || null,
          mustChangePassword: true,
        },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              auth_identifier: true,
              createdAt: true,
            },
          },
        },
      });
    });

    res.status(201).json(teacher);
  } catch (error) {
    console.error("Create teacher error:", error);

    // Prisma unique-constraint violation
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A teacher with this employee ID or phone number already exists",
      });
    }

    res.status(500).json({ error: "Failed to create teacher" });
  }
});

/**
 * PUT /api/admin/teachers/:id
 *
 * Update an existing teacher's profile and (optionally) password.
 *
 * Body: { name?, emp_id?, password? }
 *   - If emp_id changes, User.auth_identifier is updated too.
 *   - If password is provided, User.password_hash is re-hashed.
 */
router.put("/teachers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    const { name, emp_id, phone, password } = req.body;

    // Ensure the teacher exists before attempting an update
    const existing = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    // If emp_id is changing, verify the new one isn't already taken
    if (emp_id && emp_id !== existing.empId) {
      const duplicate = await prisma.user.findUnique({
        where: { auth_identifier: emp_id },
      });
      if (duplicate) {
        return res
          .status(409)
          .json({ error: `Identifier "${emp_id}" is already in use` });
      }
    }

    // If phone is changing, verify the new one isn't already taken
    if (phone && phone !== existing.phone) {
      const duplicatePhone = await prisma.teacher.findUnique({
        where: { phone },
      });
      if (duplicatePhone) {
        return res
          .status(409)
          .json({ error: `Phone number "${phone}" is already in use` });
      }
    }

    // Build dynamic update payloads so we only touch changed fields
    const teacherData = {};
    if (name) teacherData.name = name;
    if (emp_id) teacherData.empId = emp_id;
    if (phone !== undefined) teacherData.phone = phone || null;

    const userData = {};
    if (emp_id) userData.auth_identifier = emp_id;
    if (password) {
      userData.password_hash = await bcrypt.hash(password, 10);
      teacherData.mustChangePassword = true; // force change on next login
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update the User record if there's anything to change
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      }

      return tx.teacher.update({
        where: { id },
        data: teacherData,
        include: {
          user: {
            select: {
              id: true,
              role: true,
              auth_identifier: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    });

    res.json(updated);
  } catch (error) {
    console.error("Update teacher error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A teacher with this employee ID already exists",
      });
    }

    res.status(500).json({ error: "Failed to update teacher" });
  }
});

/**
 * DELETE /api/admin/teachers/:id
 *
 * Fully removes a teacher and all dependent data:
 *   1. Delete TeacherAssignments for this teacher
 *   2. Delete Marks graded by this teacher
 *   3. Delete the Teacher record
 *   4. Delete the linked User record
 *
 * Wrapped in a transaction so partial deletes can't occur.
 */
router.delete("/teachers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    await prisma.$transaction(async (tx) => {
      // Remove all assignments this teacher has
      await tx.teacherAssignment.deleteMany({ where: { teacherId: id } });
      // Remove all marks entered by this teacher
      await tx.mark.deleteMany({ where: { teacherId: id } });
      // Remove the Teacher profile itself
      await tx.teacher.delete({ where: { id } });
      // Finally remove the login User record
      await tx.user.delete({ where: { id: teacher.userId } });
    });

    res.json({ message: "Teacher deleted successfully" });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ error: "Failed to delete teacher" });
  }
});

// ─────────────────────────────────────────────────────────────
// STUDENTS CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/students
 *
 * List students with parent info.
 * Query params:
 *   ?search=<name>   — partial match on student name
 *   ?class=<10-A>    — exact match on class_name
 *   ?page=1&limit=10 — pagination
 */
router.get("/students", async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search } = req.query;
    // "class" is a reserved word in JS, so use bracket notation
    const className = req.query.class;

    const where = {};
    if (search) {
      where.name = { contains: search };
    }
    if (className) {
      where.className = className;
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          parent: {
            select: {
              id: true,
              auth_identifier: true,
              role: true,
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    res.json(paginatedResponse(students, total, page, limit));
  } catch (error) {
    console.error("List students error:", error);
    res.status(500).json({ error: "Failed to list students" });
  }
});

/**
 * GET /api/admin/students/:id
 *
 * Get a single student with:
 *   - Parent user details
 *   - Attendance summary (total, present, absent counts)
 *   - All marks with subject and teacher names
 */
router.get("/students/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            auth_identifier: true,
            role: true,
          },
        },
        attendance: {
          orderBy: { date: "desc" },
        },
        marks: {
          include: {
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Compute a compact attendance summary from the raw records
    const attendanceSummary = {
      total: student.attendance.length,
      present: student.attendance.filter((a) => a.status === "PRESENT").length,
      absent: student.attendance.filter((a) => a.status === "ABSENT").length,
    };

    res.json({
      ...student,
      attendanceSummary,
    });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({ error: "Failed to fetch student" });
  }
});

/**
 * POST /api/admin/students
 *
 * Create a student. If the parent mobile doesn't already belong
 * to a PARENT user, a new User is auto-created (passwordless —
 * parents authenticate via OTP).
 *
 * Body: { name, class_name, parent_mobile, parent_name? }
 */
router.post("/students", async (req, res) => {
  try {
    const { name, class_name, parent_mobile } = req.body;

    if (!name || !class_name || !parent_mobile) {
      return res
        .status(400)
        .json({ error: "name, class_name, and parent_mobile are required" });
    }

    // Ensure a PARENT user exists for this mobile number
    let parentUser = await prisma.user.findUnique({
      where: { auth_identifier: parent_mobile },
    });

    if (!parentUser) {
      // Auto-create a passwordless parent user
      parentUser = await prisma.user.create({
        data: {
          role: "PARENT",
          auth_identifier: parent_mobile,
          // password_hash stays null — parents use OTP
        },
      });
    } else if (parentUser.role !== "PARENT") {
      // The mobile number is already taken by a non-parent user
      return res.status(409).json({
        error: `The identifier "${parent_mobile}" belongs to a ${parentUser.role} user, not a PARENT`,
      });
    }

    const student = await prisma.student.create({
      data: {
        name,
        className: class_name,
        parentMobile: parent_mobile,
      },
      include: {
        parent: {
          select: {
            id: true,
            auth_identifier: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error("Create student error:", error);
    res.status(500).json({ error: "Failed to create student" });
  }
});

/**
 * PUT /api/admin/students/:id
 *
 * Update student details. If parent_mobile is changed, the new
 * parent user is checked/created just like in POST.
 *
 * Body: { name?, class_name?, parent_mobile? }
 */
router.put("/students/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const { name, class_name, parent_mobile } = req.body;

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Student not found" });
    }

    // If the parent mobile is changing, ensure a PARENT user exists
    if (parent_mobile && parent_mobile !== existing.parentMobile) {
      let parentUser = await prisma.user.findUnique({
        where: { auth_identifier: parent_mobile },
      });

      if (!parentUser) {
        await prisma.user.create({
          data: {
            role: "PARENT",
            auth_identifier: parent_mobile,
          },
        });
      } else if (parentUser.role !== "PARENT") {
        return res.status(409).json({
          error: `The identifier "${parent_mobile}" belongs to a ${parentUser.role} user, not a PARENT`,
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (class_name) updateData.className = class_name;
    if (parent_mobile) updateData.parentMobile = parent_mobile;

    const updated = await prisma.student.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: {
            id: true,
            auth_identifier: true,
            role: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Update student error:", error);
    res.status(500).json({ error: "Failed to update student" });
  }
});

/**
 * DELETE /api/admin/students/:id
 *
 * Remove a student and all their dependent records:
 *   1. Delete all Attendance entries
 *   2. Delete all Mark entries
 *   3. Delete the Student record
 */
router.delete("/students/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({ where: { studentId: id } });
      await tx.mark.deleteMany({ where: { studentId: id } });
      await tx.student.delete({ where: { id } });
    });

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
});

// ─────────────────────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/subjects
 *
 * List every subject. No pagination — the subject catalogue is
 * expected to be small.
 */
router.get("/subjects", async (_req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            assignments: true,
            marks: true,
          },
        },
      },
    });

    res.json(subjects);
  } catch (error) {
    console.error("List subjects error:", error);
    res.status(500).json({ error: "Failed to list subjects" });
  }
});

/**
 * POST /api/admin/subjects
 *
 * Create a new subject.
 * Body: { name }
 */
router.post("/subjects", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Subject name is required" });
    }

    // Check for duplicate (case-insensitive) to give a friendlier error
    const existing = await prisma.subject.findFirst({
      where: { name: { equals: name } },
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: `Subject "${existing.name}" already exists` });
    }

    const subject = await prisma.subject.create({ data: { name } });
    res.status(201).json(subject);
  } catch (error) {
    console.error("Create subject error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({ error: "Subject name must be unique" });
    }

    res.status(500).json({ error: "Failed to create subject" });
  }
});

/**
 * DELETE /api/admin/subjects/:id
 *
 * Delete a subject and all related assignments and marks.
 */
router.delete("/subjects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.deleteMany({ where: { subjectId: id } });
      await tx.mark.deleteMany({ where: { subjectId: id } });
      await tx.subject.delete({ where: { id } });
    });

    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    console.error("Delete subject error:", error);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

// ─────────────────────────────────────────────────────────────
// TEACHER ASSIGNMENTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/assignments
 *
 * List all teacher ↔ class ↔ subject assignments.
 * Optionally filter by teacher_id.
 */
router.get("/assignments", async (req, res) => {
  try {
    const { teacher_id } = req.query;

    const where = {};
    if (teacher_id) {
      const tid = parseInt(teacher_id, 10);
      if (isNaN(tid)) {
        return res.status(400).json({ error: "Invalid teacher_id" });
      }
      where.teacherId = tid;
    }

    const assignments = await prisma.teacherAssignment.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        teacher: { select: { id: true, name: true, empId: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    res.json(assignments);
  } catch (error) {
    console.error("List assignments error:", error);
    res.status(500).json({ error: "Failed to list assignments" });
  }
});

/**
 * POST /api/admin/assignments
 *
 * Assign a teacher to a class + subject combination.
 * Body: { teacher_id, class_name, subject_id }
 */
router.post("/assignments", async (req, res) => {
  try {
    const { teacher_id, class_name, subject_id } = req.body;

    if (!teacher_id || !class_name || !subject_id) {
      return res
        .status(400)
        .json({ error: "teacher_id, class_name, and subject_id are required" });
    }

    const teacherId = parseInt(teacher_id, 10);
    const subjectId = parseInt(subject_id, 10);

    // Validate that both the teacher and subject exist
    const [teacher, subject] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: teacherId } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
    ]);

    if (!teacher) {
      return res.status(404).json({ error: "Teacher not found" });
    }
    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    // Check for duplicate assignment
    const duplicate = await prisma.teacherAssignment.findUnique({
      where: {
        teacherId_className_subjectId: {
          teacherId,
          className: class_name,
          subjectId,
        },
      },
    });
    if (duplicate) {
      return res.status(409).json({
        error: "This teacher is already assigned to this class + subject",
      });
    }

    const assignment = await prisma.teacherAssignment.create({
      data: {
        teacherId,
        className: class_name,
        subjectId,
      },
      include: {
        teacher: { select: { id: true, name: true, empId: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error("Create assignment error:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        error: "Duplicate assignment for this teacher/class/subject",
      });
    }

    res.status(500).json({ error: "Failed to create assignment" });
  }
});

/**
 * DELETE /api/admin/assignments/:id
 *
 * Remove a single teacher assignment.
 */
router.delete("/assignments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid assignment ID" });
    }

    const assignment = await prisma.teacherAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await prisma.teacherAssignment.delete({ where: { id } });

    res.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("Delete assignment error:", error);
    res.status(500).json({ error: "Failed to delete assignment" });
  }
});

// ─────────────────────────────────────────────────────────────
// CLASSES
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/classes
 * Returns all class names from the Class table, sorted alphabetically.
 */
router.get("/classes", async (_req, res) => {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
    });
    // Return both full objects (for the UI) and a flat name array (for dropdowns)
    res.json(classes);
  } catch (error) {
    console.error("List classes error:", error);
    res.status(500).json({ error: "Failed to list classes" });
  }
});

/**
 * POST /api/admin/classes
 * Create a new class. Body: { name }
 */
router.post("/classes", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Class name is required" });
    }

    const existing = await prisma.class.findFirst({
      where: { name: { equals: name.trim() } },
    });
    if (existing) {
      return res.status(409).json({ error: `Class "${existing.name}" already exists` });
    }

    const cls = await prisma.class.create({ data: { name: name.trim() } });
    res.status(201).json(cls);
  } catch (error) {
    console.error("Create class error:", error);
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Class name must be unique" });
    }
    res.status(500).json({ error: "Failed to create class" });
  }
});

/**
 * DELETE /api/admin/classes/:id
 * Delete a class by id.
 */
router.delete("/classes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid class ID" });
    }
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      return res.status(404).json({ error: "Class not found" });
    }
    await prisma.class.delete({ where: { id } });
    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    console.error("Delete class error:", error);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

/**
 * GET /api/admin/classes/:className/performance
 * Returns performance details (student list, averages, attendance rates, class average)
 * for a specific class section.
 */
router.get("/classes/:className/performance", async (req, res) => {
  try {
    const { className } = req.params;

    // Find all students in this class
    const students = await prisma.student.findMany({
      where: { className },
      include: {
        attendance: true,
        marks: true,
      },
    });

    // Compute student stats
    const studentList = students.map((student) => {
      const totalMarks = student.marks.reduce((sum, m) => sum + m.score, 0);
      const avgMark = student.marks.length > 0 ? totalMarks / student.marks.length : null;
      
      const totalAttendance = student.attendance.length;
      const presentCount = student.attendance.filter(a => a.status === "PRESENT").length;
      const attendancePercent = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : null;

      return {
        id: student.id,
        name: student.name,
        parentMobile: student.parentMobile || student.parent_mobile || "—",
        avgMark: avgMark !== null ? Math.round(avgMark * 10) / 10 : null,
        attendancePercent: attendancePercent !== null ? Math.round(attendancePercent) : null,
        totalMarks,
      };
    });

    // Compute class average
    const allScores = students.flatMap((s) => s.marks.map((m) => m.score));
    const classAverage = allScores.length > 0
      ? Math.round((allScores.reduce((sum, s) => sum + s, 0) / allScores.length) * 10) / 10
      : null;

    res.json({
      classAverage,
      students: studentList,
    });
  } catch (error) {
    console.error("Get class performance error:", error);
    res.status(500).json({ error: "Failed to get class performance data" });
  }
});

// ─────────────────────────────────────────────────────────────
// ANNOUNCEMENTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/announcements
 * List all announcements.
 */
router.get("/announcements", async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(announcements);
  } catch (error) {
    console.error("List announcements error:", error);
    res.status(500).json({ error: "Failed to list announcements" });
  }
});

/**
 * POST /api/admin/announcements
 * Create an announcement.
 * Body: { title, content, target }
 */
router.post("/announcements", async (req, res) => {
  try {
    const { title, content, target } = req.body;

    if (!title || !content || !target) {
      return res.status(400).json({ error: "title, content, and target are required" });
    }

    if (!["TEACHER", "PARENT", "BOTH"].includes(target)) {
      return res.status(400).json({ error: "target must be TEACHER, PARENT, or BOTH" });
    }

    const announcement = await prisma.announcement.create({
      data: { title, content, target },
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error("Create announcement error:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

/**
 * DELETE /api/admin/announcements/:id
 * Delete an announcement.
 */
router.delete("/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid announcement ID" });
    }

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    await prisma.announcement.delete({ where: { id } });
    res.json({ message: "Announcement deleted successfully" });
  } catch (error) {
    console.error("Delete announcement error:", error);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

/**
 * PUT /api/admin/profile
 * Update logged-in admin's credentials (email and/or password).
 */
router.put("/profile", async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { auth_identifier: email.trim() }
    });
    
    if (existingUser && existingUser.id !== adminId) {
      return res.status(400).json({ error: "Email is already in use by another account" });
    }

    const updateData = {
      auth_identifier: email.trim(),
    };

    if (password && password.trim()) {
      updateData.password_hash = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: adminId },
      data: updateData,
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        role: updatedUser.role,
        auth_identifier: updatedUser.auth_identifier,
      }
    });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
