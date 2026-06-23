const jwt = require("jsonwebtoken");

// This runs before any route that needs the user to be logged in.
// It checks the Authorization header for "Bearer <token>", verifies it,
// and attaches the decoded user id to req.userId so later route handlers
// know WHO is making the request.
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = requireAuth;
