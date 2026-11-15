const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer storage for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Load data.json
const DATA_FILE = path.join(__dirname, "data.json");
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      patients: [],
      doctors: [],
      hospitals: [],
      organs: [],
      blood: [],
      appointments: [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all records
app.get("/api/all", (req, res) => {
  const data = loadData();
  res.json(data);
});

// POST new record
app.post("/api/:type", upload.single("photo"), (req, res) => {
  const type = req.params.type;
  const data = loadData();
  if (!data[type]) data[type] = [];

  const newItem = { ...req.body };
  if (req.file) {
    newItem.photo = `/uploads/${req.file.filename}`;
  } else {
    newItem.photo = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
  }

  data[type].push(newItem);
  saveData(data);
  res.json({ success: true, item: newItem });
});

// PUT update record
app.put("/api/:type/:index", upload.single("photo"), (req, res) => {
  const type = req.params.type;
  const index = parseInt(req.params.index);
  const data = loadData();

  if (!data[type] || !data[type][index])
    return res.status(404).send("Record not found");

  const item = data[type][index];
  Object.keys(req.body).forEach((key) => {
    if (key !== "editIndex") item[key] = req.body[key];
  });

  if (req.file) {
    item.photo = `/uploads/${req.file.filename}`;
  }

  saveData(data);
  res.json({ success: true, item });
});

// DELETE record
app.delete("/api/:type/:id", (req, res) => {
  const type = req.params.type;
  const id = req.params.id;
  const data = loadData();

  if (data[type]) {
    data[type] = data[type].filter((item) => item.id !== id);
    saveData(data);
  }
  res.json({ success: true });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Seva Care Server running on http://localhost:${PORT}`);
});
