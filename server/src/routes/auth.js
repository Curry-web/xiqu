import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'

const authSchema = z.object({
  phone: z.string().min(3).max(32),
  password: z.string().min(4).max(72),
  nickname: z.string().min(1).max(32).optional(),
})

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  }
}

export async function authRoutes(app) {
  app.post('/auth/register', async (request, reply) => {
    const body = authSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { phone: body.phone } })

    if (existing) {
      return reply.code(409).send({ error: '手机号已注册' })
    }

    const user = await prisma.user.create({
      data: {
        phone: body.phone,
        nickname: body.nickname || `戏友${body.phone.slice(-4)}`,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
    })
    const token = app.jwt.sign({ sub: String(user.id) })

    return { token, user: publicUser(user) }
  })

  app.post('/auth/login', async (request, reply) => {
    const body = authSchema.pick({ phone: true, password: true }).parse(request.body)
    const user = await prisma.user.findUnique({ where: { phone: body.phone } })

    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: '手机号或密码错误' })
    }

    const token = app.jwt.sign({ sub: String(user.id) })
    return { token, user: publicUser(user) }
  })
}
