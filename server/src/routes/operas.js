import { z } from 'zod'
import { toPublicUrl } from '../config.js'
import { prisma } from '../db.js'

const querySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
})

function mapOpera(opera) {
  return {
    id: opera.id,
    title: opera.title,
    genre: opera.genre,
    coverPath: opera.coverPath,
    coverUrl: opera.coverPath ? toPublicUrl(opera.coverPath) : '',
    summary: opera.summary,
  }
}

export async function operaRoutes(app) {
  app.get('/operas', async (request) => {
    const query = querySchema.parse(request.query)
    const items = await prisma.opera.findMany({
      where: {
        status: 'published',
        ...(query.genre ? { genre: query.genre } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: 50,
    })

    return { items: items.map(mapOpera) }
  })

  app.get('/operas/:id', async (request, reply) => {
    const id = Number(request.params.id)
    const opera = await prisma.opera.findFirst({
      where: { id, status: 'published' },
    })

    if (!opera) {
      return reply.code(404).send({ error: '剧目不存在' })
    }

    return { item: mapOpera(opera) }
  })
}
