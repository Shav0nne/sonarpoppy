import jwt from "jsonwebtoken";

export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing Authorization header" });

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ message: "Malformed Authorization header" });
  }

  const token = parts[1];
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET not set");
    return res.status(500).json({ message: "Server not configured for authentication" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload.sub should be the user id per our sign
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

