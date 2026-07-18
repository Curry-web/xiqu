import { apiGet } from './client'

export type PracticeRepertoire = {
  id: string
  operaId: number | null
  referenceId: string
  title: string
  genre: string
  coverUrl: string
  practiceCount: number
  bestScore: number
  latestPracticedAt: string
}

export async function getPracticeRepertoire() {
  const data = await apiGet<{ items: PracticeRepertoire[] }>('/api/practice/repertoire')
  return data.items
}
