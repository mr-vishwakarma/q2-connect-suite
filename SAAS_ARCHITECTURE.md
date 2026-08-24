# Q2 Connect Suite — Multi-Tenant Hostel SaaS Platform Architecture

## 1. Executive Summary
Q2 Connect Suite is a modern, full-scale Multi-Tenant SaaS platform engineered to manage hostel chains, student housing companies, and independent PG accommodations. The platform provides complete tenant isolation, granular Role-Based Access Control (RBAC), feature-flag-based subscription plans, automated fee collection, and a dedicated **Super Admin Control Center**.

---

## 2. Multi-Tenancy & Entity Hierarchy

```text
                           PLATFORM ROOT (SUPER ADMIN)
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             │                                                     │
             ▼                                                     ▼
     ORGANIZATION (Tenant A)                               ORGANIZATION (Tenant B)
  "Q2 Hostel Management Pvt Ltd"                          "ABC Student Living"
             │                                                     │
     ┌───────┴───────┐                                     ┌───────┴───────┐
     ▼               ▼                                     ▼               ▼
HOSTEL BRANCH 1   HOSTEL BRANCH 2                      HOSTEL BRANCH 1  HOSTEL BRANCH 2
(Gachibowli)      (Kondapur)                           (Madhapur)       (Hitec City)
     │
     └── BUILDINGS -> FLOORS -> ROOMS -> BEDS / STUDENTS -> FEE LEDGERS & EXPENSES
```

### Core Hierarchy Models:
1. **`Organization`**: The primary customer entity/tenant. Holds tenant settings, branding, contact info, status (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`), and active subscription.
2. **`Hostel`**: A distinct branch or property under an organization. Maintains branch capacity, address, gender type (`GIRLS`, `BOYS`, `COED`), late fee policies, and laundry limits.
3. **`Membership`**: Associates a `User` with an `Organization` and assigns their `role` (`ORGANIZATION_OWNER`, `HOSTEL_ADMIN`, `WARDEN`, `ACCOUNTANT`, `STUDENT`), branch permissions, and access scope.
4. **`Plan` & `Subscription`**: Controls subscription tiers (`STARTER`, `PROFESSIONAL`, `ENTERPRISE`), student/room limits, billing cycles, and feature inclusions.
5. **`Feature` & `OrganizationFeature`**: Global catalog of 14 modules (Fee Matrix, Deposits, Expense Tracker, Gate Attendance, Laundry, Biometric, White-labeling) with tenant-level overrides.

---

## 3. Strict Tenant Isolation & Security Model

### 3.1 Backend Immutable Scoping
Tenant isolation is enforced at the server level via `resolveTenantContext` middleware.
- Never trust `req.body.organizationId` or `req.query.organizationId`.
- Active organization and authorized branches are resolved strictly from verified JWT tokens and active `Membership` records.
- Request lifecycle:
  ```text
  Client HTTP Request
        ↓
  protect (JWT Verification)
        ↓
  resolveTenantContext (Resolves active Org, Branch, Role, Features)
        ↓
  requireRole / requirePermission (RBAC Enforcement)
        ↓
  requireFeature (Subscription Feature Gate)
        ↓
  Tenant-Scoped Database Query: { organizationId: req.tenant.organizationId, ... }
  ```

### 3.2 Compound Database Indexes
Every tenant-scoped collection (`Student`, `Room`, `Fee`, `FeePayment`, `SecurityDeposit`, `Expense`, `Complaint`, `Attendance`) features compound indexes:
- `(organizationId, hostelId)`
- `(organizationId, validDate, isActive)`
- `(organizationId, month, status)`

---

## 4. Super Admin Control Plane (`/super-admin/*`)

Platform administrators have a dedicated, secure governance portal:
- **SaaS Control Center (`/super-admin/dashboard`)**: Live MRR/ARR, tenant count, student scale, and platform collection efficiency.
- **Tenant Directory (`/super-admin/organizations`)**: Complete organization management, onboarding wizard, branch addition, and instant suspension/reactivation.
- **Organization Deep-Dive (`/super-admin/organizations/:id`)**: Real-time feature toggle switches, branch list, usage quotas, and plan assignments.
- **Subscription Plans (`/super-admin/plans`)**: Plan builder managing pricing and hard limits (Students, Rooms, Hostels, Staff).
- **Feature Catalog (`/super-admin/features`)**: Global feature flag definitions.
- **Audit Logs (`/super-admin/audit-logs`)**: Immutable compliance log recording every organization creation, feature toggle, and impersonation.
- **Controlled Impersonation**: Secure, audit-logged "Troubleshoot as Tenant Admin" sessions.

---

## 5. Tenant Hostel Applications

### 5.1 Hostel Admin (`/admin/*`)
- **Interactive Student Fee Matrix**: Visual circular indicators (🟢 Paid, 🔴 Pending, 🟡 Overdue, 🔵 Upcoming) with student profiles and PDF receipts.
- **Room & Bed Management**: Floor-wise occupancy tracking, bed allocations, and transfer history.
- **Expense Tracker (`/admin/expenses`)**: Categorized utility bills (Electricity, Water, Salary, Groceries, Maintenance) with net cashflow tracking.
- **Student Onboarding**: Instant registration with ImageKit photo upload and profile generation.
- **Alerts & Expired Students**: Real-time notifications for upcoming and overdue fees.

### 5.2 Student Resident Portal (`/student/*`)
- Profile overview, assigned room and floor details.
- Fee history with downloadable PDF receipts.
- Mess-off leave requests and today's meal ratings.
- Laundry washing machine slot booking.
- Maintenance ticket submission and tracking.
