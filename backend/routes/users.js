const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { auth, roleCheck } = require("../middleware/auth");

// GET all users
router.get("/", auth, roleCheck("admin"), (req, res) => {
  db.query("SELECT id, username, role FROM users", (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});

// POST create user
router.post("/", auth, roleCheck("admin"), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role)
      return res.status(400).json({ message: "All fields required" });

    const hashed = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
    db.query(sql, [username, hashed, role], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY")
          return res.status(400).json({ message: "Username already exists" });
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ message: "User created successfully!" });
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
