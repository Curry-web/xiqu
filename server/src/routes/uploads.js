import fs from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { config, toPublicUrl } from '../config.js'
import { prisma } from '../db.js'

const allowedAudioTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
])

function extensionFor(filename, mimetype) {
  const ext = path.extname(filename || '').toLowerCase()
  if (ext) return ext
  if (mimetype === 'audio/mpeg' || mimetype === 'audio/mp3') return '.mp3'
  if (mimetype === 'audio/webm') return '.webm'
  if (mimetype === 'audio/wav') return '.wav'
  if (mimetype === 'video/mp4') return '.m4a'
  return '.dat'
}

function mapRecording(recording) {
  return {
    id: recording.id,
    title: recording.title,
    filePath: recording.filePath,
    fileUrl: toPublicUrl(recording.filePath),
    mimeType: recording.mimeType,
    sizeBytes: recording.sizeBytes,
    durationSeconds: recording.durationSeconds,
    createdAt: recording.createdAt,
  }
}

export async function uploadRoutes(app) {
  app.get('/recordings', { preHandler: app.authenticate }, async (request) => {
    const items = await prisma.recordingUpload.findMany({
      where: { userId: request.currentUser.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return { items: items.map(mapRecording) }
  })

  app.post('/recordings', { preHandler: app.authenticate }, async (request, reply) => {
    const data = await request.file()
    if (!data) {
      return reply.code(400).send({ error: '请选择录音文件' })
    }

    if (!allowedAudioTypes.has(data.mimetype)) {
      return reply.code(415).send({ error: '只支持常见音频文件' })
    }

    const title = String(data.fields?.title?.value || data.filename || '练功录音').slice(0, 80)
    const uploadRoot = path.join(config.uploadDir, 'recordings')
    await mkdir(uploadRoot, { recursive: true })

    const filename = `${Date.now()}-${randomUUID()}${extensionFor(data.filename, data.mimetype)}`
    const filePath = path.join(uploadRoot, filename)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const stat = await fs.promises.stat(filePath)
    const relativePath = `uploads/recordings/${filename}`
    const item = await prisma.recordingUpload.create({
      data: {
        userId: request.currentUser.id,
        title,
        filePath: relativePath,
        mimeType: data.mimetype,
        sizeBytes: stat.size,
      },
    })

    return reply.code(201).send({ item: mapRecording(item) })
  })
}
