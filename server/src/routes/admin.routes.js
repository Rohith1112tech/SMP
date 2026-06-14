// ============================================================
// Admin Routes — /api/admin
// ============================================================
// All routes in this file are protected by requireAuth +
// requireRole('ADMIN') middleware applied at mount level.
// Provides functional, secure database operations for:
//   - Dashboard statistics
//   - Teachers (with linked User records)
//   - Students (with auto-created Parent records)
//   - Subjects
//   - Teacher ↔ Class ↔ Subject assignments
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
 */
router.get("/dashboard", async (req, res) => {
  console.log("📊 Handling Admin Dashboard data request...");
  
  try {
    // Get total distinct classes from current student records
    const distinctClassesGroup = await prisma.student.groupBy({
      by: ["className"],
    });
    const totalClasses = distinctClassesGroup.length;

    const [
      totalStudents,
      totalTeachers,
      totalSubjects,
      recentStudents,
      recentTeachers,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.subject.count(),
      prisma.student.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.teacher.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return res.status(200).json({
      success: true,
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalClasses,
      recentStudents,
      recentTeachers,
    });
  } catch (error) {
    console.error("Dashboard database fetch failure:", error);
    return res.status(500).json({ error: "Failed to load dashboard statistics" });
  }
});

// ─────────────────────────────────────────────────────────────
// TEACHERS CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/teachers
 */
router.get("/teachers", async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search } = req.query;

    const where = search ? { name: { contains: search, mode: "insensitive" } } : {};

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
              identifier: true,
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
 */
router.get("/teachers/:id", async (req, res) => {
  try {
    const { id } = req.params; // Using clean UUID strings directly

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            identifier: true,
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
      return res.status(404).json({ error: "Teacher profile not found" });
    }

    res.json(teacher);
  } catch (error) {
    console.error("Get teacher error:", error);
    res.status(500).json({ error: "Failed to fetch teacher" });
  }
});

/**
 * POST /api/admin/teachers
 */
router.post("/teachers", async (req, res) => {
  try {
    const { name, emp_id } = req.body;

    if (!name || !emp_id) {
      return res.status(400).json({ error: "name and emp_id are required fields" });
    }

    const cleanEmpId = String(emp_id).trim();

    const existingUser = await prisma.user.findUnique({
      where: { identifier: cleanEmpId },
    });
    if (existingUser) {
      return res.status(409).json({ error: `A user with identifier "${cleanEmpId}" already exists` });
    }

    // Generate secure default password hashing schema
    const digits = cleanEmpId.replace(/\D/g, "");
    const defaultPass = "teacher" + (digits || "001");
    const passwordHash = await bcrypt.hash(defaultPass, 10);

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: "TEACHER",
          identifier: cleanEmpId,
          passwordHash,
        },
      });

      return tx.teacher.create({
        data: {
          userId: user.id,
          name,
          employeeId: cleanEmpId,
        },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              identifier: true,
              createdAt: true,
            },
          },
        },
      });
    });

    res.status(201).json(teacher);
  } catch (error) {
    console.error("Create teacher error:", error);
    res.status(500).json({ error: "Failed to build teacher configuration profile" });
  }
});

/**
 * PUT /api/admin/teachers/:id
 */
router.put("/teachers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, emp_id, password } = req.body;

    const existing = await prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Teacher profile target not found" });
    }

    const teacherData = {};
    const userData = {};

    if (name) teacherData.name = name;
    
    if (emp_id && emp_id !== existing.employeeId) {
      const cleanEmpId = String(emp_id).trim();
      const duplicate = await prisma.user.findUnique({
        where: { identifier: cleanEmpId },
      });
      if (duplicate) {
        return res.status(409).json({ error: `Identifier "${cleanEmpId}" is currently in use` });
      }
      teacherData.employeeId = cleanEmpId;
      userData.identifier = cleanEmpId;
    }

    if (password) {
      userData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.$transaction(async (tx) => {
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
              identifier: true,
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
    res.status(500).json({ error: "Failed to update teacher data metrics" });
  }
});

/**
 * DELETE /api/admin/teachers/:id
 */
router.delete("/teachers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      return res.status(404).json({ error: "Teacher target execution profile not found" });
    }

    await prisma.$transaction(async (tx) => {
      // Cascading cleanups manually to ensure data sync performance
      await tx.teacherAssignment.deleteMany({ where: { teacherId: id } });
      await tx.mark.deleteMany({ where: { teacherId: id } });
      await tx.teacher.delete({ where: { id } });
      await tx.user.delete({ where: { id: teacher.userId } });
    });

    res.json({ message: "Teacher deleted successfully from active cluster storage" });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ error: "Failed to delete teacher database configuration" });
  }
});

// ─────────────────────────────────────────────────────────────
// STUDENTS CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/students
 */
router.get("/students", async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search } = req.query;
    const className = req.query.class;

    const where = {};
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (className) where.className = className;

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          parent: {
            include: {
              user: {
                select: { id: true, identifier: true, role: true }
              }
            }
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
 * POST /api/admin/students
 */
router.post("/students", async (req, res) => {
  try {
    const { name, class_name, parent_mobile, parent_name } = req.body;

    if (!name || !class_name || !parent_mobile) {
      return res.status(400).json({ error: "name, class_name, and parent_mobile are required parameters" });
    }

    const cleanMobile = String(parent_mobile).trim();

    let parentProfile = await prisma.parent.findUnique({
      where: { parentMobile: cleanMobile },
    });

    if (!parentProfile) {
      const defaultParentPass = "parent123";
      const parentHash = await bcrypt.hash(defaultParentPass, 10);

      parentProfile = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            role: "PARENT",
            identifier: cleanMobile,
            passwordHash: parentHash,
          },
        });

        return tx.parent.create({
          data: {
            userId: user.id,
            parentMobile: cleanMobile,
            name: parent_name || `Parent of ${name}`,
          },
        });
      });
    }

    const student = await prisma.student.create({
      data: {
        name,
        className: class_name,
        parentMobile: cleanMobile,
      },
      include: { parent: true },
    });

    res.status(201).json(student);
  } catch (error) {
    console.error("Create student error:", error);
    res.status(500).json({ error: "Failed to create student validation entry" });
  }
});

// ─────────────────────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/subjects
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
 */
router.post("/subjects", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Subject name is required" });

    const cleanName = String(name).trim();

    const existing = await prisma.subject.findUnique({
      where: { name: cleanName },
    });
    if (existing) {
      return res.status(409).json({ error: `Subject "${cleanName}" already exists` });
    }

    const subject = await prisma.subject.create({ data: { name: cleanName } });
    res.status(201).json(subject);
  } catch (error) {
    console.error("Create subject error:", error);
    res.status(500).json({ error: "Failed to create subject record matrix" });
  }
});

// ─────────────────────────────────────────────────────────────
// TEACHER ASSIGNMENTS (Linking Platform Matrix)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/assignments
 * Connects a Teacher with a Subject and a Class string seamlessly
 */
router.post("/assignments", async (req, res) => {
  try {
    const { teacher_id, class_name, subject_id } = req.body;

    if (!teacher_id || !class_name || !subject_id) {
      return res.status(400).json({ error: "teacher_id, class_name, and subject_id are required fields" });
    }

    const [teacher, subject] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: teacher_id } }),
      prisma.subject.findUnique({ where: { id: subject_id } }),
    ]);

    if (!teacher) return res.status(404).json({ error: "Target Teacher profile missing" });
    if (!subject) return res.status(404).json({ error: "Target Course Subject profile missing" });

    const duplicate = await prisma.teacherAssignment.findUnique({
      where: {
        teacherId_className_subjectId: {
          teacherId: teacher_id,
          className: class_name,
          subjectId: subject_id,
        },
      },
    });
    if (duplicate) {
      return res.status(409).json({ error: "This teacher is already assigned to this matching class + subject coordinate" });
    }

    const assignment = await prisma.teacherAssignment.create({
      data: { teacherId: teacher_id, className: class_name, subjectId: subject_id },
      include: {
        teacher: { select: { id: true, name: true, employeeId: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ error: "Failed to map teacher routing matrix data link" });
  }
});

/**
 * DELETE /api/admin/assignments/:id
 */
router.delete("/assignments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.teacherAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: "Assignment record entry missing" });

    await prisma.teacherAssignment.delete({ where: { id } });
    res.json({ message: "Assignment severed successfully from storage layer" });
  } catch (error) {
    console.error("Delete assignment error:", error);
    res.status(500).json({ error: "Failed to delete relational map matrix item" });
  }
});

export default router;
