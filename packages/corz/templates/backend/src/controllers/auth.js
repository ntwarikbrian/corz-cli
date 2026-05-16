const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")

async function login(db, { username, password }) {
  if (!username || !password) throw new Error("Username and password are required")

  const [rows] = await db.query("SELECT * FROM users WHERE username = ?", [username])
  if (rows.length === 0) throw new Error("Invalid username or password")

  const user = rows[0]
  const match = await bcrypt.compare(password, user.password)
  if (!match) throw new Error("Invalid username or password")

  const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" })

  return { token, user: { id: user.id, username: user.username } }
}

module.exports = { login }
