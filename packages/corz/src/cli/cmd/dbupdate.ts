import mysql from "mysql2/promise"
import fs from "fs/promises"
import path from "path"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { EOL } from "os"

export const DbUpdateCommand = cmd({
  command: "dbupdate",
  describe: "update the database schema in MySQL",
  async handler() {
    const envPath = path.resolve(".env")
    const schemaPath = path.resolve("database/schema.sql")

    let envContent: string
    try {
      envContent = await fs.readFile(envPath, "utf-8")
    } catch {
      UI.error(".env not found in current directory")
      process.exit(1)
    }

    let schemaSql: string
    try {
      schemaSql = await fs.readFile(schemaPath, "utf-8")
    } catch {
      UI.error("database/schema.sql not found")
      process.exit(1)
    }

    const env: Record<string, string> = {}
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }

    const host = env.DB_HOST || "localhost"
    const user = env.DB_USER || "root"
    const password = env.DB_PASS || ""
    const dbName = env.DB_NAME

    if (!dbName) {
      UI.error("DB_NAME not set in .env")
      process.exit(1)
    }

    let conn
    try {
      conn = await mysql.createConnection({ host, user, password })
    } catch (err) {
      UI.error(`MySQL connection failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }

    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
      await conn.query(`USE \`${dbName}\``)

      for (const stmt of schemaSql.split(";").map(s => s.trim()).filter(Boolean)) {
        await conn.query(stmt)
      }

      process.stderr.write(`${EOL}${UI.Style.TEXT_NORMAL_BOLD}✔ Database "${dbName}" updated${UI.Style.TEXT_NORMAL}${EOL}${EOL}`)
    } catch (err) {
      UI.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    } finally {
      await conn.end()
    }
  },
})
