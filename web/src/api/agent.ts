import { apiPost } from './client'

export interface AgentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentSource {
  title?: string
  path?: string
  snippet?: string
  sourceUrls?: string[]
}

export interface AgentAskResponse {
  answer: string
  sources?: AgentSource[]
  relatedQuestions?: string[]
}

export function askAgent(question: string, history: AgentChatMessage[] = []) {
  return apiPost<AgentAskResponse>('/api/agent/ask', {
    sessionId: 'xiqu-web-user',
    question,
    history,
  })
}
