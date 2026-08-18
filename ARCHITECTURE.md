# Q2 Connect Suite — System Architecture & Developer Guide

## 1. Overview
**Q2 Connect Suite** is a full-stack hostel management platform catering to **Admin** (hostel managers/wardens) and **Student** residents. The application is built with a modular, role-separated architecture on both frontend and backend.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18.3 + TypeScript 5.8 + Vite 8.1
- **Styling:** TailwindCSS 3.4 + Radix UI / Shadcn UI + Framer Motion
- **State Management & Caching:** `@tanstack/react-query` v5 + React Context (`AuthContext`, `HostelContext`)
- **Realtime:** Socket.IO Client
- **Document & PDF Generation:** jsPDF + jsPDF-AutoTable + SheetJS (`xlsx`)

### Backend
- **Runtime:** Node.js (CommonJS) + Express 4.21
- **Database:** MongoDB + Mongoose 8.24
- **Realtime & Jobs:** Socket.IO + Node-Cron
- **Storage & Security:** ImageKit SDK + JWT + Helmet + Express-Rate-Limit + Mongo-Sanitize + XSS-Clean

---

## 3. Directory Structure

```
q2-connect-suite/
├── src/
│   ├── app/                          # Application routing and providers
│   ├── components/                   # UI components
│   │   ├── admin/                    # Admin-specific UI widgets & layouts
│   │   ├── student/                  # Student-specific UI widgets & layouts
│   │   ├── dashboard/                # Shared navigation & top bars
│   │   ├── auth/                     # Protected routes (Admin & Student shells)
│   │   └── ui/                       # Reusable Shadcn UI primitives
│   │
│   ├── types/                        # Centralized TypeScript domain definitions
│   │   ├── common.types.ts           # API response, pagination, hostel types
│   │   ├── auth.types.ts             # User, Profile, Auth responses
│   │   ├── student.types.ts          # Student, registration payloads, alerts
│   │   ├── fee.types.ts              # Fees, payments, deposits
│   │   ├── room.types.ts             # Rooms, allocations
│   │   ├── feedback.types.ts         # Complaints, suggestions, ratings
│   │   ├── laundry.types.ts          # Laundry slots, booking
│   │   └── leave.types.ts            # Mess requests, leaves
│   │
│   ├── constants/                    # System constants & status maps
│   │   ├── routes.constants.ts       # Type-safe mapped routes
│   │   ├── status.constants.ts       # Fee, complaint, leave statuses
│   │   └── hostel.constants.ts       # Hostels, penalty rates, grace periods
│   │
│   ├── services/                     # Centralized API Service Layer
│   │   └── api/                      # Feature services (auth, student, fee, room, leave, feedback, laundry, dashboard)
│   │
│   ├── contexts/                     # React context providers (HostelContext)
│   ├── hooks/                        # Custom React hooks (useAuth, useMobile, useDebounce)
│   └── lib/                          # Axios instance, socket client, PDF generators
│
├── backend/
│   ├── src/
│   │   ├── config/                   # MongoDB connection, ImageKit, environment
│   │   ├── controllers/              # Express HTTP controllers (thin request handlers)
│   │   ├── services/                 # Backend business logic & database services
│   │   │   ├── fee.service.js        # Fee dashboard aggregations & collection rules
│   │   │   ├── student.service.js    # Student queries & expiration alert tracking
│   │   │   ├── room.service.js       # Room capacity & assignment rules
│   │   │   └── dashboard.service.js  # Metric aggregations for admin & student
│   │   ├── models/                   # Mongoose models & schemas
│   │   ├── middleware/               # Auth, AdminOnly, RateLimit, RequestLogger
│   │   ├── routes/                   # Express routes
│   │   ├── socket/                   # Socket.IO handlers
│   │   └── utils/                    # Cron jobs & email service
```

---

## 4. Key Workflows & Data Flow

### 4.1 Authentication & Route Protection
1. User logs in via `/login`.
2. Auth response returns JWT `accessToken` & `refreshToken`.
3. `AuthProvider` validates user role:
   - `admin` -> Navigates to `/admin/dashboard` (Guarded by `ProtectedAdminRoute` in `AdminShell`).
   - `student` -> Navigates to `/student/dashboard` (Guarded by `ProtectedStudentRoute` in `StudentShell`).
4. Axios interceptors automatically attach `Bearer <token>` and transparently queue requests to refresh expired tokens.

### 4.2 Fee Management & Matrix Visualization
- **KPI Summary**: Top metrics calculate Total Students, Fees Collected, Pending Amount, Overdue Amount, and Collection Rate.
- **Student Fee Matrix**: Floor-by-floor layout of circular student indicators with visual payment rings (🟢 Paid, 🔴 Pending, 🟡 Overdue, 🔵 Upcoming).
- **Grace Period & Penalties**: 5-day grace period with configurable ₹20/day penalty calculation.
- **Receipts**: Auto-generated branded PDF receipts stored via ImageKit and downloadable locally.

---

## 5. Running the Application

### Frontend:
```bash
npm install
npm run dev
```

### Backend:
```bash
cd backend
npm install
npm run dev
```
