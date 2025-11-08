// routes/requisitions.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { auth, roleCheck } = require("../middleware/auth");

// --- Submit new request ---
router.post("/submit", auth, roleCheck("requester", "admin"), (req, res) => {
  const {
    date,
    department,
    purpose,
    destination,
    departure,
    return: returnTime,
    passengers,
    vehicleType,
    deptResponsible,
    logisticsOfficer,
    vehiclePlate,
    driverName,
    actualDeparture,
    actualReturn,
    remarks
  } = req.body;

  const requestedBy = req.user.username; // ✅ Always take from token

  const sql = `
    INSERT INTO car_requisitions (
      date, department, requestedBy, purpose, destination, departure, returnTime,
      passengers, vehicleType, deptResponsible, logisticsOfficer,
      vehiclePlate, driverName, actualDeparture, actualReturn, remarks, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
  `;

  db.query(sql, [
    date, department, requestedBy, purpose, destination, departure, returnTime,
    passengers, vehicleType, deptResponsible, logisticsOfficer,
    vehiclePlate, driverName, actualDeparture, actualReturn, remarks
  ], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "Request submitted successfully!" });
  });
});

// --- Department Approval ---
router.put("/approve/department/:id", auth, roleCheck("department", "admin"), (req, res) => {
  const { deptSignature } = req.body;
  const { id } = req.params;

  const sql = `
    UPDATE car_requisitions
    SET deptSignature = ?, deptDate = NOW(), status = 'approved'
    WHERE id = ? AND status = 'pending' AND deptSignature IS NULL
  `;

  db.query(sql, [deptSignature, id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Request must be pending for Department approval" });
    res.json({ message: "Department approval recorded" });
  });
});
 //-----dept reject
router.put("/reject/department/:id", auth, roleCheck("department", "admin"), (req, res) => {
  const { reason } = req.body;
  const { id } = req.params;

  if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

  const sql = `
    UPDATE car_requisitions
    SET status = 'rejected', deptSignature = 'Rejected', deptDate = NOW(), remarks = ?
    WHERE id = ? AND status = 'pending' AND deptSignature IS NULL
  `;

  db.query(sql, [reason, id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Request must be pending for Department rejection" });
    res.json({ message: "Department rejection recorded" });
  });
});


// --- Logistics Approval ---
router.put("/approve/logistics/:id", auth, roleCheck("logistics", "admin"), (req, res) => {
  const { vehiclePlate, driverName } = req.body;
  const { id } = req.params;

  if (!vehiclePlate || !driverName)
    return res.status(400).json({ message: "Vehicle Plate and Driver Name required" });

  const sql = `
    UPDATE car_requisitions
    SET logisticsSignature = 'Approved', logisticsDate = NOW(),
        vehiclePlate = ?, driverName = ?, status = 'logistics_approved'
    WHERE id = ? AND deptSignature IS NOT NULL
  `;

  db.query(sql, [vehiclePlate, driverName, id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Request must be approved by Department first" });
    res.json({ message: "Logistics approved successfully" });
  });
});

// --- DAF Approval ---
router.put("/approve/daf/:id", auth, roleCheck("daf", "admin"), (req, res) => {
  const { dafSignature } = req.body;
  const { id } = req.params;

  const sql = `
    UPDATE car_requisitions
    SET dafSignature = ?, dafDate = NOW(), status = 'approved'
    WHERE id = ? AND logisticsSignature IS NOT NULL
  `;

  db.query(sql, [dafSignature, id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Request must be approved by Logistics first" });
    res.json({ message: "DAF approved successfully" });
  });
});

// --- Cancel Request (only by requester while pending) ---
router.delete("/cancel/:id", auth, roleCheck("requester", "admin"), (req, res) => {
  const { id } = req.params;
  const username = req.user.username;

  const sql = `
    DELETE FROM car_requisitions
    WHERE id = ? AND requestedBy = ? AND status = 'pending'
  `;

  db.query(sql, [id, username], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (result.affectedRows === 0)
      return res.status(400).json({ message: "Cannot cancel this request — already processed or not owned by you." });
    res.json({ message: "Request cancelled successfully." });
  });
});
// --- Reports Endpoint with Date Filter ---
router.get("/report", auth, (req, res) => {
  let baseSql = `
    SELECT id, requestedBy, department, destination, vehicleType, vehiclePlate, 
           driverName, status, remarks, created_at 
    FROM car_requisitions
    WHERE 1=1
  `;
  const params = [];

  // Role-based filtering
  switch (req.user.role) {
    case "admin":
      // No additional filter
      break;
    case "logistics":
      baseSql += " AND deptSignature IS NOT NULL";
      break;
    case "department":
      baseSql += " AND department = ?";
      params.push(req.user.department);
      break;
    case "requester":
      baseSql += " AND requestedBy = ?";
      params.push(req.user.username);
      break;
    default:
      return res.status(403).json({ message: "Unauthorized role" });
  }

  // --- Date range filtering (optional) ---
  const { start, end } = req.query;
  if (start && end) {
    baseSql += " AND DATE(created_at) BETWEEN ? AND ?";
    params.push(start, end);
  } else if (start) {
    baseSql += " AND DATE(created_at) >= ?";
    params.push(start);
  } else if (end) {
    baseSql += " AND DATE(created_at) <= ?";
    params.push(end);
  }

  baseSql += " ORDER BY created_at DESC";

  db.query(baseSql, params, (err, rows) => {
    if (err) {
      console.error("Report query error:", err);
      return res.status(500).json({ message: "Database error while loading reports" });
    }
    res.json(rows);
  });
});



// --- Get all requests filtered by role ---
router.get("/", auth, (req, res) => {
  let sql = "";
  const params = [];

  switch (req.user.role) {
    case "admin":
      sql = "SELECT * FROM car_requisitions ORDER BY created_at DESC";
      break;
    case "requester":
      sql = "SELECT * FROM car_requisitions WHERE requestedBy = ? ORDER BY created_at DESC";
      params.push(req.user.username);
      break;
    case "department":
      sql = "SELECT * FROM car_requisitions WHERE status = 'pending' ORDER BY created_at DESC";
      break;
    case "logistics":
  sql = "SELECT * FROM car_requisitions WHERE deptSignature IS NOT NULL AND (status = 'dept_approved' OR status = 'approved' OR status IS NULL OR status = '') ORDER BY created_at DESC";
      break;
    case "daf":
      sql = "SELECT * FROM car_requisitions WHERE logisticsSignature IS NOT NULL AND dafSignature IS NULL ORDER BY created_at DESC";
      break;
    default:
      return res.status(403).json({ message: "Unauthorized role" });
  }

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    res.json(rows);
  });
});

// --- Explicit /my route for frontend compatibility ---
router.get("/my", auth, roleCheck("requester", "admin"), (req, res) => {
  const sql = `
    SELECT * FROM car_requisitions
    WHERE requestedBy = ?
    ORDER BY created_at DESC
  `;
  db.query(sql, [req.user.username], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(rows);
  });
});

module.exports = router;
