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

export async function getTodayOpenings() {
  const data = await apiGet<{ items: OpeningItem[] }>('/api/home/today-openings')
  return data.items
}
