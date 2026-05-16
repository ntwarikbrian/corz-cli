const mysql = require("mysql2/promise")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcrypt")

let pool = null
const status = { ready: false, code: null }

async function bootstrap() {
  try {
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

    await conn.end()

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    })

    const [rows] = await pool.query("SELECT COUNT(*) AS count FROM users")
    if (rows[0].count === 0) {
      const hash = await bcrypt.hash("user123", 10)
      await pool.query("INSERT INTO users (username, password) VALUES (?, ?)", ["user", hash])
    }

    status.ready = true
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ER_ACCESS_DENIED_ERROR") {
      status.code = "...dbcon"
    } else {
      status.code = "...notexist"
    }
  }
}

function getPool() {
  if (!status.ready) {
    const err = new Error(status.code || "...dbcon")
    err.code = status.code || "...dbcon"
    throw err
  }
  return pool
}

function getStatus() {
  return status
}

module.exports = { bootstrap, getPool, getStatus }
