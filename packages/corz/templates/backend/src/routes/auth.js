const express = require("express")
const router = express.Router()
const { getPool, getStatus } = require("../config/db")
const { login } = require("../controllers/auth")

router.post("/login", async (req, res) => {
  const st = getStatus()
  if (!st.ready) {
    return res.status(503).json({ error: st.code || "...dbcon" })
  }
  try {
    const result = await login(getPool(), req.body)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
