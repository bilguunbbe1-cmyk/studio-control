const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { UPLOAD_DIR } = require("../lib/uploads");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole("ceo"));

// Every stored filename the database points at (project/employee files + photos).
function referencedUploads() {
  const names = db.prepare("SELECT stored_path AS n FROM files").all().map((r) => r.n);
  const photos = db.prepare("SELECT photo_url AS n FROM employees WHERE photo_url IS NOT NULL").all().map((r) => r.n);
  return new Set([...names, ...photos].filter(Boolean));
}

// Which referenced files are actually on disk -- shows whether UPLOAD_DIR survived.
router.get("/backup/uploads/status", (req, res) => {
  const referenced = [...referencedUploads()];
  const missing = referenced.filter((n) => !fs.existsSync(path.join(UPLOAD_DIR, n)));
  res.json({ uploadDir: UPLOAD_DIR, usingDefaultDir: !process.env.UPLOAD_DIR, referenced: referenced.length, missing });
});

// Puts backed-up files back under their original stored names. Only names the
// database already references are accepted, existing files are never
// overwritten, and names are taken as bare basenames so nothing can be written
// outside UPLOAD_DIR.
const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 50 } });
router.post("/backup/uploads/restore", restoreUpload.array("files"), (req, res) => {
  const referenced = referencedUploads();
  const result = { restored: [], skippedExisting: [], rejected: [] };
  for (const f of req.files || []) {
    const name = f.originalname;
    if (path.basename(name) !== name || !referenced.has(name)) {
      result.rejected.push(name);
      continue;
    }
    const dest = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(dest)) {
      result.skippedExisting.push(name);
      continue;
    }
    fs.writeFileSync(dest, f.buffer);
    result.restored.push(name);
  }
  res.json(result);
});

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
  "salary_payments",
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
