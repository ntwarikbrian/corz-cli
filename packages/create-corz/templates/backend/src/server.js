const express = require("express")
const cors = require("cors")
require("dotenv").config()
const { bootstrap } = require("./config/db")
const authRoutes = require("./routes/auth")

const app = express()
app.use(cors())
app.use(express.json())
app.use("/api", authRoutes)

const PORT = process.env.PORT || {{port}}

bootstrap().then(() => {
  app.listen(PORT)
})
