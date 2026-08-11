const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const db = new Database(path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client TEXT,
  lead TEXT,
  budget REAL NOT NULL DEFAULT 0,
  spent REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ontrack',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by INTEGER,
  decided_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  project TEXT,
  person TEXT,
  due_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Seed sample data only if empty
const projectCount = db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
if (projectCount === 0) {
  const insertProject = db.prepare(
    "INSERT INTO projects (name, client, lead, budget, spent, status) VALUES (?,?,?,?,?,?)"
  );
  insertProject.run("Долгион — 8 сарын контент", "KHAN TUGUL", "Гэрэлээ", 18000000, 12240000, "risk");
  insertProject.run("Аура Подкаст 2-р улирал", "Aura Mongolia", "Номин", 9000000, 3780000, "ontrack");
  insertProject.run("Хилтон ТВС", "Hilton Residence", "Гэрэлээ", 14000000, 11620000, "late");
  insertProject.run("Оффис Кампайн", "Норта", "Анужин", 6000000, 1500000, "ontrack");

  const insertApproval = db.prepare(
    "INSERT INTO approvals (kind, title, amount) VALUES (?,?,?)"
  );
  insertApproval.run("budget", "Хилтон — зураг авалтын нэмэлт гэрэл", 1250000);
  insertApproval.run("flag", "Оффис Кампайн — гэрээний хавсралт дутуу", null);
  insertApproval.run("expense", "Аура — студийн түрээс", 800000);
  insertApproval.run("scope", "Долгион — нэмэлт 2 reel", 2400000);

  const insertDeadline = db.prepare(
    "INSERT INTO deadlines (title, project, person, due_date) VALUES (?,?,?,?)"
  );
  const today = new Date();
  const in2 = new Date(Date.now() + 2 * 86400000);
  insertDeadline.run("Reel 04 rough edit", "Долгион", "Тэмүүлэн", today.toISOString().slice(0, 10));
  insertDeadline.run("TVC shot list батлуулах", "Хилтон", "Гэрэлээ", today.toISOString().slice(0, 10));
  insertDeadline.run("Podcast set-ийн call sheet", "Аура", "Номин", in2.toISOString().slice(0, 10));
  insertDeadline.run("Poster 12 дотоод review", "Долгион", "Ану", in2.toISOString().slice(0, 10));
}

// Seed a default demo user if none exist (email: demo@studio.mn / password: demo1234)
const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (userCount === 0) {
  const hash = bcrypt.hashSync("demo1234", 10);
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)"
  ).run("demo@studio.mn", hash, "Демо хэрэглэгч", "ceo");
}

module.exports = db;
