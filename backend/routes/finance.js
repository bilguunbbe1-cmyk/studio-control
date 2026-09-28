const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { computeFinanceSummary, salaryTotal, PROJECT_DATE, COST_DATE } = require("../lib/finance");
const { employeeIdForUser, employeeById, projectCostTotal } = require("../lib/helpers");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole("ceo", "manager"));

const CEO_ONLY = requireRole("ceo");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function ownerScope(req) {
  if (req.user.role === "ceo") return null;
  return employeeIdForUser(req.user.id) || -1;
}

// Period filter is a CEO feature: ?from=YYYY-MM-DD&to=YYYY-MM-DD, both inclusive.
// Returns null for "all time", undefined after sending an error response.
function parseRange(req, res) {
  const { from, to } = req.query;
  if (!from && !to) return null;
  if (req.user.role !== "ceo") {
    res.status(403).json({ error: "Хугацаагаар шүүх эрх зөвхөн CEO-д байна" });
    return undefined;
  }
  if (!ISO_DATE.test(from || "") || !ISO_DATE.test(to || "") || from > to) {
    res.status(400).json({ error: "from, to огноо буруу байна" });
    return undefined;
  }
  return { from, to };
}

router.get("/summary", (req, res) => {
  const range = parseRange(req, res);
  if (range === undefined) return;
  const s = computeFinanceSummary(ownerScope(req), false, range);
  const body = {
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
  };
  if (req.user.role === "ceo") {
    const salaries = salaryTotal(range);
    body.salaries = salaries;
    body.salaryPctOfReceived = s.received ? Math.round((salaries / s.received) * 1000) / 10 : null;
    body.remainingAfterCostsAndSalaries = s.received - s.totalCost - salaries;
  }
  res.json(body);
});

router.get("/projects", (req, res) => {
  const range = parseRange(req, res);
  if (range === undefined) return;
  const owner = ownerScope(req);
  const clauses = [];
  const params = [];
  if (owner) {
    clauses.push("owner_employee_id = ?");
    params.push(owner);
  }
  if (range) {
    clauses.push(`${PROJECT_DATE} BETWEEN ? AND ?`);
    params.push(range.from, range.to);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT *, ${PROJECT_DATE} AS contract_day FROM projects${where} ORDER BY contract_day DESC, created_at DESC`).all(...params);
  res.json(
    rows.map((p) => {
      const cost = projectCostTotal(p.id);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        contractDate: p.contract_day,
        revenue: p.contract_amount,
        cost,
        profit: p.contract_amount - cost,
        marginPct: p.contract_amount ? Math.round(((p.contract_amount - cost) / p.contract_amount) * 100) : 0,
      };
    })
  );
});

router.get("/undocumented", (req, res) => {
  const range = parseRange(req, res);
  if (range === undefined) return;
  const owner = ownerScope(req);
  const clauses = ["c.receipt_status = 'no_receipt'"];
  const params = [];
  if (owner) {
    clauses.push("p.owner_employee_id = ?");
    params.push(owner);
  }
  if (range) {
    clauses.push(`COALESCE(c.spent_at, substr(c.created_at, 1, 10)) BETWEEN ? AND ?`);
    params.push(range.from, range.to);
  }
  const rows = db
    .prepare(
      `SELECT c.id, c.category, c.amount, COALESCE(c.spent_at, substr(c.created_at, 1, 10)) AS createdAt, p.name AS projectName
       FROM cost_line_items c JOIN projects p ON p.id = c.project_id
       WHERE ${clauses.join(" AND ")} ORDER BY createdAt DESC`
    )
    .all(...params);
  res.json(rows);
});

// Month-by-month totals for the CEO. Without a range it spans the earliest dated
// record through the current month.
router.get("/monthly", CEO_ONLY, (req, res) => {
  const range = parseRange(req, res);
  if (range === undefined) return;

  const sumByMonth = (sql) => Object.fromEntries(db.prepare(sql).all().map((r) => [r.m, r.t || 0]));
  const received = sumByMonth("SELECT substr(received_at, 1, 7) AS m, SUM(amount) AS t FROM client_payments GROUP BY m");
  const costs = sumByMonth(`SELECT substr(${COST_DATE}, 1, 7) AS m, SUM(amount) AS t FROM cost_line_items GROUP BY m`);
  const salaries = sumByMonth("SELECT substr(paid_at, 1, 7) AS m, SUM(amount) AS t FROM salary_payments GROUP BY m");
  const contracted = sumByMonth(`SELECT substr(${PROJECT_DATE}, 1, 7) AS m, SUM(contract_amount) AS t FROM projects GROUP BY m`);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const known = [...Object.keys(received), ...Object.keys(costs), ...Object.keys(salaries), ...Object.keys(contracted)].filter(Boolean).sort();
  const start = range ? range.from.slice(0, 7) : known[0] || thisMonth;
  const end = range ? range.to.slice(0, 7) : thisMonth > (known[known.length - 1] || "") ? thisMonth : known[known.length - 1];

  const months = [];
  let [y, m] = start.split("-").map(Number);
  while (months.length < 240) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > end) break;
    const r = received[key] || 0;
    const c = costs[key] || 0;
    const s = salaries[key] || 0;
    months.push({ month: key, contracted: contracted[key] || 0, received: r, costs: c, salaries: s, net: r - c - s });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  res.json(months);
});

// ---- Salary payments (CEO only) ----
function shapeSalary(r) {
  return { id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, paidAt: r.paid_at, amount: r.amount, note: r.note };
}

router.get("/salaries", CEO_ONLY, (req, res) => {
  const range = parseRange(req, res);
  if (range === undefined) return;
  const rows = range
    ? db.prepare("SELECT * FROM salary_payments WHERE paid_at BETWEEN ? AND ? ORDER BY paid_at DESC, id DESC").all(range.from, range.to)
    : db.prepare("SELECT * FROM salary_payments ORDER BY paid_at DESC, id DESC").all();

  const byEmployee = {};
  for (const r of rows) {
    const key = r.employee_id != null ? `e${r.employee_id}` : `n${r.employee_name}`;
    byEmployee[key] = byEmployee[key] || { employeeId: r.employee_id, employeeName: r.employee_name, total: 0, count: 0 };
    byEmployee[key].total += r.amount;
    byEmployee[key].count += 1;
  }
  res.json({
    payments: rows.map(shapeSalary),
    byEmployee: Object.values(byEmployee).sort((a, b) => b.total - a.total),
  });
});

router.post("/salaries", CEO_ONLY, (req, res) => {
  const { employeeId, paidAt, amount, note } = req.body || {};
  const emp = employeeById(employeeId);
  if (!emp) return res.status(400).json({ error: "Ажилтан олдсонгүй" });
  if (!ISO_DATE.test(paidAt || "")) return res.status(400).json({ error: "Огноо буруу байна" });
  if (!Number(amount) || Number(amount) <= 0) return res.status(400).json({ error: "Дүн буруу байна" });
  const info = db
    .prepare("INSERT INTO salary_payments (employee_id, employee_name, paid_at, amount, note, recorded_by_user_id) VALUES (?,?,?,?,?,?)")
    .run(emp.id, emp.name, paidAt, Number(amount), note || null, req.user.id);
  res.status(201).json(shapeSalary(db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(info.lastInsertRowid)));
});

router.patch("/salaries/:id", CEO_ONLY, (req, res) => {
  const row = db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Цалингийн бичлэг олдсонгүй" });
  const { paidAt, amount, note } = req.body || {};
  if (paidAt != null && !ISO_DATE.test(paidAt)) return res.status(400).json({ error: "Огноо буруу байна" });
  if (amount != null && (!Number(amount) || Number(amount) <= 0)) return res.status(400).json({ error: "Дүн буруу байна" });
  db.prepare("UPDATE salary_payments SET paid_at = ?, amount = ?, note = ? WHERE id = ?").run(
    paidAt ?? row.paid_at,
    amount != null ? Number(amount) : row.amount,
    note !== undefined ? note : row.note,
    row.id
  );
  res.json(shapeSalary(db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(row.id)));
});

router.delete("/salaries/:id", CEO_ONLY, (req, res) => {
  const row = db.prepare("SELECT * FROM salary_payments WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Цалингийн бичлэг олдсонгүй" });
  db.prepare("DELETE FROM salary_payments WHERE id = ?").run(row.id);
  res.status(204).end();
});

// Records a month's payroll from each employee's base salary: half on the 5th
// (advance) and half on the 20th (settlement), matching the schedule shown on the
// employee Salary tab. Employees who already have entries that month are skipped,
// so pressing it twice never double-counts.
router.post("/salaries/fill-month", CEO_ONLY, (req, res) => {
  const { month } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(month || "")) return res.status(400).json({ error: "Сар буруу байна" });
  const employees = db.prepare("SELECT id, name, base_salary_amount FROM employees WHERE base_salary_amount > 0").all();
  const hasEntries = db.prepare("SELECT COUNT(*) AS c FROM salary_payments WHERE employee_id = ? AND substr(paid_at, 1, 7) = ?");
  const insert = db.prepare(
    "INSERT INTO salary_payments (employee_id, employee_name, paid_at, amount, note, recorded_by_user_id) VALUES (?,?,?,?,?,?)"
  );
  let created = 0;
  const skipped = [];
  db.transaction(() => {
    for (const e of employees) {
      if (hasEntries.get(e.id, month).c > 0) {
        skipped.push(e.name);
        continue;
      }
      const advance = Math.round(e.base_salary_amount / 2);
      insert.run(e.id, e.name, `${month}-05`, advance, "Урьдчилгаа", req.user.id);
      insert.run(e.id, e.name, `${month}-20`, e.base_salary_amount - advance, "Эцсийн тооцоо", req.user.id);
      created += 2;
    }
  })();
  res.json({ created, skipped, employeesWithSalary: employees.length });
});

module.exports = router;
