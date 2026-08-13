const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { computeFinanceSummary } = require("../lib/finance");
const { employeeIdForUser } = require("../lib/helpers");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole("ceo", "manager"));

function ownerScope(req) {
  if (req.user.role === "ceo") return null;
  return employeeIdForUser(req.user.id) || -1;
}

router.get("/summary", (req, res) => {
  const s = computeFinanceSummary(ownerScope(req));
  res.json({
    contractedRevenue: s.contracted,
    received: s.received,
    receivable: s.receivable,
    overdueReceivable: s.overdueReceivable,
    undocumentedExpenses: s.undocumented,
    undocumentedGapPct: s.totalCost ? Math.round((s.undocumented / s.totalCost) * 100) : 0,
    documentedExpenses: s.documented,
    totalExpenses: s.totalCost,
    directCosts: s.spent,
    fixedCosts: s.fixedCosts,
    netProfit: s.netProfit,
    marginPct: s.marginPct,
  });
});

router.get("/projects", (req, res) => {
  const owner = ownerScope(req);
  const rows = owner
    ? db.prepare("SELECT * FROM projects WHERE owner_employee_id = ? ORDER BY created_at DESC").all(owner)
    : db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  res.json(
    rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      revenue: p.contract_amount,
      cost: p.spent,
      profit: p.contract_amount - p.spent,
      marginPct: p.contract_amount ? Math.round(((p.contract_amount - p.spent) / p.contract_amount) * 100) : 0,
    }))
  );
});

router.get("/undocumented", (req, res) => {
  const owner = ownerScope(req);
  const rows = owner
    ? db
        .prepare(
          `SELECT c.id, c.category, c.amount, c.created_at AS createdAt, p.name AS projectName
           FROM cost_line_items c JOIN projects p ON p.id = c.project_id
           WHERE c.receipt_status = 'no_receipt' AND p.owner_employee_id = ? ORDER BY c.created_at DESC`
        )
        .all(owner)
    : db
        .prepare(
          `SELECT c.id, c.category, c.amount, c.created_at AS createdAt, p.name AS projectName
           FROM cost_line_items c JOIN projects p ON p.id = c.project_id
           WHERE c.receipt_status = 'no_receipt' ORDER BY c.created_at DESC`
        )
        .all();
  res.json(rows);
});

module.exports = router;
