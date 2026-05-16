import path from "path"
import fs from "fs/promises"
import { cmd } from "../cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { EOL } from "os"

function generateJwtSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

async function copyDir(src: string, dest: string, replace: Record<string, string>) {
  const entries = await fs.readdir(src, { withFileTypes: true })
  await fs.mkdir(dest, { recursive: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, replace)
    } else {
      let content = await fs.readFile(srcPath, "utf-8")
      for (const [key, value] of Object.entries(replace)) {
        content = content.split(key).join(value)
      }
      await fs.writeFile(destPath, content, "utf-8")
    }
  }
}

export const SetupCommand = cmd({
  command: "setup",
  describe: "scaffold a new fullstack project",
  async handler() {
    const folderName = await prompts.text({
      message: "Folder name",
      initialValue: "my-project",
      validate: (x) => (x?.trim() ? undefined : "Folder name is required"),
    })
    if (prompts.isCancel(folderName)) throw new UI.CancelledError()

    const projectName = await prompts.text({
      message: "Project name",
      initialValue: folderName.trim(),
      validate: (x) => (x?.trim() ? undefined : "Project name is required"),
    })
    if (prompts.isCancel(projectName)) throw new UI.CancelledError()

    const databaseName = await prompts.text({
      message: "Database name",
      initialValue: folderName.trim().replace(/-/g, "_"),
      validate: (x) => (x?.trim() ? undefined : "Database name is required"),
    })
    if (prompts.isCancel(databaseName)) throw new UI.CancelledError()

    const backendDir = await prompts.text({
      message: "Backend folder name",
      initialValue: "server",
      validate: (x) => (x?.trim() ? undefined : "Backend folder name is required"),
    })
    if (prompts.isCancel(backendDir)) throw new UI.CancelledError()

    const frontendDir = await prompts.text({
      message: "Frontend folder name",
      initialValue: "client",
      validate: (x) => (x?.trim() ? undefined : "Frontend folder name is required"),
    })
    if (prompts.isCancel(frontendDir)) throw new UI.CancelledError()

    const target = path.resolve(folderName.trim())
    const templateDir = path.resolve(import.meta.dirname, "../../../templates")

    const spinner = prompts.spinner()
    spinner.start("Scaffolding project...")

    const jwtSecret = generateJwtSecret()
    const port = "3001"
    const replace: Record<string, string> = {
      "{{projectName}}": projectName.trim(),
      "{{databaseName}}": databaseName.trim(),
      "{{backendFolder}}": backendDir.trim(),
      "{{frontendFolder}}": frontendDir.trim(),
      "{{port}}": port,
      "{{jwtSecret}}": jwtSecret,
    }

    try {
      await fs.mkdir(target, { recursive: true })

      await copyDir(path.join(templateDir, "backend"), path.join(target, backendDir.trim()), replace)
      await copyDir(path.join(templateDir, "database"), path.join(target, "database"), replace)
      await copyDir(path.join(templateDir, "frontend"), path.join(target, frontendDir.trim()), replace)

      spinner.stop("Project files created")

      spinner.start("Installing backend dependencies...")
      const { execSync } = await import("child_process")
      execSync("npm install", { cwd: path.join(target, backendDir.trim()), stdio: "ignore" })
      spinner.stop("Backend dependencies installed")

      spinner.start("Installing frontend dependencies...")
      execSync("npm install", { cwd: path.join(target, frontendDir.trim()), stdio: "ignore" })
      spinner.stop("Frontend dependencies installed")
    } catch (err) {
      spinner.stop("Scaffolding failed", 1)
      if (err instanceof Error) {
        UI.error(err.message)
      }
      return
    }

    const bold = UI.Style.TEXT_NORMAL_BOLD
    const dim = UI.Style.TEXT_DIM
    const reset = UI.Style.TEXT_NORMAL

    const done = `✔ Project "${projectName.trim()}" created!`
    for (let i = 5; i >= 0; i--) {
      process.stderr.write(`\r${bold}${done}  ready in ${i}s${reset}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
    process.stderr.write(EOL)
    process.stderr.write(EOL)
    process.stderr.write(`${bold}1. Start backend:${reset}${EOL}`)
    process.stderr.write(`  cd ${folderName.trim()}/${backendDir.trim()}${EOL}`)
    process.stderr.write(`  Edit ${dim}.env${reset} with your MySQL credentials${EOL}`)
    process.stderr.write(`  ${dim}npm run dev${reset}   → backend on :${port}${EOL}`)
    process.stderr.write(EOL)
    process.stderr.write(`${bold}2. Start frontend (new terminal):${reset}${EOL}`)
    process.stderr.write(`  cd ${folderName.trim()}/${frontendDir.trim()}${EOL}`)
    process.stderr.write(`  ${dim}npm run dev${reset}   → frontend on :5173${EOL}`)
    process.stderr.write(EOL)
    process.stderr.write(`${bold}Default login:${reset}  user / user123${EOL}`)
    process.stderr.write(EOL)
    process.stderr.write(`${bold}Use corz AI to edit your code:${reset}${EOL}`)
    process.stderr.write(`  ${dim}corz ai "add a feature"${reset}${EOL}`)
    process.stderr.write(EOL)
  },
})
