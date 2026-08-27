const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../lib/uploads");
const { canManage, employeeById, employeeIdForUser, deriveStatus, deliverableProgress, PROJECT_FILE_CATEGORIES } = require("../lib/helpers");

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = requireRole("ceo", "manager");

function assertOwnsProject(req, res, project) {
  if (req.user.role === "ceo") return true;
  const myEmployeeId = employeeIdForUser(req.user.id);
  if (myEmployeeId && project.owner_employee_id === myEmployeeId) return true;
  res.status(403).json({ error: "Та зөвхөн өөрийн удирдаж буй төслийг засах эрхтэй" });
  return false;
}

function projectForDeliverable(id) {
  const d = db.prepare("SELECT project_id FROM deliverables WHERE id = ?").get(id);
  return d && db.prepare("SELECT * FROM projects WHERE id = ?").get(d.project_id);
}

function projectForCostItem(id) {
  const c = db.prepare("SELECT project_id FROM cost_line_items WHERE id = ?").get(id);
  return c && db.prepare("SELECT * FROM projects WHERE id = ?").get(c.project_id);
}

function projectForReviewItem(id) {
  const r = db.prepare("SELECT project_id FROM review_items WHERE id = ?").get(id);
  return r && db.prepare("SELECT * FROM projects WHERE id = ?").get(r.project_id);
}

function costSummary(projectId) {
  const rows = db.prepare("SELECT amount, receipt_status FROM cost_line_items WHERE project_id = ?").all(projectId);
  const total = rows.reduce((s, c) => s + c.amount, 0);
  const documented = rows.filter((c) => c.receipt_status === "has_receipt").reduce((s, c) => s + c.amount, 0);
  return { total, documented, pct: total ? Math.round((documented / total) * 100) : 100 };
}

function paymentTotal(projectId) {
  const r = db.prepare("SELECT SUM(amount) AS total FROM client_payments WHERE project_id = ?").get(projectId);
  return r.total || 0;
}

function canSeeFinancials(req, row) {
  if (req.user.role === "ceo") return true;
  if (req.user.role === "production") return false;
  const myEmployeeId = employeeIdForUser(req.user.id);
  return !!myEmployeeId && row.owner_employee_id === myEmployeeId;
}

function shapeListItem(row, req) {
  const openTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status != 'done'").get(row.id).c;
  const owner = employeeById(row.owner_employee_id);
  const docs = costSummary(row.id);

  const base = {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    lead: owner ? owner.name : row.lead,
    ownerEmployeeId: row.owner_employee_id,
    status: row.status,
    progressPct: deliverableProgress(row.id),
    documentationPct: docs.pct,
    missingTasksCount: openTasks,
    dueDate: row.due_date,
    completedAt: row.completed_at,
  };
  if (!canSeeFinancials(req, row)) return base;
  return {
    ...base,
    contractAmount: row.contract_amount,
    budget: row.budget,
    spent: row.spent,
    budgetSpentPct: row.budget ? Math.round((row.spent / row.budget) * 100) : 0,
  };
}

function shapeDetail(row, req) {
  const list = shapeListItem(row, req);

  const checklist = db
    .prepare("SELECT id, label, complete FROM checklist_items WHERE project_id = ? ORDER BY sort_order")
    .all(row.id)
    .map((c) => ({ id: c.id, label: c.label, complete: !!c.complete }));

  const deliverables = db
    .prepare("SELECT id, title, done_count AS doneCount, total_count AS totalCount FROM deliverables WHERE project_id = ?")
    .all(row.id);

  const nextTasks = db
    .prepare(
      `SELECT t.id, t.title, t.due_date AS dueDate, t.due_time AS dueTime, e.name AS assignee
       FROM tasks t LEFT JOIN employees e ON e.id = t.assignee_employee_id
       WHERE t.project_id = ? AND t.status != 'done'
       ORDER BY (t.due_date IS NULL), t.due_date ASC, (t.due_time IS NULL), t.due_time ASC LIMIT 5`
    )
    .all(row.id);

  const reviewItems = db
    .prepare(
      `SELECT r.id, r.title, r.version, r.review_status AS reviewStatus, e.name AS editor
       FROM review_items r LEFT JOIN employees e ON e.id = r.editor_employee_id
       WHERE r.project_id = ?`
    )
    .all(row.id);

  const costItemsRaw = db.prepare("SELECT id, category, amount, receipt_status AS receiptStatus FROM cost_line_items WHERE project_id = ?").all(row.id);
  const costItems = canSeeFinancials(req, row) ? costItemsRaw : costItemsRaw.map((c) => ({ id: c.id, category: c.category, receiptStatus: c.receiptStatus }));

  const fileFolders = PROJECT_FILE_CATEGORIES.map((category) => {
    const r = db.prepare("SELECT COUNT(*) AS c, SUM(CASE WHEN status = 'Дутуу' THEN 1 ELSE 0 END) AS missing FROM files WHERE owner_type = 'project' AND owner_id = ? AND category = ?").get(row.id, category);
    return { category, count: r.c || 0, missing: r.missing || 0 };
  });

  const blockers = db.prepare("SELECT id, description, resolved FROM blockers WHERE project_id = ?").all(row.id);

  const financeExtra = canSeeFinancials(req, row)
    ? {
        grossProfit: row.contract_amount - row.spent,
        marginPct: row.contract_amount ? Math.round(((row.contract_amount - row.spent) / row.contract_amount) * 100) : 0,
        received: paymentTotal(row.id),
        payments: db
          .prepare("SELECT id, amount, received_at AS receivedAt, note FROM client_payments WHERE project_id = ? ORDER BY received_at DESC")
          .all(row.id),
      }
    : {};

  return {
    ...list,
    ...financeExtra,
    shootDate: row.shoot_date,
    callSheetDone: row.call_sheet_done,
    callSheetTotal: row.call_sheet_total,
    checklist,
    deliverables,
    nextTasks,
    reviewItems,
    costItems,
    fileFolders,
    blockers: blockers.filter((b) => !b.resolved),
  };
}

// ---- Projects ----
router.get("/projects", (req, res) => {
  const { status, search, finished } = req.query;

  let rows = finished === "1"
    ? db.prepare("SELECT * FROM projects WHERE completed_at IS NOT NULL ORDER BY completed_at DESC").all()
    : db.prepare("SELECT * FROM projects WHERE completed_at IS NULL ORDER BY created_at DESC").all();

  if (status && status !== "all") {
    rows = rows.filter((p) => p.status === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || (p.client || "").toLowerCase().includes(q));
  }

  res.json(rows.map((p) => shapeListItem(p, req)));
});

router.post("/projects", CAN_MANAGE, (req, res) => {
  const { name, client, ownerEmployeeId, contractAmount, dueDate } = req.body || {};
  if (!name || !contractAmount) return res.status(400).json({ error: "name, contractAmount шаардлагатай" });

  const owner = ownerEmployeeId ? employeeById(ownerEmployeeId) : null;
  // Derived from the highest code ever issued (not a row count), so it stays unique even
  // after projects are deleted -- a count-based suffix would eventually collide and violate
  // the UNIQUE constraint on code once any project had ever been removed.
  const maxCodeNum = db.prepare("SELECT MAX(CAST(SUBSTR(code, 4) AS INTEGER)) AS n FROM projects WHERE code LIKE 'VP-%'").get().n || 29999;
  const nextCode = `VP-${maxCodeNum + 1}`;

  const info = db
    .prepare(
      `INSERT INTO projects (code, name, client, lead, owner_employee_id, contract_amount, budget, spent, progress_pct, status, due_date)
       VALUES (?,?,?,?,?,?,?,0,0,'ontrack',?)`
    )
    .run(nextCode, name, client || "", owner ? owner.name : req.user.name, owner ? owner.id : null, Number(contractAmount), Number(contractAmount), dueDate || null);

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
  const insertChecklist = db.prepare("INSERT INTO checklist_items (project_id, label, complete, sort_order) VALUES (?,?,0,?)");
  CHECKLIST_LABELS.forEach((label, i) => insertChecklist.run(info.lastInsertRowid, label, i));

  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(shapeDetail(row, req));
});

router.get("/projects/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  res.json(shapeDetail(row, req));
});

router.patch("/projects/:id/spend", CAN_MANAGE, (req, res) => {
  const { delta } = req.body || {};
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;

  let spent = project.spent + Number(delta || 0);
  spent = Math.max(0, spent);
  const status = deriveStatus(spent, project.budget);

  db.prepare("UPDATE projects SET spent = ?, status = ? WHERE id = ?").run(spent, status, project.id);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id);
  res.json(shapeDetail(updated, req));
});

router.patch("/projects/:id", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;

  const { name, client, ownerEmployeeId, contractAmount, dueDate } = req.body || {};
  if (name != null && !String(name).trim()) return res.status(400).json({ error: "name хоосон байж болохгүй" });

  const owner = ownerEmployeeId !== undefined ? employeeById(ownerEmployeeId) : undefined;

  db.prepare(
    `UPDATE projects SET
       name = ?, client = ?, lead = ?, owner_employee_id = ?, contract_amount = ?, budget = ?, due_date = ?
     WHERE id = ?`
  ).run(
    name != null ? name : project.name,
    client != null ? client : project.client,
    owner !== undefined ? (owner ? owner.name : project.lead) : project.lead,
    owner !== undefined ? (owner ? owner.id : null) : project.owner_employee_id,
    contractAmount != null ? Number(contractAmount) : project.contract_amount,
    contractAmount != null ? Number(contractAmount) : project.budget,
    dueDate !== undefined ? dueDate : project.due_date,
    project.id
  );

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(project.id);
  res.json(shapeDetail(updated, req));
});

// CEO finishing their own project applies immediately; a manager's request goes to
// the CEO decision queue instead, carrying the proposed date in approvals.reason so
// it can be stamped onto the project once approved.
router.post("/projects/:id/request-finish", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  if (project.completed_at) return res.status(400).json({ error: "Энэ төсөл аль хэдийн дууссан" });

  const { completedAt } = req.body || {};
  const date = completedAt || new Date().toISOString().slice(0, 10);

  if (req.user.role === "ceo") {
    db.prepare("UPDATE projects SET completed_at = ? WHERE id = ?").run(date, project.id);
    return res.json({ ok: true, immediate: true, completedAt: date });
  }

  db.prepare("INSERT INTO approvals (kind, title, project_id, reason) VALUES ('finish', ?, ?, ?)").run(
    `${project.name} — дуусгахыг хүсч байна`,
    project.id,
    date
  );
  res.json({ ok: true, immediate: false });
});

router.delete("/projects/:id", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---- Checklist ----
router.patch("/projects/:id/checklist/:itemId", CAN_MANAGE, (req, res) => {
  const { complete } = req.body || {};
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const item = db.prepare("SELECT * FROM checklist_items WHERE id = ? AND project_id = ?").get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: "Checklist зүйл олдсонгүй" });
  db.prepare("UPDATE checklist_items SET complete = ? WHERE id = ?").run(complete ? 1 : 0, item.id);
  res.json({ id: item.id, label: item.label, complete: !!complete });
});

router.post("/projects/:id/checklist/remind", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const missing = db.prepare("SELECT COUNT(*) AS c FROM checklist_items WHERE project_id = ? AND complete = 0").get(req.params.id).c;
  res.json({ ok: true, remindedCount: missing });
});

// ---- Deliverables ----
router.post("/projects/:id/deliverables", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const { title, totalCount } = req.body || {};
  if (!title) return res.status(400).json({ error: "title шаардлагатай" });
  const info = db
    .prepare("INSERT INTO deliverables (project_id, title, done_count, total_count) VALUES (?,?,0,?)")
    .run(req.params.id, title, Number(totalCount) || 1);
  const row = db.prepare("SELECT id, title, done_count AS doneCount, total_count AS totalCount FROM deliverables WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.patch("/deliverables/:id", CAN_MANAGE, (req, res) => {
  const d = db.prepare("SELECT * FROM deliverables WHERE id = ?").get(req.params.id);
  if (!d) return res.status(404).json({ error: "Deliverable олдсонгүй" });
  const project = projectForDeliverable(req.params.id);
  if (project && !assertOwnsProject(req, res, project)) return;
  const { title, doneCount, totalCount } = req.body || {};
  db.prepare("UPDATE deliverables SET title = ?, done_count = ?, total_count = ? WHERE id = ?").run(
    title ?? d.title,
    doneCount ?? d.done_count,
    totalCount ?? d.total_count,
    d.id
  );
  const row = db.prepare("SELECT id, title, done_count AS doneCount, total_count AS totalCount FROM deliverables WHERE id = ?").get(d.id);
  res.json(row);
});

router.delete("/deliverables/:id", CAN_MANAGE, (req, res) => {
  const d = db.prepare("SELECT * FROM deliverables WHERE id = ?").get(req.params.id);
  if (!d) return res.status(404).json({ error: "Deliverable олдсонгүй" });
  const project = projectForDeliverable(req.params.id);
  if (project && !assertOwnsProject(req, res, project)) return;
  db.prepare("DELETE FROM deliverables WHERE id = ?").run(d.id);
  res.status(204).end();
});

// ---- Client payments (money received from the client) ----
router.post("/projects/:id/payments", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const { amount, receivedAt, note } = req.body || {};
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: "amount шаардлагатай" });
  const info = db
    .prepare("INSERT INTO client_payments (project_id, amount, received_at, note, recorded_by_user_id) VALUES (?,?,?,?,?)")
    .run(req.params.id, Number(amount), receivedAt || new Date().toISOString().slice(0, 10), note || null, req.user.id);
  const row = db.prepare("SELECT id, amount, received_at AS receivedAt, note FROM client_payments WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

// ---- Cost line items ----
router.post("/projects/:id/cost-items", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const { category, amount, receiptStatus } = req.body || {};
  if (!category || !amount) return res.status(400).json({ error: "category, amount шаардлагатай" });
  const info = db
    .prepare("INSERT INTO cost_line_items (project_id, category, amount, receipt_status) VALUES (?,?,?,?)")
    .run(req.params.id, category, Number(amount), receiptStatus || "pending");
  const row = db.prepare("SELECT id, category, amount, receipt_status AS receiptStatus FROM cost_line_items WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.patch("/cost-items/:id/receipt", CAN_MANAGE, (req, res) => {
  const item = db.prepare("SELECT * FROM cost_line_items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Зардлын мөр олдсонгүй" });
  const project = projectForCostItem(req.params.id);
  if (project && !assertOwnsProject(req, res, project)) return;
  const { receiptStatus } = req.body || {};
  if (!["has_receipt", "no_receipt", "pending"].includes(receiptStatus)) {
    return res.status(400).json({ error: "receiptStatus буруу байна" });
  }
  db.prepare("UPDATE cost_line_items SET receipt_status = ? WHERE id = ?").run(receiptStatus, item.id);
  res.json({ id: item.id, category: item.category, amount: item.amount, receiptStatus });
});

// ---- Review items ----
router.post("/projects/:id/review-items", CAN_MANAGE, (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  const { title, version, editorEmployeeId, reviewStatus } = req.body || {};
  if (!title) return res.status(400).json({ error: "title шаардлагатай" });
  const info = db
    .prepare("INSERT INTO review_items (project_id, title, version, editor_employee_id, review_status) VALUES (?,?,?,?,?)")
    .run(req.params.id, title, version || null, editorEmployeeId || null, reviewStatus || "editing");
  const row = db
    .prepare(
      `SELECT r.id, r.title, r.version, r.review_status AS reviewStatus, e.name AS editor
       FROM review_items r LEFT JOIN employees e ON e.id = r.editor_employee_id WHERE r.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.patch("/review-items/:id", CAN_MANAGE, (req, res) => {
  const item = db.prepare("SELECT * FROM review_items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Review зүйл олдсонгүй" });
  const project = projectForReviewItem(req.params.id);
  if (project && !assertOwnsProject(req, res, project)) return;
  const { version, reviewStatus } = req.body || {};
  db.prepare("UPDATE review_items SET version = ?, review_status = ? WHERE id = ?").run(
    version ?? item.version,
    reviewStatus ?? item.review_status,
    item.id
  );
  res.json({ ok: true });
});

// ---- Files ----
router.get("/projects/:id/files", (req, res) => {
  const rows = db.prepare("SELECT id, category, filename, size_bytes AS sizeBytes, status, created_at AS createdAt FROM files WHERE owner_type = 'project' AND owner_id = ? ORDER BY created_at DESC").all(req.params.id);
  res.json(rows);
});

router.post("/projects/:id/files", CAN_MANAGE, upload.single("file"), (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).json({ error: "Төсөл олдсонгүй" });
  if (!assertOwnsProject(req, res, project)) return;
  if (!req.file) return res.status(400).json({ error: "file шаардлагатай" });
  const { category } = req.body || {};
  if (!PROJECT_FILE_CATEGORIES.includes(category)) return res.status(400).json({ error: "category буруу байна" });
  const info = db
    .prepare("INSERT INTO files (owner_type, owner_id, category, filename, stored_path, size_bytes) VALUES ('project',?,?,?,?,?)")
    .run(req.params.id, category, req.file.originalname, req.file.filename, req.file.size);
  res.status(201).json({ id: info.lastInsertRowid, category, filename: req.file.originalname, sizeBytes: req.file.size });
});

router.get("/projects/:id/files", CAN_MANAGE, (req, res) => {
  const rows = db
    .prepare("SELECT id, category, filename, stored_path AS storedPath, size_bytes AS sizeBytes, status, created_at AS createdAt FROM files WHERE owner_type = 'project' AND owner_id = ? ORDER BY created_at DESC")
    .all(req.params.id);
  res.json(rows);
});

module.exports = router;
