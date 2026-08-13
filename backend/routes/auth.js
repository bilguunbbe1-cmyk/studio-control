const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { JWT_SECRET, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email, password шаардлагатай" });

  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Имэйл эсвэл нууц үг буруу байна" });
  }
  const user = { id: row.id, email: row.email, name: row.name, role: row.role };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { ...user, ...employeeExtras(row.id) } });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: { ...req.user, ...employeeExtras(req.user.id) } });
});

function employeeExtras(userId) {
  const e = db.prepare("SELECT id, photo_url FROM employees WHERE user_id = ?").get(userId);
  return { employeeId: e ? e.id : null, photoUrl: e && e.photo_url ? `/uploads/${e.photo_url}` : null };
}

module.exports = router;
