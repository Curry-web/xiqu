import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import WebSocket from 'ws'
import { config } from '../config.js'

const SOE_HOST = 'soe.cloud.tencent.com'
const SOE_PATH_PREFIX = '/soe/api'

function ensureTencentSoeConfig() {
  const missing = []
  if (!config.tencentSoe.appId) missing.push('TENCENT_APP_ID')
  if (!config.tencentSoe.secretId) missing.push('TENCENT_SECRET_ID')
  if (!config.tencentSoe.secretKey) missing.push('TENCENT_SECRET_KEY')

  if (missing.length > 0) {
    throw new Error(`缺少腾讯云口语评测配置：${missing.join(', ')}`)
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`ffmpeg 转码失败：${stderr || `exit code ${code}`}`))
    })
  })
}

export async function convertToTencentSoeWav(inputPath, outputDir) {
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `${Date.now()}-${crypto.randomUUID()}.wav`)

  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-sample_fmt',
    's16',
    outputPath,
  ])

  return outputPath
}

function buildSignedUrl({ refText, voiceId }) {
  const appId = String(config.tencentSoe.appId)
  const now = Math.floor(Date.now() / 1000)
  const params = {
    secretid: config.tencentSoe.secretId,
    timestamp: String(now),
    expired: String(now + 60 * 10),
    nonce: String(Math.floor(Math.random() * 1000000)),
    server_engine_type: config.tencentSoe.engineType,
    voice_id: voiceId,
    voice_format: '1',
    text_mode: '0',
    ref_text: refText,
    eval_mode: refText.replace(/\s+/g, '').length > 30 ? '2' : '1',
    score_coeff: '2.5',
    sentence_info_enabled: '1',
    rec_mode: '1',
  }

  const sortedQuery = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  const signSource = `${SOE_HOST}${SOE_PATH_PREFIX}/${appId}?${sortedQuery}`
  const signature = crypto.createHmac('sha1', config.tencentSoe.secretKey).update(signSource).digest('base64')
  const encodedQuery = new URLSearchParams({ ...params, signature }).toString()

  return `wss://${SOE_HOST}${SOE_PATH_PREFIX}/${appId}?${encodedQuery}`
}

function normalizeTencentMessage(message) {
  const text = Buffer.isBuffer(message) ? message.toString('utf8') : String(message)
  return JSON.parse(text)
}

function tencentErrorMessage(payload) {
  const code = Number(payload.code ?? payload.Code ?? 0)
  const message = payload.message || payload.Message || payload.error || payload.Error || JSON.stringify(payload)

  if (code === 4002) {
    return '腾讯云口语评测鉴权失败：请检查 AppID、SecretId、SecretKey 是否属于同一账号，并确认后端已重启。'
  }

  if (code === 4003) {
    return '腾讯云口语评测失败：当前 AppID 未开通口语评测服务。'
  }

  if (code === 4004) {
    return '腾讯云口语评测失败：资源包未生效或次数已用尽。'
  }

  if (code === 4007) {
    return '腾讯云口语评测失败：音频格式与 voice_format 不匹配，请使用 16kHz 单声道 wav。'
  }

  if (code >= 4102 && code <= 4115) {
    return `腾讯云口语评测失败：标准唱词文本不符合要求（${message}）。`
  }

  return `腾讯云口语评测失败：${message}`
}

function getNestedValue(source, names) {
  if (!source || typeof source !== 'object') return null

  for (const [key, value] of Object.entries(source)) {
    if (names.some((name) => name.toLowerCase() === key.toLowerCase())) {
      return value
    }

    if (value && typeof value === 'object') {
      const nested = getNestedValue(value, names)
      if (nested !== null && nested !== undefined) {
        return nested
      }
    }
  }

  return null
}

function readNumber(raw, names) {
  const direct = getNestedValue(raw, names)
  if (direct !== null && direct !== undefined && Number.isFinite(Number(direct))) {
    return Number(direct)
  }

  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  for (const name of names) {
    const match = new RegExp(`${name}\\s*[:=]\\s*"?(-?\\d+(?:\\.\\d+)?)"?`, 'i').exec(text)
    if (match) {
      return Number(match[1])
    }
  }

  return null
}

function getResultPayload(payload) {
  const result = payload.result ?? payload.Result ?? payload.data ?? payload.Data ?? payload

  if (typeof result === 'string') {
    try {
      return JSON.parse(result)
    } catch {
      return result
    }
  }

  return result
}

function normalizePercentScore(value) {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value)))
}

function normalizeRatioScore(value, fallback) {
  if (!Number.isFinite(value)) return normalizePercentScore(fallback)
  if (value < 0) return 0
  if (value <= 1) return Math.round(value * 100)
  return normalizePercentScore(value)
}

function parseTencentFinalResult(payload) {
  const result = getResultPayload(payload)
  const suggestedScore =
    readNumber(result, ['SuggestedScore', 'suggested_score', 'TotalScore', 'total_score', 'Score']) ?? 0
  const pronAccuracy = readNumber(result, ['PronAccuracy', 'pron_accuracy', 'AccuracyScore']) ?? suggestedScore
  const pronFluency = readNumber(result, ['PronFluency', 'pron_fluency', 'FluencyScore']) ?? suggestedScore
  const pronCompletion = readNumber(result, ['PronCompletion', 'pron_completion', 'CompletionScore']) ?? suggestedScore

  return {
    totalScore: normalizePercentScore(suggestedScore),
    accuracyScore: normalizePercentScore(pronAccuracy),
    fluencyScore: normalizeRatioScore(pronFluency, suggestedScore),
    completionScore: normalizeRatioScore(pronCompletion, suggestedScore),
    raw: payload,
  }
}

function isFinalMessage(payload) {
  return payload.final === 1 || payload.final === '1' || payload.Final === 1 || payload.Final === '1'
}

function feedbackForScore(totalScore) {
  if (totalScore >= 90) {
    return '腾讯云评分显示完成度很好，可以继续打磨身段、气口和情绪处理。'
  }

  if (totalScore >= 80) {
    return '腾讯云评分显示整体不错，建议重点练习拖腔稳定度和句尾收束。'
  }

  return '腾讯云评分显示还需要放慢速度，先把唱词咬字和每句完整度练稳。'
}

export async function scoreWithTencentSoe({ wavPath, refText }) {
  ensureTencentSoeConfig()

  const audioBuffer = await fs.readFile(wavPath)
  const signedUrl = buildSignedUrl({
    refText,
    voiceId: crypto.randomUUID(),
  })

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(signedUrl, {
      perMessageDeflate: false,
    })

    const timeout = setTimeout(() => {
      ws.terminate()
      reject(new Error('腾讯云口语评测超时'))
    }, 30000)

    let settled = false
    let audioSent = false

    function finish(error, result) {
      if (settled) return
      settled = true
      clearTimeout(timeout)

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }

      if (error) {
        reject(error)
        return
      }

      resolve(result)
    }

    function sendAudio() {
      if (audioSent) return
      audioSent = true
      ws.send(audioBuffer)
      ws.send(JSON.stringify({ type: 'end' }))
    }

    ws.on('message', (message) => {
      try {
        const payload = normalizeTencentMessage(message)
        const code = Number(payload.code ?? payload.Code ?? 0)

        if (code !== 0) {
          finish(new Error(tencentErrorMessage(payload)))
          return
        }

        if (!audioSent && !isFinalMessage(payload)) {
          sendAudio()
          return
        }

        if (!isFinalMessage(payload)) {
          return
        }

        const parsed = parseTencentFinalResult(payload)
        finish(null, {
          ...parsed,
          feedback: feedbackForScore(parsed.totalScore),
        })
      } catch (error) {
        finish(error)
      }
    })

    ws.on('error', (error) => {
      finish(error)
    })

    ws.on('close', () => {
      if (!settled) {
        finish(new Error('腾讯云口语评测连接已关闭，未收到最终评分结果。'))
      }
    })
  })
}
