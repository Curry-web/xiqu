import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('xiqu1234', 10)

  await prisma.user.upsert({
    where: { phone: '18800000000' },
    update: {},
    create: {
      phone: '18800000000',
      nickname: '测试戏友',
      passwordHash,
    },
  })

  await prisma.homeOpening.createMany({
    data: [
      {
        title: '春江花月夜',
        venue: '梨园小剧场',
        startTime: new Date('1970-01-01T19:30:00.000Z'),
        openingDate: new Date(),
        imagePath: 'openings/today-opening-fan.png',
        description: '昆曲扇面身段与经典唱段展示',
        isFeatured: true,
        sortOrder: 10,
      },
      {
        title: '水袖折子戏',
        venue: '兰苑厅',
        startTime: new Date('1970-01-01T14:30:00.000Z'),
        openingDate: new Date(),
        imagePath: 'openings/opening-water-sleeves.jpg',
        description: '水袖功法与折子戏片段',
        sortOrder: 20,
      },
      {
        title: '变脸火彩',
        venue: '锦绣戏台',
        startTime: new Date('1970-01-01T20:00:00.000Z'),
        openingDate: new Date(),
        imagePath: 'openings/opening-fire.jpg',
        description: '川剧变脸与火彩表演',
        sortOrder: 30,
      },
    ],
    skipDuplicates: true,
  })

  await prisma.opera.createMany({
    data: [
      {
        title: '牡丹亭',
        genre: '昆曲',
        coverPath: 'openings/today-opening-fan.png',
        summary: '汤显祖代表作，写杜丽娘与柳梦梅的梦中情缘。',
        sortOrder: 10,
      },
      {
        title: '贵妃醉酒',
        genre: '京剧',
        coverPath: 'openings/opening-water-sleeves.jpg',
        summary: '梅派经典剧目，重在身段、唱腔与人物神韵。',
        sortOrder: 20,
      },
    ],
    skipDuplicates: true,
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
