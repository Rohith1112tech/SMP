# 🎓 School Management Platform (SMP)

A full-stack web application for school administration with role-based access control.

## Tech Stack

| Layer       | Technology                        |
| ----------- | --------------------------------- |
| Frontend    | Next.js 15 (App Router) + Tailwind CSS |
| Backend API | Node.js / Express 5               |
| Database    | PostgreSQL + Prisma ORM           |
| Auth        | Custom JWT (access + refresh tokens) |

## Project Structure

```
SMP/
├── client/          # Next.js frontend
│   ├── app/         # Pages (login, admin, teacher, parent dashboards)
│   ├── components/  # Reusable React components (auth forms, guards)
│   ├── context/     # AuthContext provider
│   └── lib/         # API client utilities
│
├── server/          # Express backend
│   ├── prisma/      # Schema + seed data
│   └── src/
│       ├── controllers/  # Request handlers
│       ├── middleware/   # Auth + RBAC middleware
│       ├── routes/       # API route definitions
│       └── utils/        # JWT + OTP helpers
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL running locally
- npm

### 1. Server Setup

```bash
cd server

# Install dependencies
npm install

# Configure database connection
# Edit .env with your PostgreSQL credentials
# DATABASE_URL="postgresql://user:password@localhost:5432/smp_db?schema=public"

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed test data
npm run prisma:seed

# Start dev server (port 5000)
npm run dev
```

### 2. Client Setup

```bash
cd client

# Install dependencies (already done during init)
npm install

# Start dev server (port 3000)
npm run dev
```

### 3. Open the App

Navigate to [http://localhost:3000](http://localhost:3000)

## Test Accounts

| Role    | Identifier       | Password / OTP |
| ------- | ---------------- | -------------- |
| Admin   | admin@school.com | admin123       |
| Teacher | EMP001           | teacher123     |
| Parent  | 9876543210       | Mock OTP (shown in response) |

## Authentication Flows

- **Admin**: Email + Password → JWT
- **Teacher**: Employee ID + Password → JWT
- **Parent**: Mobile Number → Mock OTP → JWT

## API Endpoints

### Public
- `POST /api/auth/login` — Admin/Teacher login
- `POST /api/auth/send-otp` — Request parent OTP
- `POST /api/auth/verify-otp` — Verify parent OTP
- `POST /api/auth/refresh` — Refresh access token
- `GET /api/health` — Health check

### Protected (require JWT + matching role)
- `GET /api/admin/dashboard` — Admin only
- `GET /api/teacher/dashboard` — Teacher only
- `GET /api/parent/dashboard` — Parent only
