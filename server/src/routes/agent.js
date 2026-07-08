import { z } from 'zod'
import { config } from '../config.js'

const messageSchema = z.object({
  role: z.string().min(1),
  content: z.string().default(''),
})

const askSchema = z.object({
  sessionId: z.string().optional(),
  question: z.string().trim().min(1, '问题不能为空').max(500, '问题不能超过 500 字'),
  history: z.array(messageSchema).optional(),
})

function buildRemoteSourceUrl(sourcePath) {
  const url = new URL(config.agent.askUrl)
  url.pathname = url.pathname.replace(/\/ask\/?$/, '/source')
  url.search = new URLSearchParams({ path: sourcePath }).toString()
  return url
}

function toLocalSourceUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl, 'http://xiqu.local')
    const sourcePath = parsed.searchParams.get('path')
    if (!sourcePath) return sourceUrl
    return `/api/agent/source?path=${encodeURIComponent(sourcePath)}`
  } catch {
    return sourceUrl
  }
}

function normalizeSources(data) {
  if (!data || !Array.isArray(data.sources)) return data

  return {
    ...data,
    sources: data.sources.map((source) => ({
      ...source,
      sourceUrls: Array.isArray(source.sourceUrls) ? source.sourceUrls.map(toLocalSourceUrl) : [],
    })),
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.agent.timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function agentRoutes(app) {
  app.post('/agent/ask', async (request, reply) => {
    const payload = askSchema.parse(request.body)

    let response
    try {
      response = await fetchWithTimeout(config.agent.askUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: payload.sessionId || 'xiqu-web-user',
          question: payload.question,
          history: payload.history || [],
        }),
      })
    } catch (error) {
      const isAbort = error?.name === 'AbortError'
      return reply.code(504).send({
        error: isAbort ? '老师的 agent 接口响应超时，请稍后再试' : '无法连接老师的 agent 接口',
      })
    }

    const rawText = await response.text()
    let data
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = { answer: rawText }
    }

    if (!response.ok) {
      return reply.code(response.status).send({
        error: data?.error || data?.message || rawText || `老师接口请求失败：${response.status}`,
        details: data,
      })
    }

    return reply.send(normalizeSources(data))
  })

  app.get('/agent/source', async (request, reply) => {
    const sourcePath = String(request.query?.path || '').trim()
    if (!sourcePath) {
      return reply.code(400).send({ error: 'source path 不能为空' })
    }

    const response = await fetchWithTimeout(buildRemoteSourceUrl(sourcePath), {
      method: 'GET',
      headers: {
        Accept: '*/*',
      },
    })

    if (!response.ok) {
      return reply.code(response.status).send({ error: `资源访问失败：${response.status}` })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    return reply.header('Content-Type', contentType).send(buffer)
  })
}
