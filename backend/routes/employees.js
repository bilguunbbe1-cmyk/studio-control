const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../lib/uploads");
const { EMPLOYEE_FILE_CATEGORIES } = require("../lib/helpers");

const LOGIN_ROLES = ["ceo", "manager", "production"];

const router = express.Router();
router.use(requireAuth);

const CEO_ONLY = requireRole("ceo");

function tenureLabel(hireDate) {
  if (!hireDate) return null;
  const start = new Date(hireDate);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const days = now.getDate() - start.getDate();
  if (days < 0) months -= 1;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years) parts.push(`${years} жил`);
  parts.push(`${remMonths} сар`);
  return parts.join(" ");
}

function isSelf(req, employeeId) {
  const row = db.prepare("SELECT id FROM employees WHERE id = ? AND user_id = ?").get(employeeId, req.user.id);
  return !!row;
}

function canSeeFull(req, employeeId) {
  return req.user.role === "ceo" || isSelf(req, employeeId);
}

function shapeListItem(e) {
  const leaveCycle = db.prepare("SELECT next_cycle_date, status FROM leave_cycles WHERE employee_id = ?").get(e.id);
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    title: e.title,
    department: e.department,
    phone: e.phone,
    hireDate: e.hire_date,
    birthday: e.birthday,
    photoUrl: e.photo_url ? `/uploads/${e.photo_url}` : null,
    contractStatus: e.contract_status,
    nextLeaveCycleDate: leaveCycle ? leaveCycle.next_cycle_date : null,
    leaveStatus: leaveCycle ? leaveCycle.status : "Төлөвлөөгүй",
    hasLogin: !!e.user_id,
  };
}

function shapeListItemForViewer(req, e) {
  const full = shapeListItem(e);
  if (canSeeFull(req, e.id)) return full;
  return {
    id: full.id,
    code: full.code,
    name: full.name,
    title: full.title,
    department: full.department,
    phone: full.phone,
    birthday: full.birthday,
    photoUrl: full.photoUrl,
  };
}

// ---- Employees list ----
router.get("/employees", (req, res) => {
  let rows = db.prepare("SELECT * FROM employees ORDER BY name").all();
  const { search, filter } = req.query;

  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((e) => e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
  }
  if (filter === "active") rows = rows;
  if (filter === "missing_contract") rows = rows.filter((e) => e.contract_status !== "Гэрээтэй");

  res.json(rows.map((e) => shapeListItemForViewer(req, e)));
});

router.post("/employees", CEO_ONLY, (req, res) => {
  const { name, title, city, hireDate, department, phone, email, password, role } = req.body || {};
  if (!name || !title) return res.status(400).json({ error: "name, title шаардлагатай" });

  let userId = null;
  if (email) {
    if (!password || !LOGIN_ROLES.includes(role)) {
      return res.status(400).json({ error: "Нэвтрэх эрх нэмэхэд password болон зөв role (ceo/manager/production) шаардлагатай" });
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Энэ имэйл бүртгэлтэй байна" });
    userId = db
      .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)")
      .run(email, bcrypt.hashSync(password, 10), name, role).lastInsertRowid;
  }

  const code = `EMP-${String(100 + db.prepare("SELECT COUNT(*) AS c FROM employees").get().c).slice(-3)}`;
  const info = db
    .prepare(
      `INSERT INTO employees (code, name, title, city, hire_date, department, phone, contract_status, workload_pct, base_salary_amount, user_id)
       VALUES (?,?,?,?,?,?,?,'Мэдээлэл дутуу',0,0,?)`
    )
    .run(code, name, title, city || "", hireDate || null, department || null, phone || null, userId);
  db.prepare("INSERT INTO leave_cycles (employee_id, cycle_length_months, next_cycle_date, status) VALUES (?,6,NULL,'Төлөвлөөгүй')").run(
    info.lastInsertRowid
  );
  const row = db.prepare("SELECT * FROM employees WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(shapeListItem(row));
});

// ---- Employee detail ----
router.get("/employees/:id", (req, res) => {
  const e = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Ажилтан олдсонгүй" });

  const full = canSeeFull(req, e.id);
  if (!full) {
    return res.json({ ...shapeListItemForViewer(req, e), canSeeFull: false, isCeo: req.user.role === "ceo" });
  }

  const contract = db.prepare("SELECT * FROM contracts WHERE employee_id = ? ORDER BY id DESC LIMIT 1").get(e.id);
  const leaveCycle = db.prepare("SELECT * FROM leave_cycles WHERE employee_id = ?").get(e.id);
  const leaveHistory = db.prepare("SELECT * FROM leave_records WHERE employee_id = ? ORDER BY start_date DESC").all(e.id);

  const payrollRows = db.prepare("SELECT * FROM payroll_entries WHERE employee_id = ? ORDER BY date").all(e.id);
  const payrollSchedule = payrollRows.map((p) => ({
    id: p.id,
    date: p.date,
    label: p.label,
    status: p.status,
    isAdvance: !!p.is_advance,
    pctOfBase: p.is_advance ? p.pct_of_base : null,
    amount: p.amount,
  }));
  const nextDisbursement = payrollRows.find((p) => p.status === "Төлөвлөсөн" && p.is_advance);
  const nextBalance = payrollRows.find((p) => p.status === "Төлөвлөсөн" && !p.is_advance);

  const fileFolders = EMPLOYEE_FILE_CATEGORIES.map((category) => {
    const r = db.prepare("SELECT COUNT(*) AS c FROM files WHERE owner_type = 'employee' AND owner_id = ? AND category = ?").get(e.id, category);
    return { category, count: r.c || 0 };
  });

  res.json({
    ...shapeListItem(e),
    canSeeFull: true,
    isCeo: req.user.role === "ceo",
    city: e.city,
    tenure: tenureLabel(e.hire_date),
    contract: contract
      ? {
          number: contract.contract_number,
          startDate: contract.start_date,
          term: contract.term,
          status: contract.status,
          probationStatus: contract.probation_status,
          workType: contract.work_type,
          payrollDays: contract.payroll_days,
          nextReviewDate: contract.next_review_date,
        }
      : null,
    leave: {
      cycleLengthMonths: leaveCycle ? leaveCycle.cycle_length_months : 6,
      nextCycleDate: leaveCycle ? leaveCycle.next_cycle_date : null,
      status: leaveCycle ? leaveCycle.status : "Төлөвлөөгүй",
      history: leaveHistory,
    },
    salary: {
      canSeeAmounts: true,
      nextDisbursementDate: nextDisbursement ? nextDisbursement.date : null,
      nextDisbursementPctOfBase: nextDisbursement ? nextDisbursement.pct_of_base : null,
      nextBalanceDate: nextBalance ? nextBalance.date : null,
      schedule: payrollSchedule,
    },
    fileFolders,
  });
});

router.patch("/employees/:id", CEO_ONLY, (req, res) => {
  const e = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Ажилтан олдсонгүй" });
  const { name, title, city, hireDate, birthday, phone, department } = req.body || {};
  db.prepare(
    "UPDATE employees SET name = ?, title = ?, city = ?, hire_date = ?, birthday = ?, phone = ?, department = ? WHERE id = ?"
  ).run(
    name ?? e.name,
    title ?? e.title,
    city ?? e.city,
    hireDate !== undefined ? hireDate || null : e.hire_date,
    birthday !== undefined ? birthday || null : e.birthday,
    phone !== undefined ? phone || null : e.phone,
    department !== undefined ? department || null : e.department,
    e.id
  );
  res.json(shapeListItem(db.prepare("SELECT * FROM employees WHERE id = ?").get(e.id)));
});

router.post("/employees/:id/grant-login", CEO_ONLY, (req, res) => {
  const e = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Ажилтан олдсонгүй" });
  if (e.user_id) return res.status(400).json({ error: "Энэ ажилтан аль хэдийн нэвтрэх эрхтэй байна" });

  const { email, password, role } = req.body || {};
  if (!email || !password || !LOGIN_ROLES.includes(role)) {
    return res.status(400).json({ error: "email, password, role (ceo/manager/production) шаардлагатай" });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Энэ имэйл бүртгэлтэй байна" });

  const userId = db
    .prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)")
    .run(email, bcrypt.hashSync(password, 10), e.name, role).lastInsertRowid;
  db.prepare("UPDATE employees SET user_id = ? WHERE id = ?").run(userId, e.id);

  res.json(shapeListItem(db.prepare("SELECT * FROM employees WHERE id = ?").get(e.id)));
});

router.delete("/employees/:id", CEO_ONLY, (req, res) => {
  const e = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Ажилтан олдсонгүй" });
  try {
    db.prepare("DELETE FROM employees WHERE id = ?").run(e.id);
    res.status(204).end();
  } catch (err) {
    if (String(err.message).includes("FOREIGN KEY")) {
      return res.status(409).json({
        error: "Энэ ажилтныг устгах боломжгүй — түүнд оноогдсон төсөл эсвэл ажил байна. Эхлээд шилжүүлнэ үү.",
      });
    }
    throw err;
  }
});

router.post("/employees/:id/birthday", CEO_ONLY, (req, res) => {
  const { month, day } = req.body || {};
  if (!month || !day) return res.status(400).json({ error: "month, day шаардлагатай" });
  const birthday = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  db.prepare("UPDATE employees SET birthday = ? WHERE id = ?").run(birthday, req.params.id);
  res.json({ ok: true, birthday });
});

router.post("/employees/:id/leave/plan", CEO_ONLY, (req, res) => {
  const cycle = db.prepare("SELECT * FROM leave_cycles WHERE employee_id = ?").get(req.params.id);
  if (!cycle) return res.status(404).json({ error: "Амралтын мэдээлэл олдсонгүй" });
  db.prepare("UPDATE leave_cycles SET status = 'Төлөвлөсөн' WHERE id = ?").run(cycle.id);
  res.json({ ok: true });
});

router.post("/employees/:id/leave", CEO_ONLY, (req, res) => {
  const { startDate, endDate, days, coveringEmployeeId } = req.body || {};
  if (!startDate || !endDate || !days) return res.status(400).json({ error: "startDate, endDate, days шаардлагатай" });
  const info = db
    .prepare("INSERT INTO leave_records (employee_id, start_date, end_date, days, covering_employee_id, status) VALUES (?,?,?,?,?,'Батлагдсан')")
    .run(req.params.id, startDate, endDate, Number(days), coveringEmployeeId || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.post("/employees/:id/contracts", CEO_ONLY, (req, res) => {
  const { contractNumber, startDate, term, status } = req.body || {};
  if (!contractNumber || !startDate) return res.status(400).json({ error: "contractNumber, startDate шаардлагатай" });
  db.prepare(
    `INSERT INTO contracts (employee_id, contract_number, start_date, term, status) VALUES (?,?,?,?,?)`
  ).run(req.params.id, contractNumber, startDate, term || "Хугацаагүй", status || "Хүчинтэй");
  db.prepare("UPDATE employees SET contract_status = 'Гэрээтэй' WHERE id = ?").run(req.params.id);
  res.status(201).json({ ok: true });
});

// ---- Files ----
router.get("/employees/:id/files", CEO_ONLY, (req, res) => {
  const rows = db.prepare("SELECT id, category, filename, size_bytes AS sizeBytes, status, created_at AS createdAt FROM files WHERE owner_type = 'employee' AND owner_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

router.post("/employees/:id/files", CEO_ONLY, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file шаардлагатай" });
  const { category } = req.body || {};
  if (!EMPLOYEE_FILE_CATEGORIES.includes(category)) return res.status(400).json({ error: "category буруу байна" });
  const info = db
    .prepare("INSERT INTO files (owner_type, owner_id, category, filename, stored_path, size_bytes) VALUES ('employee',?,?,?,?,?)")
    .run(req.params.id, category, req.file.originalname, req.file.filename, req.file.size);
  res.status(201).json({ id: info.lastInsertRowid, category, filename: req.file.originalname, sizeBytes: req.file.size });
});

router.post("/employees/:id/photo", upload.single("photo"), (req, res) => {
  const e = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!e) return res.status(404).json({ error: "Ажилтан олдсонгүй" });
  if (!(req.user.role === "ceo" || isSelf(req, e.id))) {
    return res.status(403).json({ error: "Танд энэ зургийг солих эрх байхгүй" });
  }
  if (!req.file) return res.status(400).json({ error: "photo шаардлагатай" });
  db.prepare("UPDATE employees SET photo_url = ? WHERE id = ?").run(req.file.filename, e.id);
  res.json({ photoUrl: `/uploads/${req.file.filename}` });
});

module.exports = router;
