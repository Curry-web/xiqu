import 'dotenv/config'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import xlsx from 'xlsx'

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(serverRoot, '..')
const workbookPath = fs.readdirSync(repoRoot)
  .find((name) => name.toLowerCase().endsWith('.xlsx') && !name.startsWith('~$'))
const projectFolder = fs.readdirSync(repoRoot, { withFileTypes: true })
  .find((entry) => entry.isDirectory() && entry.name.startsWith('2026'))?.name
const photoFolder = projectFolder
  ? findDirectory(path.join(repoRoot, projectFolder), (name) => name.includes('\u7167\u7247'))
  : ''
const publicRoot = path.join(serverRoot, 'public', 'liyuan-materials')

const prisma = new PrismaClient()

const colorMap = new Map([
  ['\u9ed1', 'black'],
  ['\u84dd', 'blue'],
  ['\u9752', 'green'],
  ['\u7eff', 'green'],
  ['\u7d2b', 'purple'],
  ['\u7ea2', 'red'],
  ['\u767d', 'white'],
  ['\u9ec4', 'yellow'],
])

function findDirectory(root, predicate) {
  if (!fs.existsSync(root)) return ''
  const entry = fs.readdirSync(root, { withFileTypes: true }).find((item) => item.isDirectory() && predicate(item.name))
  return entry ? path.join(root, entry.name) : ''
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/[\uff08(].*?[\uff09)]/g, '')
    .replace(/[()\uff08\uff09]/g, '')
    .replace(/\s+/g, '')
    .replace(/[\u300a\u300b]/g, '')
    .toLowerCase()
}

function titleFromFileName(fileName) {
  return normalizeName(path.parse(String(fileName || '').trim()).name) || String(fileName || '').trim()
}

function walkFiles(root) {
  const files = []
  if (!fs.existsSync(root)) return files

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(fullPath))
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function buildFileIndex(files) {
  const index = new Map()
  for (const filePath of files) {
    const base = path.basename(filePath)
    const keys = new Set([base, normalizeName(base), normalizeName(path.parse(base).name)])
    for (const key of keys) {
      if (!key) continue
      if (!index.has(key)) index.set(key, [])
      index.get(key).push(filePath)
    }
  }
  return index
}

function findSourceFile(index, fileName) {
  const raw = String(fileName || '').trim()
  const candidates = [raw, normalizeName(raw), normalizeName(path.parse(raw).name)].filter(Boolean)

  for (const candidate of candidates) {
    const matches = index.get(candidate)
    if (matches?.length) return matches[0]
  }
  return ''
}

function rowValues(row) {
  const values = Object.values(row)
  return {
    fileName: String(values[0] || '').trim(),
    primaryCategory: String(values[1] || '').trim(),
    secondaryCategory: String(values[2] || '').trim(),
    tertiaryCategory: String(values[3] || '').trim(),
    colorName: String(values[4] || '').trim(),
  }
}

function readRows(workbook, sheetIndex) {
  const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]]
  return xlsx.utils.sheet_to_json(sheet, { defval: '' }).map(rowValues)
}

function toMaterialRows(workbook) {
  const peopleRows = readRows(workbook, 4)
    .filter((row) => row.fileName && row.colorName)
    .map((source) => ({ category: 'performer', source }))

  const costumeRows = readRows(workbook, 5)
    .filter((row) => row.fileName && row.colorName && row.secondaryCategory.includes('\u670d\u9970\u7c7b'))
    .map((source) => ({ category: 'costume', source }))

  return [...peopleRows, ...costumeRows]
}

function copyToPublic(sourceFile, material) {
  const ext = path.extname(sourceFile) || '.jpg'
  const safeTitle = titleFromFileName(material.source.fileName).replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 72)
  const fileHash = createHash('sha1').update(sourceFile).digest('hex').slice(0, 10)
  const outputDir = path.join(publicRoot, material.category, material.colorCode)
  const outputFile = `${safeTitle || 'material'}-${fileHash}${ext}`
  const outputPath = path.join(outputDir, outputFile)

  fs.mkdirSync(outputDir, { recursive: true })
  fs.copyFileSync(sourceFile, outputPath)
  return path.relative(path.join(serverRoot, 'public'), outputPath).split(path.sep).join('/')
}

async function main() {
  if (!workbookPath) throw new Error('No xlsx file found in repository root')
  if (!projectFolder || !photoFolder) throw new Error('Project photo folder not found')

  const workbook = xlsx.readFile(path.join(repoRoot, workbookPath))
  const sourceFiles = walkFiles(photoFolder)
  const fileIndex = buildFileIndex(sourceFiles)
  const rows = toMaterialRows(workbook)
  const imported = []
  const missing = []

  fs.rmSync(publicRoot, { recursive: true, force: true })
  await prisma.liyuanMaterial.deleteMany()

  for (const row of rows) {
    const { source } = row
    const colorCode = colorMap.get(source.colorName)
    if (!colorCode) {
      missing.push({ fileName: source.fileName, reason: `unsupported color: ${source.colorName}` })
      continue
    }

    const sourceFile = findSourceFile(fileIndex, source.fileName)
    if (!sourceFile) {
      missing.push({ fileName: source.fileName, reason: 'source file not found' })
      continue
    }

    const imagePath = copyToPublic(sourceFile, { category: row.category, colorCode, source })
    imported.push({
      category: row.category,
      colorName: source.colorName,
      colorCode,
      title: titleFromFileName(source.fileName),
      imagePath,
      sourceFileName: source.fileName,
      sourceRelativePath: path.relative(photoFolder, sourceFile).split(path.sep).join('/'),
      primaryCategory: source.primaryCategory,
      secondaryCategory: source.secondaryCategory,
      tertiaryCategory: source.tertiaryCategory,
      weight: 1,
      status: 'published',
    })
  }

  const uniqueImported = [...new Map(imported.map((item) => [item.imagePath, item])).values()]
  await prisma.liyuanMaterial.createMany({ data: uniqueImported })
  console.log(JSON.stringify({
    imported: uniqueImported.length,
    missingCount: missing.length,
    missing,
    byColor: uniqueImported.reduce((acc, item) => {
      const key = `${item.category}:${item.colorCode}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {}),
  }, null, 2))
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
