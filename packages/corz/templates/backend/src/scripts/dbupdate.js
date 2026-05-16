require("dotenv").config()
const mysql = require("mysql2/promise")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcrypt")

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  })

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``)
  await conn.query(`USE \`${process.env.DB_NAME}\``)

  const schemaPath = path.resolve(__dirname, "../../../database/schema.sql")
  const raw = fs.readFileSync(schemaPath, "utf8")
  for (const stmt of raw.split(";").map(s => s.trim()).filter(Boolean)) {
    await conn.query(stmt)
  }

  const [rows] = await conn.query("SELECT COUNT(*) AS count FROM users")
  if (rows[0].count === 0) {
    const hash = await bcrypt.hash("user123", 10)
    await conn.query("INSERT INTO users (username, password) VALUES (?, ?)", ["user", hash])
  }

  await conn.end()
  console.log("Database updated successfully")
}

main().catch((err) => {
  console.error("Database update failed:", err.message)
  process.exit(1)
})
