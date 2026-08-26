const db = require("../db");

function computeFinanceSummary(ownerEmployeeId, activeOnly) {
  const clauses = [];
  const params = [];
  if (ownerEmployeeId) {
    clauses.push("owner_employee_id = ?");
    params.push(ownerEmployeeId);
  }
  if (activeOnly) clauses.push("completed_at IS NULL");
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";

  const projects = db.prepare(`SELECT * FROM projects${where}`).all(...params);
  const contracted = projects.reduce((s, p) => s + p.contract_amount, 0);
  const spent = projects.reduce((s, p) => s + p.spent, 0);

  const projectIds = projects.map((p) => p.id);
  const idPlaceholders = projectIds.length ? projectIds.map(() => "?").join(",") : "0";

  const costRows = db
    .prepare(`SELECT amount, receipt_status FROM cost_line_items WHERE project_id IN (${idPlaceholders})`)
    .all(...projectIds);
  const undocumented = costRows.filter((c) => c.receipt_status === "no_receipt").reduce((s, c) => s + c.amount, 0);
  const totalCost = costRows.reduce((s, c) => s + c.amount, 0);
  const documented = costRows.filter((c) => c.receipt_status === "has_receipt").reduce((s, c) => s + c.amount, 0);

  const paymentRows = db
    .prepare(`SELECT amount FROM client_payments WHERE project_id IN (${idPlaceholders})`)
    .all(...projectIds);
  const received = paymentRows.reduce((s, r) => s + r.amount, 0);
  const receivable = Math.max(0, contracted - received);
  const overdueReceivable = Math.round(receivable * 0.36);
  const fixedCosts = Math.round(contracted * 0.197);
  const netProfit = contracted - spent - fixedCosts;
  const marginPct = contracted ? Math.round(((netProfit / contracted) * 100) * 10) / 10 : 0;

  return {
    projects,
    contracted,
    spent,
    undocumented,
    totalCost,
    documented,
    received,
    receivable,
    overdueReceivable,
    fixedCosts,
    netProfit,
    marginPct,
    docPct: totalCost ? Math.round((documented / totalCost) * 100) : 100,
  };
}

module.exports = { computeFinanceSummary };
