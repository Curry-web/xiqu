import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const agentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = path.resolve(agentRoot, '..')

function parseDotEnv(content) {
  const values = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

export function loadEnv() {
  for (const envFile of [path.join(repoRoot, '.env'), path.join(repoRoot, 'wiki/xiqu-knowledge/.env')]) {
    if (!fs.existsSync(envFile)) continue
    const values = parseDotEnv(fs.readFileSync(envFile, 'utf8'))
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
}

export function resolveFromRepo(value, fallback) {
  const target = value || fallback
  if (path.isAbsolute(target)) return target
  return path.resolve(repoRoot, target)
}

export function getConfig() {
  loadEnv()
  return {
    port: Number(process.env.AGENT_PORT || 8787),
    host: process.env.AGENT_HOST || '127.0.0.1',
    wikiDir: resolveFromRepo(process.env.SAGE_WIKI_DIR, 'wiki/xiqu-knowledge'),
    useLlm: process.env.AGENT_USE_LLM !== '0',
    searchLimit: Number(process.env.AGENT_SEARCH_LIMIT || 8),
    llmTimeoutMs: Number(process.env.AGENT_LLM_TIMEOUT_SECONDS || 60) * 1000,
    sageWikiBin: process.env.SAGE_WIKI_BIN || 'sage-wiki',
  }
}
