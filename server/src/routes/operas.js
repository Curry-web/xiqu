import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { config, toPublicUrl } from '../config.js'
import { prisma } from '../db.js'

const querySchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  dailyOnly: z.coerce.boolean().optional(),
})

function formatTime(value) {
  return value instanceof Date ? value.toISOString().slice(11, 16) : ''
}

function mapOpera(opera) {
  return {
    id: opera.id,
    title: opera.title,
    genre: opera.genre,
    coverPath: opera.coverPath,
    coverUrl: opera.coverPath ? toPublicUrl(opera.coverPath) : '',
    summary: opera.summary,
    venue: opera.venue,
    startTime: formatTime(opera.startTime),
  }
}

function mapAsset(asset) {
  return {
    id: asset.id,
    type: asset.assetType,
    title: asset.title,
    imagePath: asset.imagePath || '',
    imageUrl: asset.imagePath ? toPublicUrl(asset.imagePath) : '',
    mediaPath: asset.mediaPath || '',
    mediaUrl: asset.mediaPath ? toPublicUrl(asset.mediaPath) : '',
    textPath: asset.textPath || '',
    duration: asset.duration,
  }
}

async function readPublicText(relativePath) {
  if (!relativePath) return ''
  const publicRoot = path.resolve(config.publicDir)
  const filePath = path.resolve(publicRoot, relativePath)
  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) return ''

  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return ''
  }
}

export async function operaRoutes(app) {
  app.get('/operas', async (request) => {
    const query = querySchema.parse(request.query)
    const items = await prisma.opera.findMany({
      where: {
        status: 'published',
        ...(query.dailyOnly ? { isDailyCandidate: true } : {}),
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
      include: {
        assets: {
          orderBy: [{ assetType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!opera) return reply.code(404).send({ error: '剧目不存在' })

    const [content, contentDetail, knowledge, knowledgeDetail] = await Promise.all([
      readPublicText(opera.contentPath),
      readPublicText(opera.contentDetailPath),
      readPublicText(opera.knowledgePath),
      readPublicText(opera.knowledgeDetailPath),
    ])

    return {
      item: {
        ...mapOpera(opera),
        content,
        contentDetail,
        knowledgeTitle: opera.knowledgeTitle,
        knowledge,
        knowledgeDetail,
        contentPath: opera.contentPath || '',
        contentDetailPath: opera.contentDetailPath || '',
        knowledgePath: opera.knowledgePath || '',
        knowledgeDetailPath: opera.knowledgeDetailPath || '',
        sourceDocumentPath: opera.sourceDocumentPath,
        chants: opera.assets.filter((asset) => asset.assetType === 'chant').map(mapAsset),
        objects: opera.assets.filter((asset) => asset.assetType === 'object').map(mapAsset),
      },
    }
  })
}
