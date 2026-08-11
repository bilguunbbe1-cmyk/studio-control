const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { canManage, employeeIdForUser } = require("../lib/helpers");

const router = express.Router();
router.use(requireAuth);

const CAN_MANAGE = requireRole("ceo", "manager");

const STATUS_VALUES = ["not_started", "editing", "internal_review", "awaiting_client", "done"];
const STAGE_VALUES = ["pre_production", "ready_to_shoot", "shooting", "edit", "client_review", "final"];

function shapeTask(t) {
  return {
    id: t.id,
    projectId: t.project_id,
    projectName: t.project_name,
    projectClient: t.project_client,
    title: t.title,
    assignee: t.assignee,
    assigneeEmployeeId: t.assignee_employee_id,
    status: t.status,
    stage: t.stage,
    version: t.version,
    checklistDone: t.checklist_done,
    checklistTotal: t.checklist_total,
    dueDate: t.due_date,
    dueTime: t.due_time,
  };
}

function baseQuery() {
  return `SELECT t.*, p.name AS project_name, p.client AS project_client, e.name AS assignee
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          LEFT JOIN employees e ON e.id = t.assignee_employee_id`;
}

// ---- Tasks ----
router.get("/tasks", (req, res) => {
  let rows = db.prepare(`${baseQuery()} ORDER BY (t.due_date IS NULL), t.due_date ASC, (t.due_time IS NULL), t.due_time ASC`).all();

  const { scope, status, stage } = req.query;
  if (scope === "mine") {
    const myEmployeeId = employeeIdForUser(req.user.id);
    rows = rows.filter((t) => t.assignee_employee_id === myEmployeeId);
  }
  if (status) rows = rows.filter((t) => t.status === status);
  if (stage) rows = rows.filter((t) => t.stage === stage);

  res.json(rows.map(shapeTask));
});

router.post("/tasks", (req, res) => {
  const { projectId, title, stage, dueDate, dueTime, selfAssign } = req.body || {};
  let { assigneeEmployeeId } = req.body || {};
  if (!projectId || !title) return res.status(400).json({ error: "projectId, title шаардлагатай" });
  if (stage && !STAGE_VALUES.includes(stage)) return res.status(400).json({ error: "stage буруу байна" });

  if (!canManage(req.user.role) || selfAssign) {
    const myEmployeeId = employeeIdForUser(req.user.id);
    if (!myEmployeeId) return res.status(403).json({ error: "Танд ажил үүсгэх эрх байхгүй байна" });
    assigneeEmployeeId = myEmployeeId;
  }

  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, title, assignee_employee_id, status, stage, due_date, due_time)
       VALUES (?,?,?,'not_started',?,?,?)`
    )
    .run(projectId, title, assigneeEmployeeId || null, stage || null, dueDate || null, dueTime || null);

  const row = db.prepare(`${baseQuery()} WHERE t.id = ?`).get(info.lastInsertRowid);
  res.status(201).json(shapeTask(row));
});

router.delete("/tasks/:id", CAN_MANAGE, (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Даалгавар олдсонгүй" });
  db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
  res.status(204).end();
});

function assertCanTouch(req, res, task) {
  if (req.user.role === "production") {
    const myEmployeeId = employeeIdForUser(req.user.id);
    if (task.assignee_employee_id !== myEmployeeId) {
      res.status(403).json({ error: "Энэ даалгавар танд оноогдоогүй байна" });
      return false;
    }
  }
  return true;
}

router.patch("/tasks/:id/status", (req, res) => {
  const { status } = req.body || {};
  if (!STATUS_VALUES.includes(status)) return res.status(400).json({ error: "status буруу байна" });
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Даалгавар олдсонгүй" });
  if (!assertCanTouch(req, res, task)) return;

  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, task.id);
  const row = db.prepare(`${baseQuery()} WHERE t.id = ?`).get(task.id);
  res.json(shapeTask(row));
});

router.patch("/tasks/:id/stage", CAN_MANAGE, (req, res) => {
  const { stage } = req.body || {};
  if (!STAGE_VALUES.includes(stage)) return res.status(400).json({ error: "stage буруу байна" });
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Даалгавар олдсонгүй" });

  db.prepare("UPDATE tasks SET stage = ? WHERE id = ?").run(stage, task.id);
  const row = db.prepare(`${baseQuery()} WHERE t.id = ?`).get(task.id);
  res.json(shapeTask(row));
});

router.post("/tasks/:id/submit-for-review", (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Даалгавар олдсонгүй" });
  if (!assertCanTouch(req, res, task)) return;

  db.prepare("UPDATE tasks SET status = 'internal_review' WHERE id = ?").run(task.id);
  const row = db.prepare(`${baseQuery()} WHERE t.id = ?`).get(task.id);
  res.json({ task: shapeTask(row), message: "Task дотоод хяналт руу шилжлээ" });
});

module.exports = router;
