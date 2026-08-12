const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "data.sqlite"));
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
    { code: "EMP-006", name: "Түвшинтөгс", title: "Head of production", department: "Production", email: "quitmendez9917@gmail.com", password: "55667788", birthday: null, phone: "85777010", role: "production", workload_pct: 85 },
    { code: "EMP-007", name: "Жамьян", title: "Video grapher/editor", department: "Production", email: "jaminadilbish@gmail.com", password: "66778899", birthday: null, phone: "99979768", role: "production", workload_pct: 80 },
    { code: "EMP-008", name: "Амар", title: "Video grapher/editor", department: "Production", email: "amaraa.byambajav@gmail.com", password: "77889911", birthday: "08-13", phone: "99182406", role: "production", workload_pct: 82 },
    { code: "EMP-009", name: "Энгүүн", title: "Graphic designer", department: "Production", email: null, password: null, birthday: null, phone: "89559589", role: "production", workload_pct: 55 },
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

  // ---- Projects ----
  const insertProject = db.prepare(
    `INSERT INTO projects (code, name, client, lead, owner_employee_id, contract_amount, budget, spent, progress_pct, status, due_date, shoot_date, call_sheet_done, call_sheet_total)
     VALUES (@code, @name, @client, @lead, @owner_employee_id, @contract_amount, @budget, @spent, @progress_pct, @status, @due_date, @shoot_date, @call_sheet_done, @call_sheet_total)`
  );

  const projectSeed = [
    {
      code: "VP-26018",
      name: "Баясал — 8 сарын контент",
      client: "KHAN TUGUL",
      lead: "Гэрэлцэцэг",
      owner: "Гэрэлцэцэг",
      contract_amount: 32000000,
      spent: 14400000,
      progress_pct: 68,
      status: "risk",
      due_date: "2026-08-31",
      shoot_date: "2026-08-14",
      call_sheet_done: 6,
      call_sheet_total: 8,
    },
    {
      code: "VP-26021",
      name: "NURA Podcast Season 2",
      client: "NURA Mongolia",
      lead: "Сарнай",
      owner: "Сарнай",
      contract_amount: 24000000,
      spent: 7100000,
      progress_pct: 42,
      status: "ontrack",
      due_date: "2026-09-15",
      shoot_date: null,
      call_sheet_done: null,
      call_sheet_total: null,
    },
    {
      code: "VP-26023",
      name: "Belmonte TVC",
      client: "Belmonte Residence",
      lead: "Гэрэлцэцэг",
      owner: "Гэрэлцэцэг",
      contract_amount: 48000000,
      spent: 18600000,
      progress_pct: 31,
      status: "late",
      due_date: "2026-08-24",
      shoot_date: "2026-08-16",
      call_sheet_done: null,
      call_sheet_total: null,
    },
    {
      code: "VP-26026",
      name: "Hamilton Office Campaign",
      client: "Hamilton",
      lead: "Мөнхчимэг",
      owner: "Мөнхчимэг",
      contract_amount: 18000000,
      spent: 3300000,
      progress_pct: 22,
      status: "ontrack",
      due_date: "2026-09-30",
      shoot_date: null,
      call_sheet_done: null,
      call_sheet_total: null,
    },
  ];

  const CHECKLIST_LABELS = [
    "Brief бүрэн",
    "Үнийн санал батлагдсан",
    "Гэрээ байгуулсан",
    "Гэрээний хавсралт",
    "Урьдчилгаа орсон",
    "Deliverable тодорхой",
    "Timeline батлагдсан",
    "Баг томилогдсон",
  ];
  const CHECKLIST_INCOMPLETE = ["Гэрээний хавсралт", "Урьдчилгаа орсон"];

  const insertChecklist = db.prepare(
    "INSERT INTO checklist_items (project_id, label, complete, sort_order) VALUES (?,?,?,?)"
  );
  const insertDeliverable = db.prepare(
    "INSERT INTO deliverables (project_id, title, done_count, total_count) VALUES (?,?,?,?)"
  );
  const insertCostItem = db.prepare(
    "INSERT INTO cost_line_items (project_id, category, amount, receipt_status) VALUES (?,?,?,?)"
  );
  const insertReviewItem = db.prepare(
    "INSERT INTO review_items (project_id, title, version, editor_employee_id, review_status) VALUES (?,?,?,?,?)"
  );

  const DELIVERABLES_BY_PROJECT = {
    "VP-26018": [
      ["8-р сарын Reel", 4, 6],
      ["Social poster", 8, 12],
      ["Billboard adaptation", 1, 4],
      ["Media placement", 0, 3],
    ],
    "VP-26021": [
      ["Episode edит", 5, 10],
      ["Show notes", 6, 10],
      ["Trailer cut", 1, 2],
    ],
    "VP-26023": [
      ["TVC main cut", 1, 3],
      ["Behind the scenes", 2, 5],
      ["Social cutdowns", 0, 6],
    ],
    "VP-26026": [
      ["Key visual", 3, 4],
      ["Оффисын зураг", 5, 5],
      ["Campaign video", 0, 2],
    ],
  };

  const COST_ITEMS_BY_PROJECT = {
    "VP-26018": [
      ["Студи", 1200000, "has_receipt"],
      ["Props", 850000, "no_receipt"],
      ["Freelancer", 2400000, "pending"],
      ["Гэрэл, тоног төхөөрөмж", 3200000, "has_receipt"],
      ["Тээвэр", 420000, "has_receipt"],
      ["Пост-продакшн", 6330000, "has_receipt"],
    ],
    "VP-26021": [
      ["Студийн түрээс", 800000, "no_receipt"],
      ["Editing", 3100000, "has_receipt"],
      ["Podcast hosting", 200000, "has_receipt"],
      ["Freelancer", 3000000, "has_receipt"],
    ],
    "VP-26023": [
      ["Props худалдан авалт", 1250000, "no_receipt"],
      ["Гэрэл", 4200000, "has_receipt"],
      ["Casting", 2100000, "has_receipt"],
      ["Location fee", 3800000, "has_receipt"],
      ["Post-production", 4200000, "pending"],
      ["Тээврийн зардал", 3050000, "no_receipt"],
    ],
    "VP-26026": [
      ["Гэрэл зураг", 1800000, "has_receipt"],
      ["Video production", 1500000, "has_receipt"],
    ],
  };

  const REVIEW_ITEMS_BY_PROJECT = {
    "VP-26018": [
      ["Reel 04", "v03", "Амар", "editing"],
      ["Poster 12", "v02", "Энгүүн", "client_review"],
      ["Reel 03", "FINAL", "Амар", "approved"],
    ],
    "VP-26021": [
      ["NURA intro", "v01", "Сарнай", "client_review"],
      ["Episode 01", "v04", "Амар", "editing"],
    ],
    "VP-26023": [
      ["Belmonte teaser", "v03", "Сарнай", "editing"],
      ["Belmonte main TVC", "v01", "Амар", "editing"],
    ],
    "VP-26026": [
      ["Hamilton key visual", "v02", "Энгүүн", "approved"],
    ],
  };

  const projectIds = {};
  for (const p of projectSeed) {
    const info = insertProject.run({
      code: p.code,
      name: p.name,
      client: p.client,
      lead: p.lead,
      owner_employee_id: employeeIds[p.owner] || null,
      contract_amount: p.contract_amount,
      budget: p.contract_amount,
      spent: p.spent,
      progress_pct: p.progress_pct,
      status: p.status,
      due_date: p.due_date,
      shoot_date: p.shoot_date,
      call_sheet_done: p.call_sheet_done,
      call_sheet_total: p.call_sheet_total,
    });
    const id = info.lastInsertRowid;
    projectIds[p.code] = id;

    CHECKLIST_LABELS.forEach((label, i) => {
      insertChecklist.run(id, label, CHECKLIST_INCOMPLETE.includes(label) ? 0 : 1, i);
    });

    (DELIVERABLES_BY_PROJECT[p.code] || []).forEach(([title, done, total]) => {
      insertDeliverable.run(id, title, done, total);
    });

    (COST_ITEMS_BY_PROJECT[p.code] || []).forEach(([category, amount, receipt]) => {
      insertCostItem.run(id, category, amount, receipt);
    });

    (REVIEW_ITEMS_BY_PROJECT[p.code] || []).forEach(([title, version, editorName, status]) => {
      insertReviewItem.run(id, title, version, employeeIds[editorName] || null, status);
    });
  }

  // ---- Tasks (backs Миний ажил, Продакшн kanban, and each project's "Одоо хийх зүйл") ----
  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, title, assignee_employee_id, status, stage, version, checklist_done, checklist_total, due_date, due_time)
     VALUES (@project_id, @title, @assignee_employee_id, @status, @stage, @version, @checklist_done, @checklist_total, @due_date, @due_time)`
  );

  const taskSeed = [
    // Миний ажил (spec §5)
    { project: "VP-26018", title: "Reel 04 rough edit", assignee: "Амар", status: "editing", stage: "edit", version: "v03", due_date: "2026-08-11", due_time: "18:00" },
    { project: "VP-26023", title: "TVC shot list батлуулах", assignee: "Гэрэлцэцэг", status: "awaiting_client", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-11", due_time: "15:00" },
    { project: "VP-26021", title: "Podcast set-ийн call sheet", assignee: "Сарнай", status: "editing", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-12", due_time: "11:00" },
    { project: "VP-26018", title: "Poster 12 internal review", assignee: "Энгүүн", status: "internal_review", stage: "client_review", due_date: "2026-08-12" },
    { project: "VP-26026", title: "Media plan final", assignee: "Мөнхчимэг", status: "not_started", stage: "final", due_date: "2026-08-14" },

    // Additional kanban cards (spec §6) to round out the 6-stage board
    { project: "VP-26023", title: "Belmonte shot list", assignee: "Амар", status: "not_started", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26018", title: "Баясал location check", assignee: "Амар", status: "not_started", stage: "ready_to_shoot", checklist_done: 8, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26021", title: "Hamilton interview", assignee: "Сарнай", status: "not_started", stage: "ready_to_shoot", checklist_done: 8, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26021", title: "NURA Episode 01", assignee: "Амар", status: "editing", stage: "shooting", due_date: "2026-08-12" },
    { project: "VP-26023", title: "Belmonte teaser", assignee: "Сарнай", status: "editing", stage: "edit", version: "v03" },
    { project: "VP-26021", title: "NURA intro", assignee: "Сарнай", status: "awaiting_client", stage: "client_review", due_date: "2026-08-12" },
    { project: "VP-26026", title: "Hamilton key visual", assignee: "Амар", status: "done", stage: "final", due_date: "2026-08-12" },
    { project: "VP-26018", title: "Баясал Reel 02", assignee: "Сарнай", status: "done", stage: "final", due_date: "2026-08-12" },

    // Extra open work items so each project's "missing tasks" count is non-trivial
    { project: "VP-26018", title: "Client contract addendum дагалдуулах", assignee: "Гэрэлцэцэг", status: "not_started", due_date: "2026-08-20" },
    { project: "VP-26018", title: "Урьдчилгаа төлбөр хүлээх", assignee: "Гэрэлцэцэг", status: "awaiting_client", due_date: "2026-08-18" },
    { project: "VP-26023", title: "Contract addendum шийдвэрлэх", assignee: "Гэрэлцэцэг", status: "not_started", due_date: "2026-08-15" },
    { project: "VP-26023", title: "Casting сонголт баталгаажуулах", assignee: "Амар", status: "not_started", due_date: "2026-08-16" },
    { project: "VP-26023", title: "Location fee төлбөр баримтжуулах", assignee: "Гэрэлцэцэг", status: "not_started", due_date: "2026-08-17" },
    { project: "VP-26023", title: "Post-production timeline batlah", assignee: "Сарнай", status: "editing", due_date: "2026-08-19" },
    { project: "VP-26026", title: "Оффисын зураг авалт төлөвлөх", assignee: "Мөнхчимэг", status: "not_started", due_date: "2026-08-22" },
  ];

  taskSeed.forEach((t) => {
    insertTask.run({
      project_id: projectIds[t.project],
      title: t.title,
      assignee_employee_id: employeeIds[t.assignee] || null,
      status: t.status,
      stage: t.stage || null,
      version: t.version || null,
      checklist_done: t.checklist_done ?? null,
      checklist_total: t.checklist_total ?? null,
      due_date: t.due_date || null,
      due_time: t.due_time || null,
    });
  });

  // ---- Blockers (spec §6) ----
  const insertBlocker = db.prepare(
    "INSERT INTO blockers (project_id, description, resolved) VALUES (?,?,0)"
  );
  insertBlocker.run(projectIds["VP-26023"], "Belmonte shot list approval");
  insertBlocker.run(projectIds["VP-26021"], "NURA студийн төлбөр");

  // ---- Decisions / approvals (spec §2.1) ----
  const insertApproval = db.prepare(
    "INSERT INTO approvals (kind, title, amount, project_id, reason) VALUES (?,?,?,?,?)"
  );
  insertApproval.run("budget", "Belmonte — зураг авалтын нэмэлт гэрэл", 1250000, projectIds["VP-26023"], null);
  insertApproval.run("flag", "Hamilton — гэрээний хавсралт дутуу", null, projectIds["VP-26026"], "Гэрээний хавсралт хараахан ирээгүй тул дүрэм зөрчиж ажлыг эхлүүлэх шаардлагатай.");
  insertApproval.run("expense", "NURA — студийн түрээс", 800000, projectIds["VP-26021"], null);
  insertApproval.run("scope", "Баясал — нэмэлт 2 reel", 2400000, projectIds["VP-26018"], null);

  // ---- Deadlines (spec §2.1 "Ойрын хугацаа") ----
  const insertDeadline = db.prepare(
    "INSERT INTO deadlines (title, project_id, project, person, due_date) VALUES (?,?,?,?,?)"
  );
  insertDeadline.run("Reel 04 rough edit", projectIds["VP-26018"], "Баясал", "Амар", "2026-08-11");
  insertDeadline.run("TVC shot list батлуулах", projectIds["VP-26023"], "Belmonte", "Гэрэлцэцэг", "2026-08-11");
  insertDeadline.run("Podcast set-ийн call sheet", projectIds["VP-26021"], "NURA", "Сарнай", "2026-08-12");
  insertDeadline.run("Poster 12 internal review", projectIds["VP-26018"], "Баясал", "Энгүүн", "2026-08-13");
}

module.exports = db;
