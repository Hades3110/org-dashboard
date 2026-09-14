import cors from 'cors'
import express from 'express'
import { aiSearchRouter } from './routes/aiSearchRoute.js'
import { orgTreeRouter } from './routes/orgTree.js'
import { streamRouter } from './routes/streamRoute.js'

// Deliberately not `process.env.PORT`: that variable is reserved by the dev
// tooling for the client's own preview port and must not leak into here.
const PORT = Number(process.env.SERVER_PORT ?? 3001)

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', orgTreeRouter)
app.use('/api', streamRouter)
app.use('/api', aiSearchRouter)

app.listen(PORT, () => {
  console.log(`org-dashboard server listening on http://localhost:${PORT}`)
})
