const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Defaults to a folder next to the source code, which is fine for local dev but
// sits on the container's ephemeral filesystem in production and gets wiped on
// every deploy/restart -- set UPLOAD_DIR to a path on the persistent disk (the
// same one DB_PATH lives on) so uploaded files actually survive deploys.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = { upload, UPLOAD_DIR };
