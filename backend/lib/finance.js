const db = require("../db");

// SQL expressions for each row's business date. NULL (rows added by code paths that
// don't set the date) falls back to the day the row was created.
const PROJECT_DATE = "COALESCE(contract_date, substr(created_at, 1, 10))";
const COST_DATE = "COALESCE(spent_at, substr(created_at, 1, 10))";

// range: { from, to } inclusive YYYY-MM-DD, or null for all time.
// With a range, each figure uses its own date:
//   contracted / receivable -> projects whose contract date is in the period
//   received                -> client payments received in the period
//   costs                   -> cost line items spent in the period
function computeFinanceSummary(ownerEmployeeId, activeOnly, range) {
  const clauses = [];
  const params = [];
  if (ownerEmployeeId) {
    clauses.push("owner_employee_id = ?");
    params.push(ownerEmployeeId);
  }
  if (activeOnly) clauses.push("completed_at IS NULL");
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";

  // Every project in scope -- payments and costs are matched against these, then
  // filtered by their own dates.
  const scopeProjects = db.prepare(`SELECT *, ${PROJECT_DATE} AS contract_day FROM projects${where}`).all(...params);
  const projects = range
    ? scopeProjects.filter((p) => p.contract_day && p.contract_day >= range.from && p.contract_day <= range.to)
    : scopeProjects;
  const contracted = projects.reduce((s, p) => s + p.contract_amount, 0);

  const scopeIds = scopeProjects.map((p) => p.id);
  const idPlaceholders = scopeIds.length ? scopeIds.map(() => "?").join(",") : "0";
  const rangeSql = (col) => (range ? ` AND ${col} BETWEEN ? AND ?` : "");
  const rangeParams = range ? [range.from, range.to] : [];

  // The real "money spent" figure -- projects.spent is a separate mutable column
  // that only updates when a payment request is paid, so it drifts stale whenever
  // costs are logged directly. totalCost from the actual line items is authoritative.
  const costRows = db
    .prepare(`SELECT amount, receipt_status FROM cost_line_items WHERE project_id IN (${idPlaceholders})${rangeSql(COST_DATE)}`)
    .all(...scopeIds, ...rangeParams);
  const undocumented = costRows.filter((c) => c.receipt_status === "no_receipt").reduce((s, c) => s + c.amount, 0);
  const totalCost = costRows.reduce((s, c) => s + c.amount, 0);
  const documented = costRows.filter((c) => c.receipt_status === "has_receipt").reduce((s, c) => s + c.amount, 0);

  const paymentRows = db
    .prepare(`SELECT amount FROM client_payments WHERE project_id IN (${idPlaceholders})${rangeSql("received_at")}`)
    .all(...scopeIds, ...rangeParams);
  const received = paymentRows.reduce((s, r) => s + r.amount, 0);

  // Still owed on the contracts in the period, counting payments up to today.
  let receivable;
  if (range) {
    const periodIds = projects.map((p) => p.id);
    const paidOnPeriod = periodIds.length
      ? db.prepare(`SELECT SUM(amount) AS t FROM client_payments WHERE project_id IN (${periodIds.map(() => "?").join(",")})`).get(...periodIds).t || 0
      : 0;
    receivable = Math.max(0, contracted - paidOnPeriod);
  } else {
    receivable = Math.max(0, contracted - received);
  }
  const overdueReceivable = Math.round(receivable * 0.36);
  const fixedCosts = Math.round(contracted * 0.197);
  const netProfit = contracted - totalCost - fixedCosts;
  const marginPct = contracted ? Math.round(((netProfit / contracted) * 100) * 10) / 10 : 0;

  return {
    projects,
    contracted,
    spent: totalCost,
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

function salaryTotal(range) {
  const r = range
    ? db.prepare("SELECT SUM(amount) AS t FROM salary_payments WHERE paid_at BETWEEN ? AND ?").get(range.from, range.to)
    : db.prepare("SELECT SUM(amount) AS t FROM salary_payments").get();
  return r.t || 0;
}

module.exports = { computeFinanceSummary, salaryTotal, PROJECT_DATE, COST_DATE };
