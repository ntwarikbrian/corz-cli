import client from "./client"

export async function login(username, password) {
  const { data } = await client.post("/login", { username, password })
  return data
}
