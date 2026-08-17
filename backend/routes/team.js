const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// A person handling this many concurrent active tasks counts as fully loaded (100%).
const FULL_LOAD_TASK_COUNT = 6;

router.get("/team", (req, res) => {
  const employees = db.prepare("SELECT * FROM employees").all();
  const today = new Date().toISOString().slice(0, 10);

  const rows = employees
    .map((e) => {
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
        workloadPct: Math.min(100, Math.round((activeTasks / FULL_LOAD_TASK_COUNT) * 100)),
        activeTasksCount: activeTasks,
        overdueCount: overdueTasks,
      };
    })
    .sort((a, b) => b.workloadPct - a.workloadPct);

  res.json(rows);
});

module.exports = router;
