const express = require("express");
const router = express.Router();
const db = require("../db");

// Get available vehicles
router.get("/available", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM fleet WHERE isAvailable = 1");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching fleet data" });
  }
});

// Assign a vehicle
router.post("/assign/:id", async (req, res) => {
  const vehicleId = req.params.id;
  try {
    // Check if vehicle is available
    const [rows] = await db.query("SELECT * FROM fleet WHERE id = ? AND isAvailable = 1", [vehicleId]);
    if (rows.length === 0) return res.status(400).json({ message: "Vehicle not available or not found" });

    // Mark as unavailable
    await db.query("UPDATE fleet SET isAvailable = 0 WHERE id = ?", [vehicleId]);

    res.json({ message: `Vehicle ${rows[0].plate} assigned successfully`, vehicle: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error assigning vehicle" });
  }
});

module.exports = router;
