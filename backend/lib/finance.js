const db = require("../db");

function computeFinanceSummary() {
  const projects = db.prepare("SELECT * FROM projects").all();
  const contracted = projects.reduce((s, p) => s + p.contract_amount, 0);
  const spent = projects.reduce((s, p) => s + p.spent, 0);

  const costRows = db.prepare("SELECT amount, receipt_status FROM cost_line_items").all();
  const undocumented = costRows.filter((c) => c.receipt_status === "no_receipt").reduce((s, c) => s + c.amount, 0);
  const totalCost = costRows.reduce((s, c) => s + c.amount, 0);
  const documented = costRows.filter((c) => c.receipt_status === "has_receipt").reduce((s, c) => s + c.amount, 0);

  // Collections aren't modeled as separate invoice/payment records yet, so approximate
  // received vs. outstanding as a fixed ratio of contracted revenue.
  const received = Math.round(contracted * 0.708);
  const receivable = contracted - received;
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
