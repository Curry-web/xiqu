import { apiGet } from './client'

export type OpeningItem = {
  id: number
  title: string
  venue: string
  startTime: string
  imagePath: string
  imageUrl: string
  description?: string
  featured?: boolean
}

export type LiyuanMaterialItem = {
  id: number
  category: 'performer' | 'costume'
  colorName: string
  colorCode: string
  title: string
  imagePath: string
  imageUrl: string
  sourceFileName: string
}

export async function getTodayOpenings() {
  const data = await apiGet<{ items: OpeningItem[] }>('/api/home/today-openings')
  return data.items
}

export async function getLiyuanMaterials(colorCode: string) {
  const query = new URLSearchParams({ colorCode })
  return apiGet<{
    colorCode: string
    requestedColorCode?: string
    availableColors?: string[]
    performers: LiyuanMaterialItem[]
    costumes: LiyuanMaterialItem[]
  }>(`/api/home/liyuan-materials?${query.toString()}`)
}
