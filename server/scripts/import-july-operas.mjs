import 'dotenv/config'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import XLSX from 'xlsx'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(serverRoot, '..')
const publicRoot = path.join(serverRoot, 'public')
const outputRoot = path.join(publicRoot, 'opera-materials')
const prisma = new PrismaClient()

const operaSlugs = {
  雷雨: 'lei-yu',
  罗汉钱: 'luohan-qian',
  大雷雨: 'da-lei-yu',
  牙痕记: 'yahen-ji',
  六国封相: 'liuguo-fengxiang',
  卖油郎独占花魁: 'maiyoulang-huakui',
  杜十娘: 'du-shiniang',
  衣冠风流: 'yiguan-fengliu',
  不破之城: 'bupo-zhicheng',
  江姐: 'jiang-jie',
  珍珠塔: 'zhenzhu-ta',
  中秋月: 'zhongqiu-yue',
  借妻: 'jie-qi',
  半把剪刀: 'banba-jiandao',
  典妻: 'dian-qi',
}

const operaTitles = Object.keys(operaSlugs).sort((a, b) => b.length - a.length)
const projectRoot = findDirectory(repoRoot, (name) => name.startsWith('2026'))
const textRoot = findDirectory(projectRoot, (name) => name.includes('7月') && name.includes('文本'))
const videoRoot = findDirectory(projectRoot, (name) => name.includes('7月份') && name.includes('视频'))
const imageRoot = findDirectory(projectRoot, (name) => name.includes('新增照片'))
const workbookPath = path.join(repoRoot, '7月份新增分类.xlsx')

function findDirectory(root, predicate) {
  if (!root || !fs.existsSync(root)) return ''
  const entry = fs.readdirSync(root, { withFileTypes: true })
    .find((item) => item.isDirectory() && predicate(item.name))
  return entry ? path.join(root, entry.name) : ''
}

function walkFiles(root) {
  if (!root || !fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name)
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath]
  })
}

function normalizeFileKey(value) {
  return path.basename(String(value || ''))
    .normalize('NFKC')
    .replace(/\.(?:jpe?g|png|webp|avif|mp4|mov|m4v)$/i, '')
    .replace(/mp4$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase()
}

function normalizeText(value) {
  return String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '')
}

function findOperaTitle(value) {
  const normalized = normalizeText(value)
  return operaTitles.find((title) => normalized.includes(normalizeText(title))) || ''
}

function findIndexedFile(indexName, files) {
  const key = normalizeFileKey(indexName)
  return files.find((file) => normalizeFileKey(file) === key)
    || files.find((file) => normalizeFileKey(file).includes(key) || key.includes(normalizeFileKey(file)))
}

function safeFileName(value) {
  return String(value)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function publicRelativePath(fullPath) {
  return path.relative(publicRoot, fullPath).split(path.sep).join('/')
}

function hashedOutputPath(sourcePath, destinationDir, extension = path.extname(sourcePath)) {
  const relativeSource = path.relative(projectRoot, sourcePath)
  const hash = createHash('sha1').update(relativeSource).digest('hex').slice(0, 10)
  const baseName = safeFileName(path.parse(sourcePath).name) || 'asset'
  return path.join(destinationDir, `${baseName}-${hash}${extension}`)
}

function copyFile(sourcePath, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true })
  const destinationPath = hashedOutputPath(sourcePath, destinationDir)
  if (!fs.existsSync(destinationPath) || fs.statSync(destinationPath).size !== fs.statSync(sourcePath).size) {
    fs.copyFileSync(sourcePath, destinationPath)
  }
  return publicRelativePath(destinationPath)
}

function linkVideo(sourcePath, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true })
  const destinationPath = hashedOutputPath(sourcePath, destinationDir, '.mp4')
  if (!fs.existsSync(destinationPath) || fs.statSync(destinationPath).size !== fs.statSync(sourcePath).size) {
    fs.rmSync(destinationPath, { force: true })
    try {
      fs.linkSync(sourcePath, destinationPath)
    } catch {
      fs.copyFileSync(sourcePath, destinationPath)
    }
  }
  return publicRelativePath(destinationPath)
}

function createPoster(sourcePath, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true })
  const destinationPath = hashedOutputPath(sourcePath, destinationDir, '.jpg')
  if (!fs.existsSync(destinationPath)) {
    execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', sourcePath,
      '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', destinationPath,
    ])
  }
  return publicRelativePath(destinationPath)
}

function readDuration(sourcePath) {
  try {
    const seconds = Number(execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', sourcePath,
    ], { encoding: 'utf8' }).trim())
    if (!Number.isFinite(seconds)) return ''
    const rounded = Math.max(0, Math.round(seconds))
    return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function writeText(relativePath, value) {
  const fullPath = path.join(publicRoot, relativePath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, `${String(value || '').trim()}\n`, 'utf8')
  return relativePath
}

function isLabel(line, label) {
  return new RegExp(`^${label}[：:]?$`).test(line)
}

function stripSectionHeading(lines, operaTitle) {
  const result = [...lines]
  if (result[0] && normalizeText(result[0]) === normalizeText(`${operaTitle}文本`)) result.shift()
  return result
}

function parseContentAndKnowledge(lines, operaTitle) {
  const contentIndex = lines.findIndex((line) => isLabel(line, '内容'))
  const knowledgeIndex = lines.findIndex((line, index) => index > contentIndex && isLabel(line, '知识'))
  const sourceIndex = lines.findIndex((line) => /^(统一)?资料来源[：:]?$/.test(line))
  const effectiveEnd = sourceIndex >= 0 ? sourceIndex : lines.length
  const contentLines = contentIndex >= 0
    ? stripSectionHeading(lines.slice(contentIndex + 1, knowledgeIndex >= 0 ? knowledgeIndex : effectiveEnd), operaTitle)
    : []
  const knowledgeLines = knowledgeIndex >= 0 ? lines.slice(knowledgeIndex + 1, effectiveEnd) : []
  const knowledgeTitle = knowledgeLines[0] && knowledgeLines[0].length <= 32 ? knowledgeLines.shift() : ''
  const sources = sourceIndex >= 0 ? lines.slice(sourceIndex) : []
  return { contentLines, knowledgeTitle, knowledgeLines, sources }
}

function parseOperaBlock(genre, title, lines) {
  const segmentStarts = []
  lines.forEach((line, index) => {
    const match = line.match(/^《([^》]+)》$/)
    if (match && match[1].includes('·') && match[1].startsWith(title)) {
      segmentStarts.push({ index, fullTitle: match[1], name: match[1].split('·').slice(1).join('·') })
    }
  })

  const mainEnd = segmentStarts[0]?.index ?? lines.length
  const main = parseContentAndKnowledge(lines.slice(0, mainEnd), title)
  const segments = segmentStarts.map((segment, index) => {
    const end = segmentStarts[index + 1]?.index ?? lines.length
    return {
      ...segment,
      ...parseContentAndKnowledge(lines.slice(segment.index + 1, end), title),
    }
  })

  const contentDetails = [main.contentLines.join('\n')]
  const knowledgeDetails = [main.knowledgeLines.join('\n')]
  for (const segment of segments) {
    contentDetails.push(`【${segment.name}】\n${segment.contentLines.join('\n')}`)
    knowledgeDetails.push(`【${segment.name}】\n${segment.knowledgeLines.join('\n')}`)
  }
  const sources = [...main.sources, ...segments.flatMap((segment) => segment.sources)]
  if (sources.length) knowledgeDetails.push(sources.join('\n'))

  return {
    genre,
    title,
    content: main.contentLines[0] || '',
    contentDetail: contentDetails.filter(Boolean).join('\n\n'),
    knowledgeTitle: main.knowledgeTitle || '剧种、行当、典故与板式',
    knowledge: main.knowledgeLines.join('\n'),
    knowledgeDetail: knowledgeDetails.filter(Boolean).join('\n\n'),
    segments,
  }
}

async function readOperasFromDocx(masterDocumentPath) {
  const { value } = await mammoth.extractRawText({ path: masterDocumentPath })
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const headings = []
  lines.forEach((line, index) => {
    const match = line.match(/^(沪剧|淮剧|扬剧|锡剧|甬剧)《([^》]+)》(?:（又名《[^》]+》）)?$/)
    if (match && operaSlugs[match[2]]) headings.push({ index, genre: match[1], title: match[2] })
  })
  return headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? lines.length
    return parseOperaBlock(heading.genre, heading.title, lines.slice(heading.index + 1, end))
  })
}

function segmentSimilarity(left, right) {
  const leftChars = new Set(normalizeText(left).replace(/\d+$/g, ''))
  const rightChars = new Set(normalizeText(right).replace(/\d+$/g, ''))
  if (!leftChars.size || !rightChars.size) return 0
  const intersection = [...leftChars].filter((character) => rightChars.has(character)).length
  return intersection / Math.max(leftChars.size, rightChars.size)
}

function findSegment(opera, videoTitle) {
  const key = normalizeText(videoTitle).replace(/\d+$/g, '')
  const direct = opera.segments.find((segment) => {
    const segmentKey = normalizeText(segment.name)
    return segmentKey.includes(key) || key.includes(segmentKey)
  })
  if (direct) return direct
  return [...opera.segments]
    .map((segment) => ({ segment, score: segmentSimilarity(segment.name, videoTitle) }))
    .sort((a, b) => b.score - a.score)[0]?.score >= 0.55
    ? [...opera.segments]
      .map((segment) => ({ segment, score: segmentSimilarity(segment.name, videoTitle) }))
      .sort((a, b) => b.score - a.score)[0].segment
    : null
}

function readWorkbookRows() {
  const workbook = XLSX.readFile(workbookPath)
  const byKeyword = (keyword) => {
    const sheetName = workbook.SheetNames.find((name) => name.includes(keyword))
    if (!sheetName) throw new Error(`Workbook sheet not found: ${keyword}`)
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
  }
  return {
    imageRows: byKeyword('图片'),
    videoRows: byKeyword('视频'),
    textRows: byKeyword('文本'),
  }
}

function buildIndexedMedia(rows, files, columnName) {
  return rows.map((row) => {
    const indexedName = row[columnName]
    const sourcePath = findIndexedFile(indexedName, files)
    const operaTitle = findOperaTitle(indexedName)
    return sourcePath && operaTitle ? { row, indexedName, sourcePath, operaTitle } : null
  }).filter(Boolean)
}

function cleanAssetTitle(fileName, operaTitle) {
  return path.parse(fileName).name
    .normalize('NFKC')
    .replace(/^(沪剧|淮剧|扬剧|锡剧|甬剧|扬剧电影|盐城市淮剧团)/, '')
    .replace(new RegExp(`《${operaTitle}》`), '')
    .replace(/^[-—·\s]+|[-—·\s]+$/g, '') || `${operaTitle}剧照`
}

function toTime(value) {
  return new Date(`1970-01-01T${value}:00.000Z`)
}

async function importOpera(opera, index, images, videos, masterDocumentPath) {
  const slug = operaSlugs[opera.title]
  const basePath = `opera-materials/${slug}`
  const destinationRoot = path.join(outputRoot, slug)
  const operaImages = images.filter((item) => item.operaTitle === opera.title)
  const operaVideos = videos.filter((item) => item.operaTitle === opera.title)
  const copiedImages = operaImages.map((item) => ({
    ...item,
    imagePath: copyFile(item.sourcePath, path.join(destinationRoot, 'objects')),
  }))

  const videoAssets = operaVideos.map((item, videoIndex) => {
    const rawName = path.parse(item.sourcePath).name
    const suffix = rawName.slice(rawName.indexOf(opera.title) + opera.title.length).replace(/^[-—·\s]+/, '')
    const title = suffix || `唱段 ${videoIndex + 1}`
    const segment = findSegment(opera, title)
    const mediaPath = linkVideo(item.sourcePath, path.join(destinationRoot, 'chants'))
    const imagePath = createPoster(item.sourcePath, path.join(destinationRoot, 'posters'))
    const textPath = `${basePath}/texts/chants/${String(videoIndex + 1).padStart(2, '0')}-${safeFileName(title)}.txt`
    const chantText = segment
      ? [`《${opera.title}·${segment.name}》`, ...segment.contentLines, '', '知识', ...segment.knowledgeLines].join('\n')
      : opera.contentDetail
    writeText(textPath, chantText)
    return {
      operaId: 0,
      assetType: 'chant',
      title,
      imagePath,
      mediaPath,
      textPath,
      duration: readDuration(item.sourcePath),
      sourceRelativePath: path.relative(projectRoot, item.sourcePath).split(path.sep).join('/'),
      sortOrder: videoIndex + 1,
    }
  })

  const coverPath = copiedImages[0]?.imagePath || videoAssets[0]?.imagePath || ''
  if (!coverPath) throw new Error(`No cover or video found for ${opera.title}`)

  const contentPath = writeText(`${basePath}/texts/content.txt`, opera.content)
  const contentDetailPath = writeText(`${basePath}/texts/content-detail.txt`, opera.contentDetail)
  const knowledgePath = writeText(`${basePath}/texts/knowledge.txt`, opera.knowledge)
  const knowledgeDetailPath = writeText(`${basePath}/texts/knowledge-detail.txt`, opera.knowledgeDetail)
  const startMinutes = 14 * 60 + 30 + ((index * 35) % 360)
  const startTime = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`
  const sourceDocumentPath = path.relative(repoRoot, masterDocumentPath).split(path.sep).join('/')
  const existing = await prisma.opera.findFirst({ where: { title: opera.title } })
  const data = {
    genre: opera.genre,
    coverPath,
    summary: opera.content,
    venue: `${opera.genre}资料馆`,
    startTime: toTime(startTime),
    contentPath,
    contentDetailPath,
    knowledgeTitle: opera.knowledgeTitle,
    knowledgePath,
    knowledgeDetailPath,
    sourceDocumentPath,
    isDailyCandidate: true,
    status: 'published',
    sortOrder: 200 + index,
  }
  const saved = existing
    ? await prisma.opera.update({ where: { id: existing.id }, data })
    : await prisma.opera.create({ data: { title: opera.title, ...data } })

  await prisma.operaAsset.deleteMany({ where: { operaId: saved.id } })
  const objectAssets = copiedImages.map((item, objectIndex) => ({
    operaId: saved.id,
    assetType: 'object',
    title: cleanAssetTitle(item.indexedName, opera.title),
    imagePath: item.imagePath,
    sourceRelativePath: path.relative(projectRoot, item.sourcePath).split(path.sep).join('/'),
    sortOrder: objectIndex + 1,
  }))
  const assets = [
    ...videoAssets.map((asset) => ({ ...asset, operaId: saved.id })),
    ...objectAssets,
  ]
  if (assets.length) await prisma.operaAsset.createMany({ data: assets })

  return {
    id: saved.id,
    title: saved.title,
    genre: saved.genre,
    videos: videoAssets.length,
    images: objectAssets.length,
    coverPath,
  }
}

async function main() {
  for (const [label, value] of Object.entries({ projectRoot, textRoot, videoRoot, imageRoot, workbookPath })) {
    if (!value || !fs.existsSync(value)) throw new Error(`${label} not found: ${value}`)
  }

  const masterDocumentPath = walkFiles(textRoot)
    .filter((file) => file.toLowerCase().endsWith('.docx'))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]
  const operas = await readOperasFromDocx(masterDocumentPath)
  const { imageRows, videoRows, textRows } = readWorkbookRows()
  const imageFiles = walkFiles(imageRoot).filter((file) => /\.(?:jpe?g|png|webp|avif)$/i.test(file))
  const videoFiles = walkFiles(videoRoot).filter((file) => /\.mp4$/i.test(file))
  const images = buildIndexedMedia(imageRows, imageFiles, '文件名')
  const videos = buildIndexedMedia(videoRows, videoFiles, '资料名称')

  const textOperaCount = new Set(textRows.map((row) => findOperaTitle(row['资料名称'])).filter(Boolean)).size
  if (operas.length !== 15 || textOperaCount !== 15) {
    throw new Error(`Expected 15 operas, parsed ${operas.length} from DOCX and ${textOperaCount} from workbook`)
  }
  if (videos.length !== videoRows.length) {
    const missing = videoRows.filter((row) => !findIndexedFile(row['资料名称'], videoFiles)).map((row) => row['资料名称'])
    throw new Error(`Missing videos: ${missing.join(', ')}`)
  }

  const imported = []
  for (const [index, opera] of operas.entries()) {
    imported.push(await importOpera(opera, index, images, videos, masterDocumentPath))
    console.log(`[${index + 1}/${operas.length}] ${opera.genre}《${opera.title}》 imported`)
  }

  console.log(JSON.stringify({
    imported,
    source: {
      document: path.relative(repoRoot, masterDocumentPath),
      workbook: path.relative(repoRoot, workbookPath),
      indexedImages: images.length,
      indexedVideos: videos.length,
    },
  }, null, 2))
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
