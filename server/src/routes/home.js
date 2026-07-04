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

export async function homeRoutes(app) {
  app.get('/home/today-openings', async () => {
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
}
