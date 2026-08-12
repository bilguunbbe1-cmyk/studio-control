const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { deriveStatus } = require("../lib/helpers");

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = requireRole("ceo", "manager");

function shapeRow(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    purpose: r.purpose,
    bank: r.bank,
    accountNumber: r.account_number,
    recipientName: r.recipient_name,
    amount: r.amount,
    hasReceipt: !!r.has_receipt,
    status: r.status,
    requestedBy: r.requested_by_name,
    paidAt: r.paid_at,
    createdAt: r.created_at,
  };
}

function baseQuery() {
  return `SELECT pr.*, p.name AS project_name, u.name AS requested_by_name
          FROM payment_requests pr
          JOIN projects p ON p.id = pr.project_id
          JOIN users u ON u.id = pr.requested_by_user_id`;
}

// Any authenticated user can request a payment for a project they're working on
router.post("/payment-requests", (req, res) => {
  const { projectId, purpose, bank, accountNumber, recipientName, amount, hasReceipt } = req.body || {};
  if (!projectId || !purpose || !recipientName || !amount) {
    return res.status(400).json({ error: "projectId, purpose, recipientName, amount шаардлагатай" });
  }
  const info = db
    .prepare(
      `INSERT INTO payment_requests (project_id, requested_by_user_id, purpose, bank, account_number, recipient_name, amount, has_receipt)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(projectId, req.user.id, purpose, bank || null, accountNumber || null, recipientName, Number(amount), hasReceipt ? 1 : 0);
  const row = db.prepare(`${baseQuery()} WHERE pr.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(shapeRow(row));
});

router.get("/payment-requests/mine", (req, res) => {
  const rows = db
    .prepare(`${baseQuery()} WHERE pr.requested_by_user_id = ? ORDER BY pr.created_at DESC LIMIT 20`)
    .all(req.user.id);
  res.json(rows.map(shapeRow));
});

router.get("/payment-requests", CAN_MANAGE, (req, res) => {
  const status = req.query.status || "pending";
  const rows = db.prepare(`${baseQuery()} WHERE pr.status = ? ORDER BY pr.created_at ASC`).all(status);
  res.json(rows.map(shapeRow));
});

router.post("/payment-requests/:id/pay", CAN_MANAGE, (req, res) => {
  const pr = db.prepare("SELECT * FROM payment_requests WHERE id = ?").get(req.params.id);
  if (!pr) return res.status(404).json({ error: "Хүсэлт олдсонгүй" });
  if (pr.status === "paid") return res.status(400).json({ error: "Энэ хүсэлт аль хэдийн төлөгдсөн байна" });

  db.prepare("UPDATE payment_requests SET status = 'paid', paid_at = CURRENT_TIMESTAMP, paid_by = ? WHERE id = ?").run(req.user.id, pr.id);

  db.prepare("INSERT INTO cost_line_items (project_id, category, amount, receipt_status) VALUES (?,?,?,?)").run(
    pr.project_id,
    pr.purpose,
    pr.amount,
    pr.has_receipt ? "has_receipt" : "no_receipt"
  );

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(pr.project_id);
  if (project) {
    const spent = project.spent + pr.amount;
    const status = deriveStatus(spent, project.budget);
    db.prepare("UPDATE projects SET spent = ?, status = ? WHERE id = ?").run(spent, status, project.id);
  }

  const amountFmt = new Intl.NumberFormat("mn-MN").format(Math.round(pr.amount));
  db.prepare("INSERT INTO notifications (user_id, message, kind) VALUES (?,?,'payment')").run(
    pr.requested_by_user_id,
    `✓ "${pr.purpose}" гүйлгээ (₮${amountFmt}) шилжлээ.`
  );

  const row = db.prepare(`${baseQuery()} WHERE pr.id = ?`).get(pr.id);
  res.json(shapeRow(row));
});

module.exports = router;
