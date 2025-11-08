const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

// Routes
const authRoutes = require("./routes/authRoutes");
const requisitionRoutes = require("./routes/requisitionRoutes");
const fleetRoutes = require("./routes/fleetRoutes");
const userRoutes = require("./routes/users"); // <-- user management route

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json()); // parse JSON body
app.use(bodyParser.urlencoded({ extended: true })); // parse URL-encoded form data

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/homepage.html"));
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/requisition", requisitionRoutes);
app.use("/api/fleet", fleetRoutes);
app.use("/api/users", userRoutes); // <-- make sure this is mounted

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
