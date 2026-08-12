const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/team", (req, res) => {
  const employees = db.prepare("SELECT * FROM employees ORDER BY workload_pct DESC").all();
  const today = new Date().toISOString().slice(0, 10);

  const rows = employees.map((e) => {
    const activeTasks = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE assignee_employee_id = ? AND status != 'done'").get(e.id).c;
    const overdueTasks = db
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE assignee_employee_id = ? AND status != 'done' AND due_date IS NOT NULL AND due_date < ?")
      .get(e.id, today).c;
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      title: e.title,
      photoUrl: e.photo_url ? `/uploads/${e.photo_url}` : null,
      workloadPct: e.workload_pct,
      activeTasksCount: activeTasks,
      overdueCount: overdueTasks,
    };
  });

  res.json(rows);
});

module.exports = router;
