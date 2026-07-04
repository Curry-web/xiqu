import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { config, toPublicUrl } from '../config.js'
import { prisma } from '../db.js'
import { convertToTencentSoeWav, scoreWithTencentSoe } from '../services/tencentSoe.js'

const createPracticeSchema = z.object({
  type: z.string().min(1).max(32),
  minutes: z.number().int().min(1).max(24 * 60),
  note: z.string().max(500).optional(),
  practicedAt: z.string().datetime().optional(),
})

const allowedAudioTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

function mapPractice(record) {
  return {
    id: record.id,
    type: record.type,
    minutes: record.minutes,
    note: record.note,
    practicedAt: record.practicedAt,
    createdAt: record.createdAt,
  }
}

function extensionFor(filename, mimetype) {
  const ext = path.extname(filename || '').toLowerCase()
  if (ext) return ext
  if (mimetype === 'audio/mpeg' || mimetype === 'audio/mp3') return '.mp3'
  if (mimetype === 'audio/webm') return '.webm'
  if (mimetype === 'audio/wav') return '.wav'
  if (mimetype === 'video/mp4') return '.m4a'
  if (mimetype === 'video/quicktime') return '.mov'
  if (mimetype === 'video/webm') return '.webm'
  return '.dat'
}

function mapScoredRecording(recording) {
  return {
    id: recording.id,
    title: recording.title,
    filePath: recording.filePath,
    fileUrl: toPublicUrl(recording.filePath),
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    durationSeconds: recording.durationSeconds,
    refText: recording.refText,
    scoreStatus: recording.scoreStatus,
    totalScore: recording.totalScore,
    accuracyScore: recording.accuracyScore,
    fluencyScore: recording.fluencyScore,
    completionScore: recording.completionScore,
    feedback: recording.feedback,
    createdAt: recording.createdAt,
  }
}

async function getDemoUserId() {
  const user = await prisma.user.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  })

  return user?.id
}

async function removeFileIfExists(filePath) {
  if (!filePath) return
  await fs.promises.rm(filePath, { force: true })
}

export async function practiceRoutes(app) {
  app.get('/practice-records', { preHandler: app.authenticate }, async (request) => {
    const items = await prisma.practiceRecord.findMany({
      where: { userId: request.currentUser.id },
      orderBy: { practicedAt: 'desc' },
      take: 100,
    })

    return { items: items.map(mapPractice) }
  })

  app.post('/practice-records', { preHandler: app.authenticate }, async (request) => {
    const body = createPracticeSchema.parse(request.body)
    const item = await prisma.practiceRecord.create({
      data: {
        userId: request.currentUser.id,
        type: body.type,
        minutes: body.minutes,
        note: body.note || '',
        practicedAt: body.practicedAt ? new Date(body.practicedAt) : new Date(),
      },
    })

    return { item: mapPractice(item) }
  })

  app.post('/practice/score', async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.code(400).send({ error: '请选择练功录音文件' })
    }

    if (!allowedAudioTypes.has(data.mimetype)) {
      return reply.code(415).send({ error: '只支持常见音频或视频文件' })
    }

    const refText = String(data.fields?.refText?.value || '').trim()
    if (!refText) {
      return reply.code(400).send({ error: '请输入标准唱词' })
    }

    const userId = await getDemoUserId()
    if (!userId) {
      return reply.code(500).send({ error: '请先初始化用户数据' })
    }

    const title = String(data.fields?.title?.value || '唱戏评分').slice(0, 80)
    const uploadRoot = path.join(config.uploadDir, 'recordings')
    await mkdir(uploadRoot, { recursive: true })

    const filename = `${Date.now()}-${randomUUID()}${extensionFor(data.filename, data.mimetype)}`
    const filePath = path.join(uploadRoot, filename)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const stat = await fs.promises.stat(filePath)
    const relativePath = `uploads/recordings/${filename}`
    const convertedRoot = path.join(config.uploadDir, 'converted')
    let convertedPath = ''

    try {
      convertedPath = await convertToTencentSoeWav(filePath, convertedRoot)
      const score = await scoreWithTencentSoe({ wavPath: convertedPath, refText })

      const item = await prisma.recordingUpload.create({
        data: {
          userId,
          title,
          filePath: relativePath,
          mimeType: data.mimetype,
          sizeBytes: stat.size,
          refText,
          scoreStatus: 'scored',
          totalScore: score.totalScore,
          accuracyScore: score.accuracyScore,
          fluencyScore: score.fluencyScore,
          completionScore: score.completionScore,
          feedback: score.feedback,
          scoreRaw: {
            provider: 'tencent-soe',
            region: config.tencentSoe.region,
            engineType: config.tencentSoe.engineType,
            response: score.raw,
          },
        },
      })

      return reply.code(201).send({ item: mapScoredRecording(item) })
    } catch (error) {
      const message = error instanceof Error ? error.message : '腾讯云评分失败'
      const item = await prisma.recordingUpload.create({
        data: {
          userId,
          title,
          filePath: relativePath,
          mimeType: data.mimetype,
          sizeBytes: stat.size,
          refText,
          scoreStatus: 'failed',
          feedback: message,
          scoreRaw: {
            provider: 'tencent-soe',
            error: message,
          },
        },
      })

      return reply.code(502).send({
        error: message,
        item: mapScoredRecording(item),
      })
    } finally {
      await removeFileIfExists(convertedPath)
    }
  })
}
