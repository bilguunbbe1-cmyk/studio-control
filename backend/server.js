require("dotenv").config();
const express = require("express");
const cors = require("cors");

require("./db"); // ensures db + tables + seed run on boot

const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Серверийн алдаа гарлаа" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Studio Control API listening on :${PORT}`));
