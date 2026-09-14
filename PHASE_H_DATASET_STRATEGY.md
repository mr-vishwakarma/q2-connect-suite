# PHASE H — REALISTIC MULTI-TENANT DATASET STRATEGY

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Document**: `PHASE_H_DATASET_STRATEGY.md`  
**Execution Stage**: Phase H Scale & Capacity Validation  
**Author**: Antigravity AI Senior Principal Systems Architect & Database Performance Agent  

---

## 1. Executive Strategy & Objectives

Uniform dummy datasets fail to uncover real-world database hotspots, B-tree index fragmentation, lock contention, and noisy-neighbor performance interference. In actual production SaaS deployments, tenant scale follows a **heavy-tailed Power Law (Pareto distribution)**:
- A large volume of small single-building hostels with low activity.
- A moderate volume of multi-branch regional operators.
- A small cluster of massive enterprise chains (Hot Tenants) with thousands of beds, generating disproportionate traffic and operational writes.

This strategy document defines the schema distributions, data models, entity relationships, and deterministic generation rules for Phase H scale testing.

---

## 2. Multi-Tenant Distribution Modeling (Power Law)

Organizations generated in Phase H are categorized into four distinct tenant profiles:

| Profile | Population Share | Hostels / Org | Students / Org | Rooms / Org | Operational Characteristics |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Small Tenant** | **70%** | 1–2 | 40–120 | 15–40 | Single or dual branch; low daily concurrency; simple fee audits. |
| **Medium Tenant** | **25%** | 3–6 | 150–450 | 60–180 | Multi-branch regional chain; moderate attendance and fee contention. |
| **Large Enterprise** | **4%** | 8–15 | 600–1,200 | 250–500 | Campus-style operations; high laundry/mess traffic; bulk attendance. |
| **Hot Tenant (Alpha)**| **1%** | **15–25** | **1,500–3,000** | **600–1,200** | High-contention mega-operator used for Noisy-Neighbor stress testing. |

### Deterministic Hot Tenant Identifiers:
- `slug`: `scale-h-hot-alpha`
- `name`: `Q2 Mega Campus Enterprise (Hot Tenant Alpha)`
- Used specifically in Step 5 for Noisy-Neighbor cross-tenant interference testing.

---

## 3. Entity Distributions & Realistic Field Modeling

### 3.1 Room Capacity & Occupancy Distribution
- Single Occupancy: 20%
- Double Occupancy: 50%
- Triple Occupancy: 25%
- Quad Occupancy: 5%
- **Target Average Occupancy Rate**: **82%** (balanced mix of `available`, `partially_occupied`, and `full` rooms).

### 3.2 Student Status & Lifecycle
- `isActive: true`: 92%
- `isActive: false`: 8% (graduated / vacated residents to test index selectivity on active status).
- Start & Valid dates distributed across rolling 12 months.

### 3.3 Fee Obligations & Payment Collection Distribution
- **65% Paid**: Settled on time with exact amounts and valid `FeePayment` receipts.
- **20% Partial**: Partial payment recorded; remaining balance active and overdue warnings applied.
- **15% Unpaid / Overdue**: Zero payment recorded; late fees applied (`lateFee: 150` to `300`).
- **Payment Modes**:
  - Cash: 40%
  - Bank Transfer (NEFT/RTGS): 30%
  - Offline UPI (counter QR): 25%
  - Cheque / Demand Draft: 5%
  - *Online / Razorpay*: **0.00%** (strictly enforced).

### 3.4 Operational Domain Records
1. **Attendance**: Daily records across 30 days (`present`: 88%, `absent`: 8%, `mess_off`: 4%).
2. **Mess Requests**: Leave and mess-off requests with statuses (`approved`: 70%, `pending`: 20%, `rejected`: 10%).
3. **Laundry Slots**: Machine bookings across time slots (7:00 AM to 9:00 PM).
4. **Expenses**: Monthly operational expenses categorized across `ELECTRICITY`, `WATER`, `FOOD`, `MAINTENANCE`, `SALARY`, `INTERNET`, `CLEANING`.
5. **Notifications**: System announcements and overdue fee warnings.
6. **SaaS Subscriptions**: Organizations mapped to `STARTER` (45%), `GROWTH` (40%), or `ENTERPRISE` (15%) plans with valid sequential invoices (`Q2-INV-YYYY-NNNNNN`) and double-entry `LedgerEntry` credits.
7. **Audit Logs**: Administrative logins, status modifications, and report generation events.

---

## 4. Graduated Scale Tiers

| Metric | Tier 1 (Staging Baseline) | Tier 2 (Mid-Market Scale) | Tier 3 (Production Target) |
| :--- | :---: | :---: | :---: |
| **Organizations** | 100 | 500 | **1,000+** |
| **Hostel Branches** | 220 | 1,100 | **2,600+** |
| **Students** | 10,000 | 50,000 | **100,000+** |
| **Rooms / Beds** | 4,200 | 21,000 | **48,000+** |
| **Monthly Fee Records** | 30,000 | 150,000 | **300,000+** |
| **Manual Fee Payments**| 25,000 | 125,000 | **250,000+** |
| **Attendance Records** | 50,000 | 250,000 | **500,000+** |
| **Operational Records**| ~150,000 | ~750,000 | **1,500,000+** |

---

## 5. Generator Architecture & Memory Bounds

The dataset generator (`backend/src/scripts/generate_phase_h_dataset.js`) enforces strict architectural safety rules:
1. **Bounded Heap Footprint**:
   - Never loads full datasets into Node.js memory.
   - Flushes records in batches of **500 to 1,000 documents** using MongoDB `bulkWrite({ ordered: false })`.
   - Node process memory stays below **180 MB RSS** throughout generation.
2. **Deterministic & Seeded**:
   - Pseudo-random number generator (PRNG) accepts a deterministic `--seed` (default: `42`).
   - Re-running the generator with the same seed produces identical entity IDs and record distributions.
3. **Namespacing & Clean Isolation**:
   - All generated entities share the prefix `scale-h-` to prevent polluting development fixtures.
   - CLI provides a `--clean` flag that purges previous Phase H test data via tenant indexes without table-locking.
4. **Resumable & Batch-Tracked**:
   - Periodically logs elapsed time, records/sec insertion rate, and memory usage.

---

*Strategy ratified for Phase H execution.*
