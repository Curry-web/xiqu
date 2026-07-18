import { z } from 'zod'
import { toPublicUrl } from '../config.js'
import { prisma } from '../db.js'

const sectionTypeSchema = z.enum(['content', 'knowledge', 'chant'])

const querySchema = z.object({
  operaId: z.coerce.number().int().positive().optional(),
  sectionType: sectionTypeSchema.optional(),
})

const updateSchema = z.object({
  operaId: z.number().int().positive(),
  sectionType: sectionTypeSchema,
  assetId: z.number().int().positive().optional(),
  favorited: z.boolean(),
})

async function getDemoUserId() {
  const user = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  return user?.id
}

function mapFavorite(favorite) {
  const isContent = favorite.sectionType === 'content'
  return {
    id: favorite.id,
    operaId: favorite.operaId,
    sectionType: favorite.sectionType,
    title: `${favorite.opera.title}·${isContent ? '内容' : '知识'}`,
    operaTitle: favorite.opera.title,
    genre: favorite.opera.genre,
    coverUrl: favorite.opera.coverPath ? toPublicUrl(favorite.opera.coverPath) : '',
    summary: isContent
      ? favorite.opera.summary
      : favorite.opera.knowledgeTitle || favorite.opera.summary,
    createdAt: favorite.createdAt,
  }
}

function mapAssetFavorite(favorite) {
  const { asset } = favorite
  return {
    id: favorite.id,
    assetId: asset.id,
    operaId: asset.operaId,
    sectionType: 'chant',
    title: `${asset.opera.title}·${asset.title}`,
    operaTitle: asset.opera.title,
    genre: asset.opera.genre,
    coverUrl: toPublicUrl(asset.imagePath || asset.opera.coverPath),
    mediaUrl: toPublicUrl(asset.mediaPath),
    duration: asset.duration,
    summary: asset.duration ? `唱段 · ${asset.duration}` : '唱段收藏',
    createdAt: favorite.createdAt,
  }
}

export async function favoriteRoutes(app) {
  app.get('/favorites', async (request, reply) => {
    const userId = await getDemoUserId()
    if (!userId) return reply.code(500).send({ error: '请先初始化用户数据' })

    const query = querySchema.parse(request.query)
    const includeText = query.sectionType !== 'chant'
    const includeChants = !query.sectionType || query.sectionType === 'chant'
    const [textItems, chantItems] = await Promise.all([
      includeText
        ? prisma.operaFavorite.findMany({
          where: {
            userId,
            ...(query.operaId ? { operaId: query.operaId } : {}),
            ...(query.sectionType ? { sectionType: query.sectionType } : {}),
            opera: { status: 'published' },
          },
          include: { opera: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        : [],
      includeChants
        ? prisma.operaAssetFavorite.findMany({
          where: {
            userId,
            asset: {
              assetType: 'chant',
              ...(query.operaId ? { operaId: query.operaId } : {}),
              opera: { status: 'published' },
            },
          },
          include: { asset: { include: { opera: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        : [],
    ])

    const items = [
      ...textItems.map(mapFavorite),
      ...chantItems.map(mapAssetFavorite),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

    return { items }
  })

  app.post('/favorites', async (request, reply) => {
    const userId = await getDemoUserId()
    if (!userId) return reply.code(500).send({ error: '请先初始化用户数据' })

    const body = updateSchema.parse(request.body)
    const opera = await prisma.opera.findFirst({
      where: { id: body.operaId, status: 'published' },
      select: { id: true },
    })
    if (!opera) return reply.code(404).send({ error: '剧目不存在' })

    if (body.sectionType === 'chant') {
      if (!body.assetId) return reply.code(400).send({ error: '请选择要收藏的唱段' })

      const asset = await prisma.operaAsset.findFirst({
        where: {
          id: body.assetId,
          operaId: body.operaId,
          assetType: 'chant',
          opera: { status: 'published' },
        },
        include: { opera: true },
      })
      if (!asset) return reply.code(404).send({ error: '唱段不存在' })

      if (!body.favorited) {
        await prisma.operaAssetFavorite.deleteMany({ where: { userId, assetId: body.assetId } })
        return { favorited: false }
      }

      const item = await prisma.operaAssetFavorite.upsert({
        where: { userId_assetId: { userId, assetId: body.assetId } },
        update: {},
        create: { userId, assetId: body.assetId },
        include: { asset: { include: { opera: true } } },
      })
      return { favorited: true, item: mapAssetFavorite(item) }
    }

    if (!body.favorited) {
      await prisma.operaFavorite.deleteMany({
        where: {
          userId,
          operaId: body.operaId,
          sectionType: body.sectionType,
        },
      })
      return { favorited: false }
    }

    const item = await prisma.operaFavorite.upsert({
      where: {
        userId_operaId_sectionType: {
          userId,
          operaId: body.operaId,
          sectionType: body.sectionType,
        },
      },
      update: {},
      create: {
        userId,
        operaId: body.operaId,
        sectionType: body.sectionType,
      },
      include: { opera: true },
    })

    return { favorited: true, item: mapFavorite(item) }
  })
}
