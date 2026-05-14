import os from "os"
import readline from "readline"
import { cmd } from "../cmd/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { verifyLicense } from "@/auth/verification"
import { activateLicense } from "@/auth/activation"
import type { ProgressCallback } from "@/auth/types"
import { licensePath } from "@/auth/storage"

const isWindows = os.platform() === "win32"

async function windowsInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt + ": ", (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export const ActivateCommand = cmd({
  command: "activate",
  describe: "activate corz license",
  async handler() {
    UI.empty()
    prompts.intro("Corz activation")

    const existingLicense = await verifyLicense()
    if (existingLicense.ok) {
      prompts.log.success("License already active")
      prompts.log.info(`Expires: ${new Date(existingLicense.license.expires_at).toLocaleString()}`)
      prompts.outro("This device is already activated.")
      return
    }

    if (existingLicense.code === "expired") {
      prompts.log.warn("Previous license has expired")
      prompts.log.info("You can activate with a new token below")
    }

    const MAX_ATTEMPTS = 4
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      attempt++

      let token: string
      if (isWindows) {
        token = await windowsInput(`Enter activation token (attempt ${attempt}/${MAX_ATTEMPTS})`)
        if (!token || token.trim().length === 0) {
          prompts.log.error("Token is required")
          continue
        }
      } else {
        const result = await prompts.password({
          message: `Enter activation token (attempt ${attempt}/${MAX_ATTEMPTS})`,
          validate: (x) => (x && x.trim().length > 0 ? undefined : "Token is required"),
        })
        if (prompts.isCancel(result)) throw new UI.CancelledError()
        token = result
      }

      const spinner = prompts.spinner()
      let lastMessage = "Verifying token and binding this device"
      spinner.start(lastMessage)

      const onProgress: ProgressCallback = (message) => {
        if (message !== lastMessage) {
          lastMessage = message
          spinner.stop(message, 0)
          spinner.start(message)
        }
      }

      const result = await activateLicense(token.trim(), onProgress)

      if (result.ok) {
        spinner.stop("Activation successful")
        for (const warning of result.device.warnings) {
          prompts.log.warn(warning)
        }
        prompts.log.success(`License saved to ${licensePath()}`)
        prompts.outro("Activation complete. You can now use corz.")
        return
      }

      spinner.stop("Activation failed", 1)
      prompts.log.error(result.error)

      if (attempt < MAX_ATTEMPTS) {
        prompts.log.info("Please try again with a different token")
      } else {
        prompts.log.error("Maximum attempts reached. Activation failed.")
        return
      }
    }
  },
})
