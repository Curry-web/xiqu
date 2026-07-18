import { config } from '../config.js'

export async function scoreWithPython({ referenceWavPath, attemptWavPath }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.pythonScoring.timeoutMs)

  try {
    const response = await fetch(`${config.pythonScoring.url}/score`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reference_path: referenceWavPath,
        attempt_path: attemptWavPath,
      }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.detail || `Python 评分服务返回 ${response.status}`)
    }
    if (!payload.localAnalysis || !payload.singingComparison) {
      throw new Error('Python 评分服务返回的数据不完整')
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Python 评分服务超过 ${config.pythonScoring.timeoutMs / 1000} 秒未响应`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

