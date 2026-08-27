const db = require("../db");

const PROJECT_FILE_CATEGORIES = ["Commercial", "Contract", "Plan", "Production", "Review", "Final", "Finance"];
const EMPLOYEE_FILE_CATEGORIES = ["Хөдөлмөрийн гэрээ", "Хувийн мэдээлэл", "Цалин", "Амралт ба чөлөө", "Гүйцэтгэл"];

function canManage(role) {
  return role === "ceo" || role === "manager";
}

function employeeById(id) {
  if (!id) return null;
  return db.prepare("SELECT id, code, name, title FROM employees WHERE id = ?").get(id);
}

function employeeIdForUser(userId) {
  const row = db.prepare("SELECT id FROM employees WHERE user_id = ?").get(userId);
  return row ? row.id : null;
}

// Progress reflects actual production output (deliverables shot/edited/delivered),
// not administrative checklist items -- a project can have every pre-production
// checklist box ticked while zero real work has been produced.
function deliverableProgress(projectId) {
  const rows = db.prepare("SELECT done_count, total_count FROM deliverables WHERE project_id = ?").all(projectId);
  const total = rows.reduce((s, r) => s + r.total_count, 0);
  if (!total) return 0;
  const done = rows.reduce((s, r) => s + Math.min(r.done_count, r.total_count), 0);
  return Math.round((done / total) * 100);
}

function deriveStatus(spent, budget) {
  if (!budget) return "ontrack";
  const pct = spent / budget;
  if (pct >= 0.9) return "late";
  if (pct >= 0.6) return "risk";
  return "ontrack";
}

function fileCountsFor(ownerType, ownerId, categories) {
  return categories.map((category) => {
    const row = db
      .prepare("SELECT COUNT(*) AS c, SUM(CASE WHEN status = 'Дутуу' THEN 1 ELSE 0 END) AS missing FROM files WHERE owner_type = ? AND owner_id = ? AND category = ?")
      .get(ownerType, ownerId, category);
    return { category, count: row.c || 0, missing: row.missing || 0 };
  });
}

module.exports = {
  canManage,
  employeeById,
  employeeIdForUser,
  deriveStatus,
  deliverableProgress,
  fileCountsFor,
  PROJECT_FILE_CATEGORIES,
  EMPLOYEE_FILE_CATEGORIES,
};
