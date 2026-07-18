const domainTerms = [
  '京剧', '昆曲', '昆剧', '越剧', '黄梅戏', '戏曲', '豫剧', '秦腔',
  '花旦', '青衣', '老生', '小生', '武生', '净角', '丑角', '生旦净丑',
  '唱腔', '身段', '水袖', '脸谱', '行当', '剧目', '牡丹亭', '长生殿',
  '四大名旦', '梅兰芳', '程砚秋', '尚小云', '荀慧生',
]

const intentTerms = ['区别', '不同', '对比', '特点', '代表', '来源', '历史', '唱腔', '表演', '剧目', '学习', '入门']

function normalizeQuery(query) {
  return String(query || '')
    .replace(/[？?！!。，、；;：:“”"'（）()《》【】\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueQueries(queries) {
  const seen = new Set()
  const result = []
  for (const query of queries.map(normalizeQuery).filter(Boolean)) {
    if (seen.has(query)) continue
    seen.add(query)
    result.push(query)
  }
  return result.slice(0, 5)
}

export function buildRuleBasedQueries(question) {
  const normalized = normalizeQuery(question)
  const terms = []
  for (const term of [...domainTerms, ...intentTerms]) {
    if (normalized.includes(term) && !terms.includes(term)) terms.push(term)
  }

  const queries = []
  if (terms.length >= 2) queries.push(terms.join(' '))

  const domainOnly = terms.filter((term) => domainTerms.includes(term))
  for (const term of domainOnly) queries.push(`${term} 概述`)
  if (domainOnly.length >= 2) queries.push(`${domainOnly.join(' ')} 唱腔 表演 特点`)

  const compact = normalized
    .replace(/[的了呢吗吧呀和与及以及有什么是什么为什么怎么如何哪些多少]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  queries.push(compact || normalized)

  return uniqueQueries(queries)
}

export function parseQueryPlan(rawText, fallbackQuestion) {
  const text = String(rawText || '').trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) return uniqueQueries(parsed)
      if (Array.isArray(parsed.queries)) return uniqueQueries(parsed.queries)
    } catch {
      // Fall through to line parsing.
    }
  }

  const lineQueries = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.、\s]+/, '').trim())
    .filter(Boolean)
  const parsed = uniqueQueries(lineQueries)
  return parsed.length ? parsed : buildRuleBasedQueries(fallbackQuestion)
}
