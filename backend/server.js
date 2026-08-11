require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

require("./db"); // ensures db + tables + seed run on boot

const authRoutes = require("./routes/auth");
const projectsRoutes = require("./routes/projects");
const tasksRoutes = require("./routes/tasks");
const decisionsRoutes = require("./routes/decisions");
const employeesRoutes = require("./routes/employees");
const financeRoutes = require("./routes/finance");
const teamRoutes = require("./routes/team");
const overviewRoutes = require("./routes/overview");
const miscRoutes = require("./routes/misc");
const { UPLOAD_DIR } = require("./lib/uploads");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", overviewRoutes);
app.use("/api", projectsRoutes);
app.use("/api", tasksRoutes);
app.use("/api", decisionsRoutes);
app.use("/api", employeesRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api", teamRoutes);
app.use("/api", miscRoutes);
app.use("/uploads", express.static(UPLOAD_DIR));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Серверийн алдаа гарлаа" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Viral Pixel Project Control API listening on :${PORT}`));
