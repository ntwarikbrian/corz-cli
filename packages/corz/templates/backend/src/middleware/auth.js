const jwt = require("jsonwebtoken")

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" })
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

module.exports = auth
