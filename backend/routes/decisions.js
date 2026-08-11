const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = requireRole("ceo", "manager");

function shapeDecision(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    amount: row.amount,
    projectId: row.project_id,
    projectName: row.project_name,
    reason: row.reason,
    status: row.status,
  };
}

function baseQuery() {
  return `SELECT a.*, p.name AS project_name FROM approvals a LEFT JOIN projects p ON p.id = a.project_id`;
}

// ---- Decisions / approvals ----
router.get("/decisions", CAN_MANAGE, (req, res) => {
  const status = req.query.status || "pending";
  const rows = db.prepare(`${baseQuery()} WHERE a.status = ? ORDER BY a.created_at DESC`).all(status);
  res.json(rows.map(shapeDecision));
});

router.post("/decisions", CAN_MANAGE, (req, res) => {
  const { kind, title, amount, projectId, reason } = req.body || {};
  if (!kind || !title) return res.status(400).json({ error: "kind, title шаардлагатай" });
  const info = db
    .prepare("INSERT INTO approvals (kind, title, amount, project_id, reason) VALUES (?,?,?,?,?)")
    .run(kind, title, amount ?? null, projectId || null, reason || null);
  const row = db.prepare(`${baseQuery()} WHERE a.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(shapeDecision(row));
});

function decide(req, res, decision) {
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Хүсэлт олдсонгүй" });

  db.prepare("UPDATE approvals SET status = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?").run(
    decision,
    req.user.id,
    row.id
  );
  const updated = db.prepare(`${baseQuery()} WHERE a.id = ?`).get(row.id);
  res.json(shapeDecision(updated));
}

router.post("/decisions/:id/approve", CAN_MANAGE, (req, res) => decide(req, res, "approved"));
router.post("/decisions/:id/reject", CAN_MANAGE, (req, res) => decide(req, res, "rejected"));
router.post("/decisions/:id/override", CAN_MANAGE, (req, res) => decide(req, res, "overridden"));

// ---- Production blockers ----
router.get("/blockers", (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.description, b.resolved, p.name AS project_name
       FROM blockers b LEFT JOIN projects p ON p.id = b.project_id
       WHERE b.resolved = 0 ORDER BY b.created_at DESC`
    )
    .all();
  res.json(rows.map((r) => ({ id: r.id, description: r.description, projectName: r.project_name, resolved: !!r.resolved })));
});

router.post("/blockers/:id/resolve", CAN_MANAGE, (req, res) => {
  const row = db.prepare("SELECT * FROM blockers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Blocker олдсонгүй" });
  db.prepare("UPDATE blockers SET resolved = 1 WHERE id = ?").run(row.id);
  res.json({ ok: true });
});

module.exports = router;
