const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { employeeIdForUser, deliverableProgress, projectCostTotal, deriveStatus } = require("../lib/helpers");
const { computeFinanceSummary } = require("../lib/finance");

const router = express.Router();
router.use(requireAuth);

// projects.spent/status only update when a payment request is paid, so they
// drift stale whenever costs are logged directly via "+ Зардал" -- always
// derive both live from the real cost line items instead of trusting the columns.
function withLiveFinance(p) {
  const spent = projectCostTotal(p.id);
  return { ...p, spent, status: deriveStatus(spent, p.budget) };
}

function projectBrief(p) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client,
    lead: p.lead,
    status: p.status,
    progressPct: deliverableProgress(p.id),
    budgetSpentPct: p.budget ? Math.round((p.spent / p.budget) * 100) : 0,
  };
}

function ceoOverview() {
  const projects = db.prepare("SELECT * FROM projects WHERE completed_at IS NULL ORDER BY created_at DESC").all().map(withLiveFinance);
  const fin = computeFinanceSummary(null, true);

  const lateProject = projects.find((p) => p.status === "late");
  const alert = lateProject
    ? {
        projectId: lateProject.id,
        title: `${lateProject.name} төсөл хоцорч байна`,
        subtitle: "Shot list харилцагчаар батлагдаагүй, урьдчилгаа төлбөр дутуу.",
      }
    : null;

  const decisions = db
    .prepare(
      `SELECT a.*, p.name AS project_name FROM approvals a LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.status = 'pending' ORDER BY a.created_at DESC`
    )
    .all()
    .map((a) => ({ id: a.id, kind: a.kind, title: a.title, amount: a.amount, projectName: a.project_name, reason: a.reason }));

  const deadlines = db.prepare("SELECT * FROM deadlines ORDER BY due_date ASC LIMIT 8").all();

  return {
    role: "ceo",
    alert,
    stats: {
      activeProjects: projects.length,
      ontrackCount: projects.filter((p) => p.status === "ontrack").length,
      riskyCount: projects.filter((p) => p.status !== "ontrack").length,
      revenueMonth: fin.contracted,
      revenueReceived: fin.received,
      receivable: fin.receivable,
      receivableOverdue: fin.overdueReceivable,
      totalProfit: fin.netProfit,
      marginPct: fin.marginPct,
    },
    projectControl: [...projects].sort((a, b) => (a.status === "ontrack" ? 1 : -1) - (b.status === "ontrack" ? 1 : -1)).map(projectBrief),
    decisions,
    profitability: {
      revenue: fin.contracted,
      directCosts: fin.spent,
      fixedCosts: fin.fixedCosts,
      netProfit: fin.netProfit,
      marginPct: fin.marginPct,
    },
    documentation: {
      pct: fin.docPct,
      totalCost: fin.totalCost,
      documented: fin.documented,
      undocumented: fin.undocumented,
    },
    deadlines: deadlines.map((d) => ({ id: d.id, title: d.title, project: d.project, person: d.person, dueDate: d.due_date })),
  };
}

function managerOverview(user) {
  const employeeId = employeeIdForUser(user.id);
  const allProjects = db.prepare("SELECT * FROM projects WHERE completed_at IS NULL ORDER BY created_at DESC").all().map(withLiveFinance);
  const myProjects = employeeId ? allProjects.filter((p) => p.owner_employee_id === employeeId) : allProjects;
  const today = new Date().toISOString().slice(0, 10);

  const myTasks = employeeId
    ? db.prepare("SELECT * FROM tasks WHERE assignee_employee_id = ?").all(employeeId)
    : [];
  const dueToday = myTasks.filter((t) => t.due_date === today && t.status !== "done");

  const myProjectIds = myProjects.map((p) => p.id);
  const placeholders = myProjectIds.length ? myProjectIds.map(() => "?").join(",") : "0";
  const pendingDecisions = db
    .prepare(`SELECT * FROM approvals WHERE status = 'pending' AND project_id IN (${placeholders})`)
    .all(...myProjectIds);
  const oldDecisions = pendingDecisions.filter((a) => new Date(a.created_at).getTime() < Date.now() - 2 * 86400000);

  const riskiest = [...myProjects].sort((a, b) => b.spent / b.budget - a.spent / a.budget)[0];
  const budgetRiskPct = riskiest && riskiest.budget ? Math.round((riskiest.spent / riskiest.budget) * 100) : 0;

  const flagged = myProjects.find((p) => p.status !== "ontrack") || myProjects[0];
  const checklist = flagged
    ? db
        .prepare("SELECT id, label, complete FROM checklist_items WHERE project_id = ? ORDER BY sort_order")
        .all(flagged.id)
        .map((c) => ({ id: c.id, label: c.label, complete: !!c.complete }))
    : [];

  const myProjectsShaped = myProjects
    .map((p) => {
      const nextTask = db
        .prepare(
          `SELECT t.title FROM tasks t WHERE t.project_id = ? AND t.status != 'done'
           ORDER BY (t.due_date IS NULL), t.due_date ASC LIMIT 1`
        )
        .get(p.id);
      return { ...projectBrief(p), nextAction: nextTask ? nextTask.title : null, dueDate: p.due_date };
    })
    .sort((a, b) => (a.status === "ontrack" ? 1 : -1) - (b.status === "ontrack" ? 1 : -1));

  const priorityProject = myProjectsShaped.find((p) => p.status !== "ontrack");

  return {
    role: "manager",
    todayPlan: {
      taskCount: myTasks.filter((t) => t.status !== "done").length,
      approvalCount: pendingDecisions.length,
      missingDocCount: checklist.filter((c) => !c.complete).length,
      priorityText: priorityProject
        ? `Хамгийн түрүүнд ${priorityProject.name}-ийн асуудлыг шийдэх хэрэгтэй.`
        : "Өнөөдөр яаралтай асуудал алга.",
    },
    stats: {
      myProjectsCount: myProjects.length,
      myProjectsLateCount: myProjects.filter((p) => p.status === "late").length,
      dueTodayCount: dueToday.length,
      dueTodayUrgentCount: dueToday.filter((t) => t.due_time).length,
      clientApprovalCount: pendingDecisions.length,
      clientApprovalOldCount: oldDecisions.length,
      budgetRiskPct,
    },
    myProjects: myProjectsShaped,
    checklist: flagged ? { projectId: flagged.id, projectName: flagged.name, items: checklist } : null,
  };
}

router.get("/overview", (req, res) => {
  if (req.user.role === "ceo") return res.json(ceoOverview());
  if (req.user.role === "manager") return res.json(managerOverview(req.user));
  return res.json({ role: "production" });
});

module.exports = router;
