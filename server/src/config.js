import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const config = {
  host: process.env.SERVER_HOST || '127.0.0.1',
  port: Number(process.env.SERVER_PORT || 8788),
  origin: process.env.SERVER_ORIGIN || '*',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  uploadDir: path.resolve(serverRoot, process.env.UPLOAD_DIR || 'uploads'),
  publicDir: path.resolve(serverRoot, 'public'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.SERVER_PORT || 8788}`,
  tencentSoe: {
    appId: process.env.TENCENT_APP_ID || '',
    secretId: process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TENCENT_SECRET_KEY || '',
    region: process.env.TENCENT_SOE_REGION || 'ap-guangzhou',
    engineType: process.env.TENCENT_SOE_ENGINE || '16k_zh',
  },
  agent: {
    askUrl: process.env.AGENT_REMOTE_ASK_URL || 'https://lab.colourfuldawn.com/xiqu-agent-api/agent/ask',
    timeoutMs: Number(process.env.AGENT_REMOTE_TIMEOUT_MS || 60_000),
  },
}

export function toPublicUrl(pathname) {
  if (!pathname) return ''
  if (/^https?:\/\//i.test(pathname)) return pathname
  return `${config.publicBaseUrl}/${String(pathname).replace(/^\/+/, '')}`
}
