const SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL
const ADMIN_KEY = import.meta.env.VITE_CORZ_CONVEX_ADMIN_KEY

async function adminFetch(path: string, body: unknown) {
  const res = await fetch(`${SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `Request failed with status ${res.status}`)
  }
  return res.json()
}

export async function createToken(data: {
  fullName: string
  expiresAt: number
  maxUses: number
}) {
  const result = await adminFetch("/admin/create-token", data)
  return result as { ok: boolean; token: string }
}

export async function updateLicense(data: {
  id: string
  fullName?: string
  status?: string
  maxUses?: number
  expiresAt?: number
}) {
  const result = await adminFetch("/admin/update-license", data)
  return result as { ok: boolean }
}

export async function deleteLicense(id: string) {
  const result = await adminFetch("/admin/delete-license", { id })
  return result as { ok: boolean }
}
