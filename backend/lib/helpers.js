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
  fileCountsFor,
  PROJECT_FILE_CATEGORIES,
  EMPLOYEE_FILE_CATEGORIES,
};
