#!/usr/bin/env node
const path = require("path")
const fs = require("fs")
const cp = require("child_process")
const prompts = require("@clack/prompts")
const { EOL } = require("os")

const GREEN = "\x1b[32m"
const RED = "\x1b[31m"
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

function getBar(elapsed, estimate) {
  const w = 8
  const pct = Math.min(Math.floor((elapsed / estimate) * 99), 99)
  const fill = Math.round((pct / 100) * w)
  return DIM + "[" + GREEN + "\u2588".repeat(fill) + " ".repeat(w - fill) + "]" + RESET + " " + String(pct).padStart(3) + "%"
}

async function main() {
  process.stderr.write(EOL)
  process.stderr.write("  create-corz " + DIM + "\u2014 fullstack app scaffolder" + RESET + EOL)
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

  const databaseName = await prompts.text({
    message: "Database name",
    validate: (x) => (x?.trim() ? undefined : "Database name is required"),
  })
  if (prompts.isCancel(databaseName)) process.exit(0)

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

  try {
    fs.mkdirSync(target, { recursive: true })
    copyDir(path.join(templateDir, "backend"), path.join(target, backendDir.trim()), replace)
    copyDir(path.join(templateDir, "database"), path.join(target, "database"), replace)
    copyDir(path.join(templateDir, "frontend"), path.join(target, frontendDir.trim()), replace)
  } catch (err) {
    process.stderr.write("  " + RED + "\u2716" + RESET + " Scaffolding failed" + EOL)
    process.stderr.write("  " + RED + err.message + RESET + EOL)
    process.exit(1)
  }

  process.stderr.write("  " + GREEN + "\u2714" + RESET + " Project files created" + EOL)
  process.stderr.write(EOL)

  const tasks = [
    {
      label: "Installing backend dependencies",
      doneLabel: "Backend dependencies installed",
      estimate: 120000,
      run: () => runAsync("npm install", { cwd: path.join(target, backendDir.trim()), timeout: 120000 }),
    },
    {
      label: "Installing frontend dependencies",
      doneLabel: "Frontend dependencies installed",
      estimate: 120000,
      run: () => runAsync("npm install", { cwd: path.join(target, frontendDir.trim()), timeout: 120000 }),
    },
    {
      label: "Installing corz CLI",
      doneLabel: "corz CLI installed",
      failedLabel: "corz CLI install skipped",
      estimate: 60000,
      run: () => runAsync("npm install -g corz", { timeout: 60000 }),
    },
  ]

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  const started = Date.now()
  const state = tasks.map((t) => ({
    ...t,
    start: Date.now(),
    endTime: 0,
    done: false,
    failed: false,
  }))

  for (const _ of state) {
    process.stderr.write("  " + EOL)
  }

  const promises = state.map((s) =>
    s
      .run()
      .then(
        () => {
          s.done = true
          s.endTime = Date.now()
        },
        () => {
          s.done = true
          s.failed = true
          s.endTime = Date.now()
        },
      ),
  )

  function renderLine(s) {
    const now = s.done ? s.endTime : Date.now()
    const elapsed = ((now - s.start) / 1000).toFixed(1) + "s"
    if (s.done) {
      const pct = 100
      const sym = s.failed ? RED + "\u2716" + RESET : GREEN + "\u2714" + RESET
      const label = s.failed ? (s.failedLabel || s.label) : (s.doneLabel || s.label)
      const bar = DIM + "[" + GREEN + "\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588" + DIM + "]" + RESET + " " + pct + "%"
      return "  " + sym + " " + label + "  " + DIM + elapsed + RESET + " " + bar + "\x1b[0K"
    }
    const bar = getBar(Date.now() - s.start, s.estimate)
    return "  " + frames[fi % frames.length] + " " + s.label + "  " + DIM + elapsed + RESET + " " + bar + "\x1b[0K"
  }

  let fi = 0
  let stopped = false
  const interval = setInterval(() => {
    if (stopped) return
    fi++
    process.stderr.write("\x1b[" + state.length + "A")
    for (const s of state) {
      process.stderr.write(renderLine(s) + EOL)
    }
    if (state.every((s) => s.done)) {
      stopped = true
      clearInterval(interval)
    }
  }, 150)

  await Promise.allSettled(promises)
  if (!stopped) {
    stopped = true
    clearInterval(interval)
    process.stderr.write("\x1b[" + state.length + "A")
    for (const s of state) {
      process.stderr.write(renderLine(s) + EOL)
    }
  }

  const totalTime = ((Date.now() - started) / 1000).toFixed(1)
  process.stderr.write(EOL)
  process.stderr.write(
    "  " + GREEN + "\u2714" + RESET + " " + BOLD + 'Project "' + projectName.trim() + '" created!' + RESET + "  " + DIM + "completed in " + totalTime + "s" + RESET + EOL,
  )
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
