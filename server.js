require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
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

// १. MongoDB Atlas कनेक्शन (Render वरील MONGO_URI लिंक वापरून)
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://ramandom:raman08@cluster0.i9e5ob4.mongodb.net/myAppDB?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB Atlas यशस्वीरित्या कनेक्ट झाले!");
    await migrateOldJsonData(); // जुन्या data.json मधला डेटा असल्यास MongoDB मध्ये घेईल
  })
  .catch((err) => console.error("MongoDB कनेक्शन एरर:", err));

// २. MongoDB Schema आणि Model
const recordSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    id: String,
  },
  { strict: false },
);
const Record = mongoose.model("Record", recordSchema);

// जुन्या data.json मधला डेटा फक्त पहिल्यांदा MongoDB मध्ये कॉपी करण्यासाठी
async function migrateOldJsonData() {
  const DATA_FILE = path.join(__dirname, "data.json");
  const count = await Record.countDocuments();
  if (count === 0 && fs.existsSync(DATA_FILE)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      const itemsToInsert = [];
      Object.keys(oldData).forEach((type) => {
        if (Array.isArray(oldData[type])) {
          oldData[type].forEach((item) => {
            itemsToInsert.push({ ...item, type });
          });
        }
      });
      if (itemsToInsert.length > 0) {
        await Record.insertMany(itemsToInsert);
        console.log("जुना data.json डेटा MongoDB मध्ये ट्रान्सफर झाला!");
      }
    } catch (e) {
      console.log("Migration skipped:", e.message);
    }
  }
}

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

// GET all records
app.get("/api/all", async (req, res) => {
  try {
    const allRecords = await Record.find().lean();
    const data = {
      patients: [],
      doctors: [],
      hospitals: [],
      organs: [],
      blood: [],
      appointments: [],
    };

    allRecords.forEach((item) => {
      if (!data[item.type]) data[item.type] = [];
      data[item.type].push(item);
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new record
app.post("/api/:type", upload.single("photo"), async (req, res) => {
  try {
    const type = req.params.type;
    const newItem = { ...req.body, type };

    if (req.file) {
      newItem.photo = `/uploads/${req.file.filename}`;
    } else {
      newItem.photo = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    }

    const savedItem = await Record.create(newItem);
    res.json({ success: true, item: savedItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update record
app.put("/api/:type/:index", upload.single("photo"), async (req, res) => {
  try {
    const type = req.params.type;
    const index = parseInt(req.params.index);
    const records = await Record.find({ type });

    if (!records[index]) return res.status(404).send("Record not found");

    const targetId = records[index]._id;
    const updateData = {};

    Object.keys(req.body).forEach((key) => {
      if (key !== "editIndex") updateData[key] = req.body[key];
    });

    if (req.file) {
      updateData.photo = `/uploads/${req.file.filename}`;
    }

    const updatedItem = await Record.findByIdAndUpdate(
      targetId,
      { $set: updateData },
      { new: true },
    );
    res.json({ success: true, item: updatedItem });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
app.delete("/api/:type/:id", async (req, res) => {
  try {
    const type = req.params.type;
    const id = req.params.id;
    await Record.deleteOne({ type, id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Seva Care Server running on http://localhost:${PORT}`);
});
