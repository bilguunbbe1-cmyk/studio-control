const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole("ceo"));

// Parents before children, so restore can insert in this order without
// tripping foreign key constraints.
const TABLES_IN_ORDER = [
  "users",
  "employees",
  "contracts",
  "leave_cycles",
  "leave_records",
  "payroll_entries",
  "projects",
  "deliverables",
  "checklist_items",
  "cost_line_items",
  "client_payments",
  "review_items",
  "files",
  "blockers",
  "approvals",
  "deadlines",
  "tasks",
  "payment_requests",
  "notifications",
];

router.get("/backup/export", (req, res) => {
  const tables = {};
  for (const t of TABLES_IN_ORDER) {
    tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  res.json({ exportedAt: new Date().toISOString(), tables });
});

router.post("/backup/import", (req, res) => {
  const { tables } = req.body || {};
  if (!tables || typeof tables !== "object") {
    return res.status(400).json({ error: "tables шаардлагатай" });
  }

  const restore = db.transaction(() => {
    db.pragma("foreign_keys = OFF");
    for (const t of [...TABLES_IN_ORDER].reverse()) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    for (const t of TABLES_IN_ORDER) {
      const rows = tables[t] || [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => "?").join(",");
      const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${placeholders})`);
      for (const row of rows) stmt.run(cols.map((c) => row[c]));
    }
    db.pragma("foreign_keys = ON");
  });

  restore();
  res.json({ ok: true, restoredAt: new Date().toISOString() });
});

module.exports = router;
