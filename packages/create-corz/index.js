#!/usr/bin/env node
const path = require("path")
const fs = require("fs")
const cp = require("child_process")
const prompts = require("@clack/prompts")
const { EOL } = require("os")

const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

function generateJwtSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function copyDir(src, dest, replace) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, replace)
    } else {
      let content = fs.readFileSync(srcPath, "utf-8")
      for (const [key, value] of Object.entries(replace)) {
        content = content.split(key).join(value)
      }
      fs.writeFileSync(destPath, content, "utf-8")
    }
  }
}

function runAsync(cmd, opts) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(cmd, [], { shell: true, stdio: "ignore", ...opts })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error("exit code " + code))
    })
  })
}

async function main() {
  process.stderr.write(EOL)
  process.stderr.write("  " + BOLD + "create-corz" + RESET + " " + DIM + "\u2014 fullstack app scaffolder" + RESET + EOL)
  process.stderr.write(EOL)

  const folderName = await prompts.text({
    message: "Folder name",
    validate: (x) => (x?.trim() ? undefined : "Folder name is required"),
  })
  if (prompts.isCancel(folderName)) process.exit(0)

  const projectName = await prompts.text({
    message: "Project name",
    validate: (x) => (x?.trim() ? undefined : "Project name is required"),
  })
  if (prompts.isCancel(projectName)) process.exit(0)

  for (const ex of [" SIMS", " PIMS", " PIMS"]) {
    process.stderr.write("\r  " + DIM + "\u2192 Database name examples:" + ex + RESET + "\x1b[0K")
    await new Promise((r) => setTimeout(r, 500))
  }
  process.stderr.write(EOL)

  const databaseName = await prompts.text({
    message: "Database name",
    validate: (x) => (x?.trim() ? undefined : "Database name is required"),
  })
  if (prompts.isCancel(databaseName)) process.exit(0)

  process.stderr.write(EOL)

  const backendDir = "backend"
  const frontendDir = "frontend"
  const target = path.resolve(folderName.trim())
  const templateDir = path.resolve(__dirname, "templates")

  const jwtSecret = generateJwtSecret()
  const port = "3001"
  const replace = {
    "{{projectName}}": projectName.trim(),
    "{{databaseName}}": databaseName.trim(),
    "{{backendFolder}}": backendDir.trim(),
    "{{frontendFolder}}": frontendDir.trim(),
    "{{port}}": port,
    "{{jwtSecret}}": jwtSecret,
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let frame = 0
  let firstRender = true
  const taskLines = 3
  const extraLines = 2
  const totalLines = taskLines + extraLines

  const tasks = [
    { name: "Backend dependencies", status: "pending" },
    { name: "Frontend dependencies", status: "pending" },
    { name: "corz CLI", status: "pending", optional: true },
  ]

  function render() {
    if (!firstRender) {
      process.stderr.write("\x1b[" + totalLines + "A")
    }
    firstRender = false
    const s = frames[frame % frames.length]
    frame++
    for (const t of tasks) {
      let line
      if (t.status === "running") {
        line = "  " + s + " " + t.name + "\x1b[0K"
      } else if (t.status === "done") {
        line = "  " + GREEN + "\u2714" + RESET + " " + t.name + "  " + DIM + "(" + t.elapsed + "s)" + RESET + "\x1b[0K"
      } else if (t.status === "failed") {
        line = "  " + RED + "\u2716" + RESET + " " + t.name + "\x1b[0K"
      } else if (t.status === "skipped") {
        line = "  " + YELLOW + "\u26A0" + RESET + " " + t.name + "  " + DIM + "run " + BOLD + "npm install -g corz" + RESET + DIM + " manually" + RESET + "\x1b[0K"
      } else {
        line = "    " + DIM + t.name + RESET + "\x1b[0K"
      }
      process.stderr.write(line + EOL)
    }
    process.stderr.write("\r  " + DIM + "\u2500".repeat(30) + RESET + "\x1b[0K" + EOL)
    process.stderr.write("\r  Elapsed: " + elapsed + "s\x1b[0K")
  }

  try {
    fs.mkdirSync(target, { recursive: true })

    const sp = prompts.spinner()
    sp.start("Scaffolding project...")
    copyDir(path.join(templateDir, "backend"), path.join(target, backendDir.trim()), replace)
    copyDir(path.join(templateDir, "database"), path.join(target, "database"), replace)
    copyDir(path.join(templateDir, "frontend"), path.join(target, frontendDir.trim()), replace)
    sp.stop("Project files created")
    process.stderr.write(EOL)

    const startTime = Date.now()
    const renderTimer = setInterval(render, 100)

    tasks[0].fn = () => runAsync("npm install", { cwd: path.join(target, backendDir.trim()), timeout: 120000 })
    tasks[1].fn = () => runAsync("npm install", { cwd: path.join(target, frontendDir.trim()), timeout: 120000 })
    tasks[2].fn = async () => {
      try {
        await runAsync("npm install -g corz", { timeout: 60000 })
      } catch {
        throw new Error("optional")
      }
    }

    await Promise.allSettled(
      tasks.map(async (t) => {
        t.status = "running"
        const ts = Date.now()
        render()
        try {
          await t.fn()
          t.status = "done"
          t.elapsed = ((Date.now() - ts) / 1000).toFixed(1)
        } catch (err) {
          if (t.optional) {
            t.status = "skipped"
          } else {
            t.status = "failed"
          }
        }
        render()
      })
    )

    clearInterval(renderTimer)
    elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    render()
  } catch (err) {
    process.stderr.write("\r  " + RED + "\u2716 Scaffolding failed" + RESET + "\x1b[0K" + EOL)
    process.stderr.write("  " + RED + err.message + RESET + EOL)
    process.exit(1)
  }

  process.stderr.write(EOL)
  process.stderr.write(EOL)

  const done = GREEN + "\u2714" + RESET + " " + BOLD + "Project \"" + projectName.trim() + "\" created!" + RESET + "  " + DIM + "(" + elapsed + "s)" + RESET
  process.stderr.write("  " + done + EOL)
  process.stderr.write(EOL)

  process.stderr.write("  " + BOLD + "1. Start backend:" + RESET + EOL)
  process.stderr.write("     cd " + folderName.trim() + "/" + backendDir.trim() + EOL)
  process.stderr.write("     " + DIM + "Edit .env" + RESET + " with your MySQL credentials" + EOL)
  process.stderr.write("     " + DIM + "npm run dev" + RESET + "        " + DIM + "\u2192 backend on :" + port + RESET + EOL)
  process.stderr.write(EOL)
  process.stderr.write("  " + BOLD + "2. Start frontend (new terminal):" + RESET + EOL)
  process.stderr.write("     cd " + folderName.trim() + "/" + frontendDir.trim() + EOL)
  process.stderr.write("     " + DIM + "npm run dev" + RESET + "        " + DIM + "\u2192 frontend on :5173" + RESET + EOL)
  process.stderr.write(EOL)
  process.stderr.write("  " + BOLD + "\u2501".repeat(45) + RESET + EOL)
  process.stderr.write("  " + BOLD + "\u2726 Use corz ai to edit your current project." + RESET + EOL)
  process.stderr.write("    " + DIM + "corz> \"add the employee page and backend\"" + RESET + EOL)
  process.stderr.write("    " + DIM + "corz> \"change the design like white and green for buttons\"" + RESET + EOL)
  process.stderr.write(EOL)
  process.stderr.write("  " + DIM + "\u2192 Unlock corz ai with " + RESET + GREEN + BOLD + "corz activate" + RESET + EOL)
  process.stderr.write("  " + BOLD + "\u2501".repeat(45) + RESET + EOL)
  process.stderr.write(EOL)
}

main().catch((err) => {
  process.stderr.write(RED + err.message + RESET + EOL)
  process.exit(1)
})
