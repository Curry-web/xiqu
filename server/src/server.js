import fastifyCors from '@fastify/cors'
import fastifyMultipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { config } from './config.js'
import { prisma } from './db.js'
import { authPlugin } from './plugins/auth.js'
import { agentRoutes } from './routes/agent.js'
import { authRoutes } from './routes/auth.js'
import { favoriteRoutes } from './routes/favorites.js'
import { homeRoutes } from './routes/home.js'
import { operaRoutes } from './routes/operas.js'
import { practiceRoutes } from './routes/practice.js'
import { uploadRoutes } from './routes/uploads.js'
import { userRoutes } from './routes/users.js'

const app = Fastify({
  logger: true,
})

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: '请求参数不正确',
      details: error.issues,
    })
  }

  app.log.error(error)
  return reply.code(500).send({ error: '服务器开小差了' })
})

await app.register(fastifyCors, {
  origin: config.origin === '*' ? true : config.origin.split(',').map((item) => item.trim()),
  credentials: true,
})

await app.register(fastifyMultipart, {
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 1,
  },
})

await app.register(fastifyStatic, {
  root: config.publicDir,
  prefix: '/',
})

await app.register(fastifyStatic, {
  root: config.uploadDir,
  prefix: '/uploads/',
  decorateReply: false,
})

await app.register(authPlugin)
await app.register(agentRoutes, { prefix: '/api' })
await app.register(authRoutes, { prefix: '/api' })
await app.register(favoriteRoutes, { prefix: '/api' })
await app.register(userRoutes, { prefix: '/api' })
await app.register(homeRoutes, { prefix: '/api' })
await app.register(operaRoutes, { prefix: '/api' })
await app.register(practiceRoutes, { prefix: '/api' })
await app.register(uploadRoutes, { prefix: '/api' })

app.get('/api/health', async () => ({
  status: 'ok',
  service: 'xiqu-server',
}))

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await app.listen({
  host: config.host,
  port: config.port,
})
