import { apiGet, apiPost } from './client'

export type FavoriteSectionType = 'content' | 'knowledge' | 'chant'

export type OperaFavorite = {
  id: number
  assetId?: number
  operaId: number
  sectionType: FavoriteSectionType
  title: string
  operaTitle: string
  genre: string
  coverUrl: string
  mediaUrl?: string
  duration?: string
  summary: string
  createdAt: string
}

export async function getFavorites(filters: { operaId?: number; sectionType?: FavoriteSectionType } = {}) {
  const search = new URLSearchParams()
  if (filters.operaId) search.set('operaId', String(filters.operaId))
  if (filters.sectionType) search.set('sectionType', filters.sectionType)
  const suffix = search.size ? `?${search.toString()}` : ''
  const data = await apiGet<{ items: OperaFavorite[] }>(`/api/favorites${suffix}`)
  return data.items
}

export async function setFavorite(operaId: number, sectionType: FavoriteSectionType, favorited: boolean) {
  return apiPost<{ favorited: boolean; item?: OperaFavorite }>('/api/favorites', {
    operaId,
    sectionType,
    favorited,
  })
}

export async function setChantFavorite(operaId: number, assetId: number, favorited: boolean) {
  return apiPost<{ favorited: boolean; item?: OperaFavorite }>('/api/favorites', {
    operaId,
    assetId,
    sectionType: 'chant',
    favorited,
  })
}
