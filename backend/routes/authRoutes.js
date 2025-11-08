const express = require("express");
const router = express.Router();
const db = require("../db");              // Your MySQL connection
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");      // For password hashing
const { secretKey } = require("../middleware/auth");

// POST login
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Fill all fields" });

  // Query user from database
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = results[0];

    // Compare password with hashed password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secretKey,
      { expiresIn: "8h" }
    );

    res.json({ token, username: user.username, role: user.role });
  });
});

module.exports = router;
