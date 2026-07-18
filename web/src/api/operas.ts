import { apiGet } from './client'

export type OperaAsset = {
  id: number
  type: 'chant' | 'object'
  title: string
  imagePath: string
  imageUrl: string
  mediaPath: string
  mediaUrl: string
  textPath: string
  duration: string
}

export type OperaListItem = {
  id: number
  title: string
  genre: string
  coverPath: string | null
  coverUrl: string
  summary: string
  venue: string
  startTime: string
}

export type OperaDetail = {
  id: number
  title: string
  genre: string
  coverPath: string | null
  coverUrl: string
  summary: string
  venue: string
  startTime: string
  content: string
  contentPath: string
  contentDetail: string
  contentDetailPath: string
  knowledgeTitle: string
  knowledge: string
  knowledgePath: string
  knowledgeDetail: string
  knowledgeDetailPath: string
  sourceDocumentPath: string
  chants: OperaAsset[]
  objects: OperaAsset[]
}

export async function getOperaDetail(id: number) {
  const data = await apiGet<{ item: OperaDetail }>(`/api/operas/${id}`)
  return data.item
}

export async function searchOperas(query = '') {
  const search = new URLSearchParams({ dailyOnly: 'true' })
  if (query.trim()) search.set('q', query.trim())
  const data = await apiGet<{ items: OperaListItem[] }>(`/api/operas?${search.toString()}`)
  return data.items
}
