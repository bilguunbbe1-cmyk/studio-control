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
  hire_date TEXT NOT NULL,
  birthday TEXT,
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
`);

const employeeCount = db.prepare("SELECT COUNT(*) AS c FROM employees").get().c;

if (employeeCount === 0) {
  // ---- Users (auth accounts, one per role) ----
  const insertUser = db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)"
  );
  const ceoUserId = insertUser.run(
    "demo@studio.mn",
    bcrypt.hashSync("demo1234", 10),
    "Пүрэвцэрэн",
    "ceo"
  ).lastInsertRowid;
  const managerUserId = insertUser.run(
    "manager@studio.mn",
    bcrypt.hashSync("manager1234", 10),
    "Гэрэлээ",
    "manager"
  ).lastInsertRowid;
  const productionUserId = insertUser.run(
    "production@studio.mn",
    bcrypt.hashSync("production1234", 10),
    "Тэмүүлэн",
    "production"
  ).lastInsertRowid;

  // ---- Employees (the 6-person studio roster) ----
  const insertEmployee = db.prepare(
    `INSERT INTO employees (code, name, title, city, hire_date, birthday, contract_status, workload_pct, base_salary_amount, user_id)
     VALUES (@code, @name, @title, @city, @hire_date, @birthday, @contract_status, @workload_pct, @base_salary_amount, @user_id)`
  );

  const employeeSeed = [
    {
      code: "EMP-004",
      name: "Гэрэлээ",
      title: "Project Manager",
      city: "Улаанбаатар",
      hire_date: "2025-12-01",
      birthday: null,
      contract_status: "Гэрээтэй",
      workload_pct: 84,
      base_salary_amount: 3200000,
      user_id: managerUserId,
      contract: { number: "VP-HR-2025-014", status: "Хүчинтэй", next_review: "2026-12-01" },
      leave_cycle: "2026-06-01",
      advance_pct: 42.6,
    },
    {
      code: "EMP-002",
      name: "Номин",
      title: "Project Manager",
      city: "Улаанбаатар",
      hire_date: "2024-08-12",
      birthday: "09-18",
      contract_status: "Гэрээ шинэчлэх",
      workload_pct: 62,
      base_salary_amount: 3000000,
      user_id: null,
      contract: { number: "VP-HR-2024-002", status: "Сунгах шаардлагатай", next_review: "2026-08-12" },
      leave_cycle: "2026-08-12",
      advance_pct: 40,
    },
    {
      code: "EMP-003",
      name: "Тэмүүлэн",
      title: "Editor",
      city: "Улаанбаатар",
      hire_date: "2026-02-03",
      birthday: "11-04",
      contract_status: "Гэрээтэй",
      workload_pct: 91,
      base_salary_amount: 2600000,
      user_id: productionUserId,
      contract: { number: "VP-HR-2026-001", status: "Хүчинтэй", next_review: "2027-02-03" },
      leave_cycle: "2026-08-03",
      advance_pct: 45,
    },
    {
      code: "EMP-005",
      name: "Ану",
      title: "Designer",
      city: "Улаанбаатар",
      hire_date: "2025-10-20",
      birthday: "02-12",
      contract_status: "Гэрээтэй",
      workload_pct: 74,
      base_salary_amount: 2400000,
      user_id: null,
      contract: { number: "VP-HR-2025-011", status: "Хүчинтэй", next_review: "2026-10-20" },
      leave_cycle: "2026-10-20",
      advance_pct: 40,
    },
    {
      code: "EMP-006",
      name: "Билгүүн",
      title: "Production",
      city: "Улаанбаатар",
      hire_date: "2026-01-15",
      birthday: "07-28",
      contract_status: "Мэдээлэл дутуу",
      workload_pct: 58,
      base_salary_amount: 2000000,
      user_id: null,
      contract: null,
      leave_cycle: "2026-07-15",
      advance_pct: 40,
    },
    {
      code: "EMP-001",
      name: "Анужин",
      title: "Media Manager",
      city: "Улаанбаатар",
      hire_date: "2025-06-10",
      birthday: "12-01",
      contract_status: "Гэрээтэй",
      workload_pct: 69,
      base_salary_amount: 2800000,
      user_id: null,
      contract: { number: "VP-HR-2025-006", status: "Хүчинтэй", next_review: "2026-06-10" },
      leave_cycle: "2026-06-10",
      advance_pct: 40,
    },
  ];

  const insertContract = db.prepare(
    `INSERT INTO contracts (employee_id, contract_number, start_date, next_review_date, status)
     VALUES (?,?,?,?,?)`
  );
  const insertLeaveCycle = db.prepare(
    `INSERT INTO leave_cycles (employee_id, cycle_length_months, next_cycle_date, status) VALUES (?,6,?,'Төлөвлөөгүй')`
  );
  const insertPayroll = db.prepare(
    `INSERT INTO payroll_entries (employee_id, date, label, status, amount, pct_of_base, is_advance) VALUES (?,?,?,?,?,?,?)`
  );

  const employeeIds = {};
  for (const e of employeeSeed) {
    const id = insertEmployee.run(e).lastInsertRowid;
    employeeIds[e.name] = id;

    if (e.contract) {
      insertContract.run(id, e.contract.number, e.hire_date, e.contract.next_review, e.contract.status);
    }
    insertLeaveCycle.run(id, e.leave_cycle);

    const advanceAmount = Math.round((e.base_salary_amount * e.advance_pct) / 100);
    const balanceAmount = e.base_salary_amount - advanceAmount;
    insertPayroll.run(id, "2026-08-05", "7 сарын үлдэгдэл", "Олгосон", balanceAmount, null, 0);
    insertPayroll.run(id, "2026-08-20", "8 сарын урьдчилгаа", "Төлөвлөсөн", advanceAmount, e.advance_pct, 1);
    insertPayroll.run(id, "2026-09-05", "8 сарын үлдэгдэл", "Төлөвлөсөн", balanceAmount, null, 0);
    insertPayroll.run(id, "2026-09-20", "9 сарын урьдчилгаа", "Төлөвлөсөн", advanceAmount, e.advance_pct, 1);
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
      lead: "Гэрэлээ",
      owner: "Гэрэлээ",
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
      lead: "Номин",
      owner: "Номин",
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
      lead: "Гэрэлээ",
      owner: "Гэрэлээ",
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
      lead: "Анужин",
      owner: "Анужин",
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
      ["Reel 04", "v03", "Тэмүүлэн", "editing"],
      ["Poster 12", "v02", "Ану", "client_review"],
      ["Reel 03", "FINAL", "Тэмүүлэн", "approved"],
    ],
    "VP-26021": [
      ["NURA intro", "v01", "Номин", "client_review"],
      ["Episode 01", "v04", "Тэмүүлэн", "editing"],
    ],
    "VP-26023": [
      ["Belmonte teaser", "v03", "Номин", "editing"],
      ["Belmonte main TVC", "v01", "Тэмүүлэн", "editing"],
    ],
    "VP-26026": [
      ["Hamilton key visual", "v02", "Ану", "approved"],
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
    { project: "VP-26018", title: "Reel 04 rough edit", assignee: "Тэмүүлэн", status: "editing", stage: "edit", version: "v03", due_date: "2026-08-11", due_time: "18:00" },
    { project: "VP-26023", title: "TVC shot list батлуулах", assignee: "Гэрэлээ", status: "awaiting_client", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-11", due_time: "15:00" },
    { project: "VP-26021", title: "Podcast set-ийн call sheet", assignee: "Номин", status: "editing", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-12", due_time: "11:00" },
    { project: "VP-26018", title: "Poster 12 internal review", assignee: "Ану", status: "internal_review", stage: "client_review", due_date: "2026-08-12" },
    { project: "VP-26026", title: "Media plan final", assignee: "Анужин", status: "not_started", stage: "final", due_date: "2026-08-14" },

    // Additional kanban cards (spec §6) to round out the 6-stage board
    { project: "VP-26023", title: "Belmonte shot list", assignee: "Тэмүүлэн", status: "not_started", stage: "pre_production", checklist_done: 6, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26018", title: "Баясал location check", assignee: "Тэмүүлэн", status: "not_started", stage: "ready_to_shoot", checklist_done: 8, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26021", title: "Hamilton interview", assignee: "Номин", status: "not_started", stage: "ready_to_shoot", checklist_done: 8, checklist_total: 8, due_date: "2026-08-12" },
    { project: "VP-26021", title: "NURA Episode 01", assignee: "Тэмүүлэн", status: "editing", stage: "shooting", due_date: "2026-08-12" },
    { project: "VP-26023", title: "Belmonte teaser", assignee: "Номин", status: "editing", stage: "edit", version: "v03" },
    { project: "VP-26021", title: "NURA intro", assignee: "Номин", status: "awaiting_client", stage: "client_review", due_date: "2026-08-12" },
    { project: "VP-26026", title: "Hamilton key visual", assignee: "Тэмүүлэн", status: "done", stage: "final", due_date: "2026-08-12" },
    { project: "VP-26018", title: "Баясал Reel 02", assignee: "Номин", status: "done", stage: "final", due_date: "2026-08-12" },

    // Extra open work items so each project's "missing tasks" count is non-trivial
    { project: "VP-26018", title: "Client contract addendum дагалдуулах", assignee: "Гэрэлээ", status: "not_started", due_date: "2026-08-20" },
    { project: "VP-26018", title: "Урьдчилгаа төлбөр хүлээх", assignee: "Гэрэлээ", status: "awaiting_client", due_date: "2026-08-18" },
    { project: "VP-26023", title: "Contract addendum шийдвэрлэх", assignee: "Гэрэлээ", status: "not_started", due_date: "2026-08-15" },
    { project: "VP-26023", title: "Casting сонголт баталгаажуулах", assignee: "Тэмүүлэн", status: "not_started", due_date: "2026-08-16" },
    { project: "VP-26023", title: "Location fee төлбөр баримтжуулах", assignee: "Гэрэлээ", status: "not_started", due_date: "2026-08-17" },
    { project: "VP-26023", title: "Post-production timeline batlah", assignee: "Номин", status: "editing", due_date: "2026-08-19" },
    { project: "VP-26026", title: "Оффисын зураг авалт төлөвлөх", assignee: "Анужин", status: "not_started", due_date: "2026-08-22" },
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
  insertDeadline.run("Reel 04 rough edit", projectIds["VP-26018"], "Баясал", "Тэмүүлэн", "2026-08-11");
  insertDeadline.run("TVC shot list батлуулах", projectIds["VP-26023"], "Belmonte", "Гэрэлээ", "2026-08-11");
  insertDeadline.run("Podcast set-ийн call sheet", projectIds["VP-26021"], "NURA", "Номин", "2026-08-12");
  insertDeadline.run("Poster 12 internal review", projectIds["VP-26018"], "Баясал", "Ану", "2026-08-13");
}

module.exports = db;
