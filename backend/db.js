const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// DB_PATH lets a persistent disk (e.g. Render) survive redeploys — point it at the
// disk's mount path (e.g. /var/data/data.sqlite). Falls back to the local file when unset.
const dbPath = process.env.DB_PATH || path.join(__dirname, "data.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  city TEXT,
  hire_date TEXT,
  birthday TEXT,
  phone TEXT,
  department TEXT,
  photo_url TEXT,
  contract_status TEXT NOT NULL DEFAULT 'Гэрээтэй',
  workload_pct INTEGER NOT NULL DEFAULT 0,
  base_salary_amount REAL NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  start_date TEXT NOT NULL,
  term TEXT NOT NULL DEFAULT 'Хугацаагүй',
  status TEXT NOT NULL DEFAULT 'Хүчинтэй',
  probation_status TEXT NOT NULL DEFAULT 'Дууссан',
  work_type TEXT NOT NULL DEFAULT 'Бүтэн цаг',
  payroll_days TEXT NOT NULL DEFAULT '5, 20',
  next_review_date TEXT
);

CREATE TABLE IF NOT EXISTS leave_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cycle_length_months INTEGER NOT NULL DEFAULT 6,
  next_cycle_date TEXT,
  status TEXT NOT NULL DEFAULT 'Төлөвлөөгүй'
);

CREATE TABLE IF NOT EXISTS leave_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  covering_employee_id INTEGER REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'Батлагдсан',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Төлөвлөсөн',
  amount REAL,
  pct_of_base REAL,
  is_advance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  client TEXT,
  lead TEXT,
  owner_employee_id INTEGER REFERENCES employees(id),
  contract_amount REAL NOT NULL DEFAULT 0,
  budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ontrack',
  due_date TEXT,
  shoot_date TEXT,
  call_sheet_done INTEGER,
  call_sheet_total INTEGER,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliverables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  complete INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cost_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  receipt_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount REAL NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL,
  note TEXT,
  recorded_by_user_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  version TEXT,
  editor_employee_id INTEGER REFERENCES employees(id),
  review_status TEXT NOT NULL DEFAULT 'editing'
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by INTEGER,
  decided_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  project TEXT,
  person TEXT,
  due_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_employee_id INTEGER REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'not_started',
  stage TEXT,
  version TEXT,
  checklist_done INTEGER,
  checklist_total INTEGER,
  due_date TEXT,
  due_time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL,
  bank TEXT,
  account_number TEXT,
  recipient_name TEXT,
  amount REAL NOT NULL,
  has_receipt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  paid_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Idempotent migration: CREATE TABLE IF NOT EXISTS above never adds columns to an
// already-existing table, so a column added later needs to be backfilled explicitly.
const projectColumns = db.prepare("PRAGMA table_info(projects)").all().map((c) => c.name);
if (!projectColumns.includes("completed_at")) {
  db.exec("ALTER TABLE projects ADD COLUMN completed_at TEXT");
}

const employeeCount = db.prepare("SELECT COUNT(*) AS c FROM employees").get().c;

if (employeeCount === 0) {
  // ---- Users (real auth accounts — email is the username) ----
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)"
  );

  // ---- Employees (real studio roster). Account dept -> manager tier,
  // Production dept -> production tier. Contract/leave/payroll are left
  // unrecorded (no fabricated HR data for real people) — the UI already
  // shows a graceful "not on file" state for those.
  const insertEmployee = db.prepare(
    `INSERT INTO employees (code, name, title, city, hire_date, birthday, phone, department, contract_status, workload_pct, base_salary_amount, user_id)
     VALUES (@code, @name, @title, @city, @hire_date, @birthday, @phone, @department, @contract_status, @workload_pct, @base_salary_amount, @user_id)`
  );
  const insertLeaveCycle = db.prepare(
    `INSERT INTO leave_cycles (employee_id, cycle_length_months, next_cycle_date, status) VALUES (?,6,NULL,'Төлөвлөөгүй')`
  );

  const employeeSeed = [
    { code: "EMP-001", name: "Пүрэвцэрэн", title: "Chief Executive Officer", department: "Account", email: "Purewtseren@pxl.mn", password: "10203040", birthday: "08-31", phone: "86869463", role: "ceo", workload_pct: 60 },
    { code: "EMP-002", name: "Гэрэлцэцэг", title: "Account manager", department: "Account", email: "Gereltsetseg@pxl.mn", password: "11223344", birthday: "09-22", phone: "80249191", role: "manager", workload_pct: 78 },
    { code: "EMP-003", name: "Сарнай", title: "Account manager", department: "Account", email: "Sarnai@pxl.mn", password: "22334455", birthday: "03-28", phone: "99087714", role: "manager", workload_pct: 70 },
    { code: "EMP-004", name: "Билгүүн", title: "Associate manager", department: "Account", email: "bilguunbbe1@gmail.com", password: "33445566", birthday: null, phone: "99179230", role: "manager", workload_pct: 65 },
    { code: "EMP-005", name: "Мөнхчимэг", title: "Operations manager", department: "Account", email: "munkhchimeg@pxl.mn", password: "44556677", birthday: "12-13", phone: "89914909", role: "manager", workload_pct: 72 },
    { code: "EMP-007", name: "Жамьян", title: "Video grapher/editor", department: "Production", email: "jaminadilbish@gmail.com", password: "66778899", birthday: null, phone: "99979768", role: "production", workload_pct: 80 },
    { code: "EMP-008", name: "Амар", title: "Video grapher/editor", department: "Production", email: "amaraa.byambajav@gmail.com", password: "77889911", birthday: "08-13", phone: "99182406", role: "production", workload_pct: 82 },
    { code: "EMP-009", name: "Энгүүн", title: "Graphic designer", department: "Production", email: "enguun123@gmail.com", password: "88990022", birthday: null, phone: "89559589", role: "production", workload_pct: 55 },
  ];

  const employeeIds = {};
  for (const e of employeeSeed) {
    const userId = e.email
      ? insertUser.run(e.email, bcrypt.hashSync(e.password, 10), e.name, e.role).lastInsertRowid
      : null;

    const id = insertEmployee.run({
      code: e.code,
      name: e.name,
      title: e.title,
      city: "Улаанбаатар",
      hire_date: null,
      birthday: e.birthday,
      phone: e.phone,
      department: e.department,
      contract_status: "Мэдээлэл дутуу",
      workload_pct: e.workload_pct,
      base_salary_amount: 0,
      user_id: userId,
    }).lastInsertRowid;
    employeeIds[e.name] = id;

    insertLeaveCycle.run(id);
  }

  // No demo projects/tasks/finance data — the workspace starts empty and
  // ready for real projects once the real employee roster is in place.
}

module.exports = db;
