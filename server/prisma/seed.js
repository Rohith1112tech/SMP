// ============================================================
// Prisma Seed Script — Populate the database with demo data
// ============================================================
// Creates:
//   - 1 Admin user (admin@school.com / admin123)
//   - 1 Teacher user + Teacher profile (EMP001 / teacher123)
//   - 1 Parent user (9876543210, OTP-only)
//   - 5 Subjects
//   - 2 Students linked to the parent
//   - 1 TeacherAssignment (EMP001 → Class 10-A → Mathematics)
//
// All operations use upsert to make the script idempotent.
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── 1. Admin User ──────────────────────────────────────

  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  const adminUser = await prisma.user.upsert({
    where: { auth_identifier: "admin@school.com" },
    update: {
      password_hash: adminPasswordHash,
      role: "ADMIN",
    },
    create: {
      auth_identifier: "admin@school.com",
      password_hash: adminPasswordHash,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user:", adminUser.auth_identifier, `(id: ${adminUser.id})`);

  // ─── 2. Teacher User + Profile ──────────────────────────

  const teacherPasswordHash = await bcrypt.hash("teacher123", 10);

  const teacherUser = await prisma.user.upsert({
    where: { auth_identifier: "EMP001" },
    update: {
      password_hash: teacherPasswordHash,
      role: "TEACHER",
    },
    create: {
      auth_identifier: "EMP001",
      password_hash: teacherPasswordHash,
      role: "TEACHER",
    },
  });
  console.log("✅ Teacher user:", teacherUser.auth_identifier, `(id: ${teacherUser.id})`);

  // Create the Teacher profile (1-to-1 with User)
  const teacher = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {
      name: "John Smith",
      empId: "EMP001",
    },
    create: {
      userId: teacherUser.id,
      name: "John Smith",
      empId: "EMP001",
    },
  });
  console.log("✅ Teacher profile:", teacher.name, `(empId: ${teacher.empId})`);

  // ─── 3. Parent User ────────────────────────────────────

  const parentUser = await prisma.user.upsert({
    where: { auth_identifier: "9876543210" },
    update: {
      role: "PARENT",
    },
    create: {
      auth_identifier: "9876543210",
      role: "PARENT",
      // No password — parents use OTP
    },
  });
  console.log("✅ Parent user:", parentUser.auth_identifier, `(id: ${parentUser.id})`);

  // ─── 4. Subjects ───────────────────────────────────────

  const subjectNames = ["Mathematics", "Science", "English", "Hindi", "Social Studies"];

  const subjects = [];
  for (const name of subjectNames) {
    const subject = await prisma.subject.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    subjects.push(subject);
  }
  console.log("✅ Subjects:", subjects.map((s) => s.name).join(", "));

  // ─── 5. Students ───────────────────────────────────────

  // We use a composite lookup approach since Student doesn't have
  // a single unique field suitable for upsert. We'll use findFirst
  // + create/update pattern instead.

  const studentsData = [
    { name: "Aarav Sharma", className: "10-A", parentMobile: "9876543210" },
    { name: "Priya Sharma", className: "10-A", parentMobile: "9876543210" },
  ];

  const createdStudents = [];
  for (const data of studentsData) {
    // Check if student already exists by name + class + parent
    let student = await prisma.student.findFirst({
      where: {
        name: data.name,
        className: data.className,
        parentMobile: data.parentMobile,
      },
    });

    if (!student) {
      student = await prisma.student.create({ data });
    }
    createdStudents.push(student);
  }
  console.log("✅ Students:", createdStudents.map((s) => `${s.name} (${s.className})`).join(", "));

  // ─── 6. Teacher Assignment ─────────────────────────────

  // Find the Mathematics subject
  const mathSubject = subjects.find((s) => s.name === "Mathematics");

  const assignment = await prisma.teacherAssignment.upsert({
    where: {
      teacherId_className_subjectId: {
        teacherId: teacher.id,
        className: "10-A",
        subjectId: mathSubject.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      className: "10-A",
      subjectId: mathSubject.id,
    },
  });
  console.log(
    "✅ Teacher assignment:",
    `${teacher.name} → Class 10-A → Mathematics (id: ${assignment.id})`
  );

  console.log("\n🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
