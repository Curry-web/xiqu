import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { config, toPublicUrl } from '../config.js'
import { prisma } from '../db.js'
import {
  analyzePracticeWav,
  combinePracticeScore,
  compareSingingWavs,
} from '../services/practiceScoring.js'
import { convertToTencentSoeWav, scoreWithTencentSoe } from '../services/tencentSoe.js'
import { scoreWithPython } from '../services/pythonScoring.js'

const createPracticeSchema = z.object({
  type: z.string().min(1).max(32),
  minutes: z.number().int().min(1).max(24 * 60),
  note: z.string().max(500).optional(),
  practicedAt: z.string().datetime().optional(),
})

const allowedAudioTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'video/mp4',
  'video/quicktime',
  'video/webm',
])

const allowedMediaExtensions = new Set([
  '.aac',
  '.m4a',
  '.mov',
  '.mp3',
  '.mp4',
  '.ogg',
  '.wav',
  '.webm',
])

const practiceReferences = {
  'mudanting-youyuan-yiju': {
    id: 'mudanting-youyuan-yiju',
    title: '《牡丹亭·游园》完整唱句示范',
    refText: '可知我常一生儿爱好，是天然。',
    wavPath: path.join(config.publicDir, 'practice-samples', 'mudanting-youyuan-yiju-reference.wav'),
  },
}

const defaultReferenceId = 'mudanting-youyuan-yiju'

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

function extractOperaTitle(referenceTitle, fallbackTitle) {
  const source = String(referenceTitle || fallbackTitle || '').trim()
  const bracketed = source.match(/《([^》]+)》/)?.[1] || source
  return bracketed.split(/[·・:：—-]/)[0].replace(/(?:完整)?唱句(?:示范|练习)?$/, '').trim()
}

function mapRepertoireCover(opera) {
  const imagePath = opera?.coverPath || opera?.assets?.[0]?.imagePath || ''
  return imagePath ? toPublicUrl(imagePath) : ''
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

function isAllowedMediaUpload(data) {
  const extension = path.extname(data.filename || '').toLowerCase()
  return allowedAudioTypes.has(data.mimetype) || allowedMediaExtensions.has(extension)
}

function normalizeTencentPercent(value, fallback, isRatio = false) {
  const numeric = Number(value)
  const fallbackNumeric = Number(fallback)
  const score = Number.isFinite(numeric) ? numeric : fallbackNumeric
  if (!Number.isFinite(score) || score < 0) return 0
  const percent = isRatio && score <= 1 ? score * 100 : score
  return Math.round(Math.max(0, Math.min(100, percent)))
}

function calculateLyricRecognitionScore(accuracyScore, fluencyScore, completionScore) {
  return Math.round(
    accuracyScore * 0.55
      + fluencyScore * 0.3
      + completionScore * 0.15,
  )
}

function mapScoredRecording(recording) {
  const scoreRaw = recording.scoreRaw && typeof recording.scoreRaw === 'object' ? recording.scoreRaw : {}
  const tencent = scoreRaw.tencent && typeof scoreRaw.tencent === 'object' ? scoreRaw.tencent : {}
  const localAnalysis = scoreRaw.localAnalysis && typeof scoreRaw.localAnalysis === 'object' ? scoreRaw.localAnalysis : {}
  const singingComparison = scoreRaw.singingComparison && typeof scoreRaw.singingComparison === 'object'
    ? scoreRaw.singingComparison
    : {}
  const reference = scoreRaw.reference && typeof scoreRaw.reference === 'object' ? scoreRaw.reference : {}
  const scoring = scoreRaw.scoring && typeof scoreRaw.scoring === 'object' ? scoreRaw.scoring : {}
  const tencentResponse = tencent.response && typeof tencent.response === 'object' ? tencent.response : {}
  const tencentResult = tencentResponse.result && typeof tencentResponse.result === 'object'
    ? tencentResponse.result
    : {}
  const accuracyScore = normalizeTencentPercent(
    tencentResult.PronAccuracy,
    tencent.accuracyScore ?? recording.accuracyScore,
  )
  const fluencyScore = normalizeTencentPercent(
    tencentResult.PronFluency,
    tencent.fluencyScore ?? recording.fluencyScore,
    true,
  )
  const completionScore = normalizeTencentPercent(
    tencentResult.PronCompletion,
    tencent.completionScore ?? recording.completionScore,
    true,
  )
  const tencentRawScore = normalizeTencentPercent(
    tencent.totalScore,
    recording.totalScore,
  )
  const lyricRecognitionScore = normalizeTencentPercent(
    tencent.lyricRecognitionScore,
    calculateLyricRecognitionScore(accuracyScore, fluencyScore, completionScore),
  )
  const durationSimilarity = normalizeTencentPercent(singingComparison.durationSimilarity, 0)
  const voicedSimilarity = normalizeTencentPercent(singingComparison.voicedSimilarity, 0)
  const performanceCompletionScore = durationSimilarity > 0 || voicedSimilarity > 0
    ? Math.round(
      durationSimilarity * 0.6
        + voicedSimilarity * 0.25
        + completionScore * 0.15,
    )
    : completionScore

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
    accuracyScore,
    fluencyScore,
    completionScore,
    lyricCompletionScore: completionScore,
    performanceCompletionScore,
    tencentScore: lyricRecognitionScore,
    tencentRawScore,
    practiceScore: Number(scoring.practiceScore ?? recording.totalScore ?? 0),
    audioQualityScore: Number(scoring.audioQualityScore ?? 0),
    referenceId: String(reference.id || ''),
    referenceTitle: String(reference.title || ''),
    pitchScore: Number(singingComparison.pitchScore ?? 0),
    contourScore: Number(singingComparison.contourScore ?? 0),
    melodyScore: Number(singingComparison.melodyScore ?? 0),
    rhythmScore: Number(singingComparison.rhythmScore ?? 0),
    ornamentScore: Number(singingComparison.ornamentScore ?? 0),
    vibratoScore: Number(singingComparison.vibratoScore ?? 0),
    timbreScore: Number(singingComparison.timbreScore ?? 0),
    resonanceScore: Number(singingComparison.resonanceScore ?? 0),
    dynamicsScore: Number(singingComparison.dynamicsScore ?? 0),
    breathScore: Number(scoring.breathQualityScore ?? singingComparison.breathScore ?? 0),
    periodicityScore: Number(singingComparison.periodicityScore ?? 0),
    referenceVibratoRateHz: Number(singingComparison.referenceVibratoRateHz ?? 0),
    attemptVibratoRateHz: Number(singingComparison.attemptVibratoRateHz ?? 0),
    referenceVibratoExtentCents: Number(singingComparison.referenceVibratoExtentCents ?? 0),
    attemptVibratoExtentCents: Number(singingComparison.attemptVibratoExtentCents ?? 0),
    pitchOffsetCents: Number(singingComparison.averagePitchOffsetCents ?? 0),
    meanPitchErrorCents: Number(singingComparison.meanPitchErrorCents ?? 0),
    durationScore: Number(localAnalysis.durationScore ?? 0),
    activityScore: Number(localAnalysis.activityScore ?? 0),
    levelScore: Number(localAnalysis.levelScore ?? 0),
    clippingScore: Number(localAnalysis.clippingScore ?? 0),
    scoringFormula: String(scoring.formula || ''),
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
  app.get('/practice/repertoire', async (request, reply) => {
    const userId = await getDemoUserId()
    if (!userId) return reply.code(500).send({ error: '请先初始化用户数据' })

    const recordings = await prisma.recordingUpload.findMany({
      where: { userId, scoreStatus: 'scored' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const operas = await prisma.opera.findMany({
      where: { status: 'published' },
      include: {
        assets: {
          where: { imagePath: { not: null } },
          orderBy: [{ assetType: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
    })

    const groups = new Map()
    for (const recording of recordings) {
      const scoreRaw = recording.scoreRaw && typeof recording.scoreRaw === 'object' ? recording.scoreRaw : {}
      const reference = scoreRaw.reference && typeof scoreRaw.reference === 'object' ? scoreRaw.reference : {}
      const title = extractOperaTitle(reference.title, recording.title)
      if (!title) continue

      const opera = operas.find((item) => item.title === title || item.title.includes(title) || title.includes(item.title))
      const referenceId = String(reference.id || '')
      const key = opera ? `opera:${opera.id}` : `reference:${referenceId || title}`
      const current = groups.get(key)
      const score = Number(recording.totalScore ?? 0)

      if (current) {
        current.practiceCount += 1
        current.bestScore = Math.max(current.bestScore, score)
        continue
      }

      groups.set(key, {
        id: key,
        operaId: opera?.id ?? null,
        referenceId,
        title: opera?.title || title,
        genre: opera?.genre || '',
        coverUrl: mapRepertoireCover(opera),
        practiceCount: 1,
        bestScore: Math.round(score),
        latestPracticedAt: recording.createdAt,
      })
    }

    return { items: [...groups.values()] }
  })

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
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: '请选择音频或视频文件后再提交评分' })
    }

    const data = await request.file()
    if (!data) {
      return reply.code(400).send({ error: '请选择练功录音文件' })
    }

    if (!isAllowedMediaUpload(data)) {
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
    const referenceId = String(data.fields?.referenceId?.value || defaultReferenceId)
    const reference = practiceReferences[referenceId]
    if (!reference) {
      return reply.code(400).send({ error: '未找到对应的示范唱段，请重新选择练习曲目。' })
    }
    const uploadRoot = path.join(config.uploadDir, 'recordings')
    await mkdir(uploadRoot, { recursive: true })

    const filename = `${Date.now()}-${randomUUID()}${extensionFor(data.filename, data.mimetype)}`
    const filePath = path.join(uploadRoot, filename)
    await pipeline(data.file, fs.createWriteStream(filePath))

    const stat = await fs.promises.stat(filePath)
    const relativePath = `uploads/recordings/${filename}`
    const convertedRoot = path.join(config.uploadDir, 'converted')
    let convertedPath = ''
    let localAnalysis = null
    let singingComparison = null
    let acousticEngine = 'javascript-fallback'

    try {
      convertedPath = await convertToTencentSoeWav(filePath, convertedRoot)
      try {
        const pythonResult = await scoreWithPython({
          referenceWavPath: reference.wavPath,
          attemptWavPath: convertedPath,
        })
        localAnalysis = pythonResult.localAnalysis
        singingComparison = pythonResult.singingComparison
        acousticEngine = pythonResult.algorithmVersion || 'python-librosa-pyin-dtw-v1'
      } catch (pythonError) {
        request.log.warn({ err: pythonError }, 'Python scoring unavailable; using JavaScript fallback')
        localAnalysis = await analyzePracticeWav(convertedPath)
        singingComparison = await compareSingingWavs(reference.wavPath, convertedPath)
      }
      const score = await scoreWithTencentSoe({ wavPath: convertedPath, refText })
      const lyricRecognitionScore = calculateLyricRecognitionScore(
        score.accuracyScore,
        score.fluencyScore,
        score.completionScore,
      )
      const practiceScore = combinePracticeScore(lyricRecognitionScore, localAnalysis, singingComparison)

      const item = await prisma.recordingUpload.create({
        data: {
          userId,
          title,
          filePath: relativePath,
          mimeType: data.mimetype,
          sizeBytes: stat.size,
          durationSeconds: Math.round(localAnalysis.durationSeconds),
          refText,
          scoreStatus: 'scored',
          totalScore: practiceScore.practiceScore,
          accuracyScore: score.accuracyScore,
          fluencyScore: score.fluencyScore,
          completionScore: score.completionScore,
          feedback: practiceScore.feedback,
          scoreRaw: {
            provider: 'tencent-soe',
            acousticEngine,
            region: config.tencentSoe.region,
            engineType: config.tencentSoe.engineType,
            reference: {
              id: reference.id,
              title: reference.title,
              refText: reference.refText,
            },
            tencent: {
              totalScore: score.totalScore,
              lyricRecognitionScore,
              accuracyScore: score.accuracyScore,
              fluencyScore: score.fluencyScore,
              completionScore: score.completionScore,
              response: score.raw,
            },
            localAnalysis,
            singingComparison,
            scoring: practiceScore,
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
          durationSeconds: localAnalysis ? Math.round(localAnalysis.durationSeconds) : null,
          refText,
          scoreStatus: 'failed',
          feedback: message,
          scoreRaw: {
            provider: 'tencent-soe',
            acousticEngine,
            error: message,
            localAnalysis,
            reference: {
              id: reference.id,
              title: reference.title,
            },
            singingComparison,
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
