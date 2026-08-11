const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function deriveStatus(spent, budget) {
  if (!budget) return "ontrack";
  const pct = spent / budget;
  if (pct >= 0.9) return "late";
  if (pct >= 0.6) return "risk";
  return "ontrack";
}

// ---- Projects ----
router.get("/projects", (req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  res.json(rows);
});

router.post("/projects", (req, res) => {
  const { name, client, lead, budget } = req.body || {};
  if (!name || !budget) return res.status(400).json({ error: "name, budget шаардлагатай" });
  const info = db
    .prepare("INSERT INTO projects (name, client, lead, budget, spent, status) VALUES (?,?,?,?,0,'ontrack')")
    .run(name, client || "", lead || req.user.name, Number(budget));
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Adjust spend on a project by a delta (positive or negative), status auto-recomputed
router.patch("/projects/:id/spend", (req, res) => {
  const { delta } = req.body || {};
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });

  let spent = project.spent + Number(delta || 0);
  spent = Math.max(0, Math.min(project.budget, spent));
  const status = deriveStatus(spent, project.budget);

  db.prepare("UPDATE projects SET spent = ?, status = ? WHERE id = ?").run(spent, status, project.id);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id);
  res.json(updated);
});

router.delete("/projects/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---- Approvals ----
router.get("/approvals", (req, res) => {
  const status = req.query.status || "pending";
  const rows = db
    .prepare("SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC")
    .all(status);
  res.json(rows);
});

router.post("/approvals", (req, res) => {
  const { kind, title, amount } = req.body || {};
  if (!kind || !title) return res.status(400).json({ error: "kind, title шаардлагатай" });
  const info = db
    .prepare("INSERT INTO approvals (kind, title, amount) VALUES (?,?,?)")
    .run(kind, title, amount ?? null);
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.post("/approvals/:id/decide", (req, res) => {
  const { decision } = req.body || {}; // 'approved' | 'rejected'
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision нь approved эсвэл rejected байх ёстой" });
  }
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Хүсэлт олдсонгүй" });

  db.prepare(
    "UPDATE approvals SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(decision, req.user.id, row.id);

  const updated = db.prepare("SELECT * FROM approvals WHERE id = ?").get(row.id);
  res.json(updated);
});

// ---- Deadlines ----
router.get("/deadlines", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM deadlines ORDER BY due_date ASC LIMIT 20")
    .all();
  res.json(rows);
});

router.post("/deadlines", (req, res) => {
  const { title, project, person, due_date } = req.body || {};
  if (!title || !due_date) return res.status(400).json({ error: "title, due_date шаардлагатай" });
  const info = db
    .prepare("INSERT INTO deadlines (title, project, person, due_date) VALUES (?,?,?,?)")
    .run(title, project || "", person || "", due_date);
  const row = db.prepare("SELECT * FROM deadlines WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// ---- Summary (computed) ----
router.get("/summary", (req, res) => {
  const projects = db.prepare("SELECT * FROM projects").all();
  const budget = projects.reduce((s, p) => s + p.budget, 0);
  const spent = projects.reduce((s, p) => s + p.spent, 0);
  const risky = projects.filter((p) => p.status !== "ontrack").length;
  const pendingApprovals = db
    .prepare("SELECT COUNT(*) AS c FROM approvals WHERE status = 'pending'")
    .get().c;

  res.json({
    projectCount: projects.length,
    riskyCount: risky,
    budget,
    spent,
    remaining: budget - spent,
    marginPct: budget ? Math.round(((budget - spent) / budget) * 100) : 0,
    pendingApprovals,
  });
});

module.exports = router;
