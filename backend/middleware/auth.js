// middleware/auth.js
const jwt = require("jsonwebtoken");
const secretKey = "mugonero_secret_key";

// Authenticate User
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Access denied. No authorization header." });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Access denied. No token provided." });

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded; // { id, username, role }
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
}

// Role-based access
function roleCheck(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "User not authenticated." });
    if (!allowedRoles.includes(req.user.role))
      return res.status(403).json({ message: "Forbidden: insufficient privileges." });
    next();
  };
}

module.exports = { auth, roleCheck, secretKey };
