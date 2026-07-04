import fastifyJwt from '@fastify/jwt'
import { config } from '../config.js'
import { prisma } from '../db.js'

export async function authPlugin(app) {
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
  })

  app.decorate('authenticate', async (request, reply) => {
    try {
      const payload = await request.jwtVerify()
      const user = await prisma.user.findUnique({
        where: { id: Number(payload.sub) },
        select: { id: true, phone: true, nickname: true, avatarUrl: true, createdAt: true },
      })

      if (!user) {
        return reply.code(401).send({ error: '登录状态已失效' })
      }

      request.currentUser = user
    } catch {
      return reply.code(401).send({ error: '请先登录' })
    }
  })
}
