const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = requireRole("ceo", "manager");

// ---- Deadlines ----
router.get("/deadlines", (req, res) => {
  const rows = db.prepare("SELECT * FROM deadlines ORDER BY due_date ASC LIMIT 20").all();
  res.json(rows.map((d) => ({ id: d.id, title: d.title, project: d.project, person: d.person, dueDate: d.due_date })));
});

router.post("/deadlines", CAN_MANAGE, (req, res) => {
  const { title, projectId, project, person, dueDate } = req.body || {};
  if (!title || !dueDate) return res.status(400).json({ error: "title, dueDate шаардлагатай" });
  const info = db
    .prepare("INSERT INTO deadlines (title, project_id, project, person, due_date) VALUES (?,?,?,?,?)")
    .run(title, projectId || null, project || "", person || "", dueDate);
  res.status(201).json({ id: info.lastInsertRowid });
});

// ---- Search ----
router.get("/search", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  if (!q) return res.json({ projects: [], tasks: [], employees: [] });

  const projects = db
    .prepare("SELECT id, code, name, client FROM projects WHERE LOWER(name) LIKE ? OR LOWER(client) LIKE ? LIMIT 5")
    .all(`%${q}%`, `%${q}%`);

  const tasks = db
    .prepare(
      `SELECT t.id, t.title, p.name AS project_name FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE LOWER(t.title) LIKE ? LIMIT 5`
    )
    .all(`%${q}%`);

  const employees =
    req.user.role === "production"
      ? []
      : db.prepare("SELECT id, name, title FROM employees WHERE LOWER(name) LIKE ? OR LOWER(title) LIKE ? LIMIT 5").all(`%${q}%`, `%${q}%`);

  res.json({
    projects: projects.map((p) => ({ id: p.id, label: p.name, sub: p.client, type: "project" })),
    tasks: tasks.map((t) => ({ id: t.id, label: t.title, sub: t.project_name, type: "task" })),
    employees: employees.map((e) => ({ id: e.id, label: e.name, sub: e.title, type: "employee" })),
  });
});

// ---- Notifications ----
router.get("/notifications", (req, res) => {
  const items = [];

  const personal = db
    .prepare("SELECT id, message, kind, created_at FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC")
    .all(req.user.id);
  personal.forEach((n) => items.push({ id: `n${n.id}`, text: n.message, kind: n.kind }));
  if (personal.length) {
    db.prepare(
      `UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${personal.map(() => "?").join(",")})`
    ).run(req.user.id, ...personal.map((n) => n.id));
  }

  if (req.user.role === "ceo" || req.user.role === "manager") {
    const pending = db.prepare("SELECT COUNT(*) AS c FROM approvals WHERE status = 'pending'").get().c;
    if (pending) items.push({ id: "decisions", text: `${pending} шийдвэр хүлээгдэж байна`, kind: "decision" });

    const paymentRequests = db.prepare("SELECT COUNT(*) AS c FROM payment_requests WHERE status = 'pending'").get().c;
    if (paymentRequests) items.push({ id: "payments", text: `${paymentRequests} гүйлгээний хүсэлт хүлээгдэж байна`, kind: "payment" });

    const blockers = db.prepare("SELECT COUNT(*) AS c FROM blockers WHERE resolved = 0").get().c;
    if (blockers) items.push({ id: "blockers", text: `${blockers} blocker шийдвэрлэгдээгүй байна`, kind: "blocker" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dueToday = db.prepare("SELECT COUNT(*) AS c FROM deadlines WHERE due_date = ?").get(today).c;
  if (dueToday) items.push({ id: "deadlines", text: `${dueToday} даалгавар өнөөдөр дуусна`, kind: "deadline" });

  res.json({ count: items.length, items });
});

module.exports = router;
