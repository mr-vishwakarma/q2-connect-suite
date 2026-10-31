# Hosteliq — Secure One-Time Super Admin Bootstrap Guide

This guide documents the production-grade, secure, one-time bootstrap workflow for provisioning the initial **Super Administrator** account in Hosteliq.

---

## 1. Security Architecture & Safety Guards

The bootstrap command (`npm run seed:super-admin`) includes strict production safety mechanisms:

1. **Explicit Target Database Verification (`EXPECTED_DB_NAME`)**:
   - The command connects to MongoDB and inspects `mongoose.connection.name`.
   - It strictly compares this name against `EXPECTED_DB_NAME` (e.g., `hosteliq_prodtest`).
   - If the connected database does not match, the command **aborts immediately** with exit code `1`, preventing operations on unintended databases.
2. **Explicit Bootstrap Authorization Guard (`ALLOW_SUPERADMIN_BOOTSTRAP=true`)**:
   - The command refuses to run unless `ALLOW_SUPERADMIN_BOOTSTRAP=true` is set.
3. **Idempotence & Anti-Duplication**:
   - If a user with `role: 'super_admin'` or `isSuperAdmin: true` already exists in the target database, the script detects it and exits cleanly (`code 0`) without mutating or duplicating the account.
4. **Anti-Overwrite Protection**:
   - If the requested email or username already belongs to a non-superadmin account (e.g., a student or hostel admin), the script refuses to overwrite it and exits with code `1`.
5. **Zero-Leak Logging**:
   - Plaintext passwords, bcrypt hashes, tokens, and raw MongoDB URIs are **never logged** to stdout or stderr.
6. **Existing Model & Hook Integration**:
   - Directly uses Mongoose `User` model, triggering existing `pre('save')` bcrypt hashing (`salt: 12`), `toJSON()` sanitization, and `comparePassword()` verification.

---

## 2. Environment Variables

The command checks for variables in `backend/.env.bootstrap` (ignored by Git) and falls back to `backend/.env`:

| Variable | Required? | Default | Description |
| :--- | :---: | :---: | :--- |
| `MONGODB_URI` | **Yes** | — | Target MongoDB connection string (percent-encoded credentials). |
| `EXPECTED_DB_NAME` | **Yes** | — | Name of the database (e.g. `hosteliq_prodtest`). Must match actual connected database. |
| `ALLOW_SUPERADMIN_BOOTSTRAP` | **Yes** | `false` | Must be `true` to authorize the bootstrap. |
| `SUPERADMIN_EMAIL` | **Yes** | — | Super Admin email address (valid RFC format). |
| `SUPERADMIN_PASSWORD` | **Yes** | — | Password (minimum 8 characters). |
| `SUPERADMIN_USERNAME` | No | `superadmin` | Unique username (minimum 3 characters, alphanumeric/dashes). |
| `SUPERADMIN_NAME` | No | `Super Administrator` | Full name of the Super Administrator. |

---

## 3. How to Run the Bootstrap

### Option A: Local Untracked Bootstrap File (Recommended)

1. Create `backend/.env.bootstrap` (this file is ignored by Git):
   ```bash
   cp backend/.env.bootstrap.example backend/.env.bootstrap
   ```
2. Open `backend/.env.bootstrap` and configure your credentials:
   ```env
   MONGODB_URI=mongodb+srv://hosteliq_prodtest:Mayur2003%21%40%23%24@backend.avegemq.mongodb.net/hosteliq_prodtest?retryWrites=true&w=majority
   EXPECTED_DB_NAME=hosteliq_prodtest
   ALLOW_SUPERADMIN_BOOTSTRAP=true

   SUPERADMIN_NAME=Super Administrator
   SUPERADMIN_USERNAME=superadmin
   SUPERADMIN_EMAIL=superadmin@hosteliq.in
   SUPERADMIN_PASSWORD=Super12345Admin!@#$
   ```
3. Run the bootstrap command:
   ```bash
   npm run seed:super-admin
   ```
4. Once completed, securely delete `backend/.env.bootstrap`.

---

### Option B: Inline Environment Execution

```bash
ALLOW_SUPERADMIN_BOOTSTRAP=true \
EXPECTED_DB_NAME=hosteliq_prodtest \
SUPERADMIN_EMAIL=superadmin@hosteliq.in \
SUPERADMIN_PASSWORD="Super12345Admin!@#$" \
npm run seed:super-admin
```

---

### Option C: CLI Argument Flags

```bash
ALLOW_SUPERADMIN_BOOTSTRAP=true \
EXPECTED_DB_NAME=hosteliq_prodtest \
npm run seed:super-admin -- --email superadmin@hosteliq.in --password "Super12345Admin!@#$" --username superadmin
```

---

## 4. Verifying Super Admin Login

1. Start or open the application (`http://localhost:8080` or production URL `https://q2-connect-suite.vercel.app`).
2. Navigate to the Super Admin portal login:
   - URL: `/super-admin/login` or `/login?role=super_admin`
3. Enter credentials:
   - **Identifier (Email or Username):** `superadmin` or `superadmin@hosteliq.in`
   - **Password:** `Super12345Admin!@#$`
4. The system validates:
   - Password hash verification (`User.comparePassword`).
   - Portal authorization check (`isRoleAllowedForPortal(user, 'SUPER_ADMIN')`).
   - Issues Super Admin JWT access and refresh tokens.
5. Successfully redirects to the Super Admin Control Center (`/super-admin/dashboard`).

---

## 5. Automated Test Suite

A dedicated 11-scenario, 53-assertion automated test suite verifies all safety guards:

```bash
npm run test:superadmin
```

### Covered Test Scenarios:
- Scenario 1: Refusal when `ALLOW_SUPERADMIN_BOOTSTRAP` is missing.
- Scenario 2: Refusal when `EXPECTED_DB_NAME` is missing.
- Scenario 3: Immediate abort when `EXPECTED_DB_NAME` does not match connected database.
- Scenario 4: Refusal on malformed email or weak/short password (< 8 chars).
- Scenario 5: Successful creation and field initialization of intended Super Admin.
- Scenario 6: Password verification via bcrypt (salt 12) and zero plaintext storage.
- Scenario 7: Zero-leak audit: secrets, passwords, and URIs never appear in stdout/stderr.
- Scenario 8: Idempotence: Refusal to duplicate or mutate existing Super Admin.
- Scenario 9: Refusal to overwrite existing account with same email/username.
- Scenario 10: Acceptance by authentication, JWT token, and RBAC middleware (`requireSuperAdmin`).
- Scenario 11: Non-interference with existing operational collections (hostels, students, organizations).

