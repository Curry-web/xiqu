import { toPublicUrl } from '../config.js'
import { prisma } from '../db.js'

function formatTime(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16)
  }
  return String(value).slice(0, 5)
}

function mapOpening(opening) {
  return {
    id: opening.id,
    title: opening.title,
    venue: opening.venue,
    startTime: formatTime(opening.startTime),
    imagePath: opening.imagePath,
    imageUrl: toPublicUrl(opening.imagePath),
    description: opening.description,
    featured: opening.isFeatured ?? opening.is_featured,
  }
}

function mapOperaOpening(opera, featured) {
  const imagePath = opera.coverPath || opera.assets?.[0]?.imagePath || ''
  return {
    id: opera.id,
    title: opera.title,
    venue: opera.venue,
    startTime: opera.startTime ? formatTime(opera.startTime) : '',
    imagePath,
    imageUrl: toPublicUrl(imagePath),
    description: opera.summary,
    featured,
  }
}

function mapLiyuanMaterial(material) {
  return {
    id: material.id,
    category: material.category,
    colorName: material.colorName,
    colorCode: material.colorCode,
    title: material.title,
    imagePath: material.imagePath,
    imageUrl: toPublicUrl(material.imagePath),
    sourceFileName: material.sourceFileName,
  }
}

function dailySeed(value) {
  return [...value].reduce((seed, character) => ((seed * 31) + character.charCodeAt(0)) >>> 0, 2166136261)
}

function pickDailyMaterials(items, count, salt) {
  if (items.length <= count) return items

  const day = new Date().toISOString().slice(0, 10)
  const start = dailySeed(`${day}:${salt}`) % items.length
  return Array.from({ length: count }, (_, index) => items[(start + index) % items.length])
}

function pickDailyColor(colors) {
  if (!colors.length) return ''
  const day = new Date().toISOString().slice(0, 10)
  return colors[dailySeed(`${day}:liyuan-color`) % colors.length]
}

export async function homeRoutes(app) {
  app.get('/home/today-openings', async () => {
    const operaItems = await prisma.opera.findMany({
      where: {
        status: 'published',
        isDailyCandidate: true,
      },
      include: {
        assets: {
          where: { imagePath: { not: null } },
          orderBy: [{ assetType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    if (operaItems.length) {
      return {
        items: pickDailyMaterials(operaItems, Math.min(2, operaItems.length), 'today-openings')
          .map((opera, index) => mapOperaOpening(opera, index === 0)),
      }
    }

    const items = await prisma.$queryRaw`
      select
        id,
        title,
        venue,
        start_time as "startTime",
        image_path as "imagePath",
        description,
        is_featured
      from home_openings
      where opening_date = current_date
        and status = 'published'
      order by is_featured desc, sort_order asc, start_time asc, id asc
    `

    return { items: items.map(mapOpening) }
  })

  app.get('/home/liyuan-materials', async (request) => {
    const requestedColorCode = String(request.query?.colorCode || '').trim().toLowerCase()
    const materials = await prisma.liyuanMaterial.findMany({
      where: {
        status: 'published',
      },
      orderBy: [{ weight: 'desc' }, { id: 'asc' }],
    })

    const availableColors = [...new Set(materials.map((item) => item.colorCode))]
      .filter((colorCode) => {
        const sameColorMaterials = materials.filter((item) => item.colorCode === colorCode)
        return sameColorMaterials.some((item) => item.category === 'performer') &&
          sameColorMaterials.some((item) => item.category === 'costume')
      })

    const requestedMaterials = requestedColorCode
      ? materials.filter((item) => item.colorCode === requestedColorCode)
      : []
    const requestedHasBoth = requestedMaterials.some((item) => item.category === 'performer') &&
      requestedMaterials.some((item) => item.category === 'costume')
    const colorCode = requestedHasBoth ? requestedColorCode : pickDailyColor(availableColors)
    const sameColorMaterials = colorCode ? materials.filter((item) => item.colorCode === colorCode) : []
    const performers = sameColorMaterials.filter((item) => item.category === 'performer')
    const costumes = sameColorMaterials.filter((item) => item.category === 'costume')

    return {
      colorCode,
      requestedColorCode,
      availableColors,
      performers: pickDailyMaterials(performers, 2, `${colorCode}:performer`).map(mapLiyuanMaterial),
      costumes: pickDailyMaterials(costumes, 1, `${colorCode}:costume`).map(mapLiyuanMaterial),
    }
  })
}
