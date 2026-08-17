// One-time cleanup: wipes all project/task/finance demo data and removes a
// named employee, while leaving every other employee's record untouched.
// Run once against the live database via Render's Shell tab:
//   node scripts/reset-for-launch.js
const db = require("../db");

const EMPLOYEE_NAME_TO_REMOVE = "Түвшинтөгс";

const run = db.transaction(() => {
  db.prepare("DELETE FROM files WHERE owner_type = 'project'").run();
  db.prepare("DELETE FROM approvals").run();
  db.prepare("DELETE FROM notifications").run();

  const projectCount = db.prepare("SELECT COUNT(*) AS c FROM projects").get().c;
  db.prepare("DELETE FROM projects").run(); // cascades deliverables, checklist_items,
  // cost_line_items, client_payments, review_items, blockers, deadlines, tasks, payment_requests
  console.log(`Cleared ${projectCount} project(s) and all related task/finance data.`);

  const emp = db.prepare("SELECT * FROM employees WHERE name = ?").get(EMPLOYEE_NAME_TO_REMOVE);
  if (emp) {
    db.prepare("DELETE FROM files WHERE owner_type = 'employee' AND owner_id = ?").run(emp.id);
    db.prepare("DELETE FROM employees WHERE id = ?").run(emp.id); // cascades contracts,
    // leave_cycles, leave_records, payroll_entries
    if (emp.user_id) db.prepare("DELETE FROM users WHERE id = ?").run(emp.user_id);
    console.log(`Removed employee "${EMPLOYEE_NAME_TO_REMOVE}" and their login.`);
  } else {
    console.log(`Employee "${EMPLOYEE_NAME_TO_REMOVE}" not found — nothing to remove there.`);
  }

  const remaining = db.prepare("SELECT code, name, title FROM employees ORDER BY name").all();
  console.log(`Remaining employees (${remaining.length}):`);
  remaining.forEach((e) => console.log(`  ${e.code} — ${e.name} (${e.title})`));
});

run();
console.log("Done. Projects/finance are now empty; employee roster is otherwise unchanged.");
