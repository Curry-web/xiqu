<script setup lang="ts">
import { nextTick, ref } from 'vue'
import navMaskUrl from '../assets/nav/nav-mask.png'

type AgentSource = {
  title?: string
  path?: string
  sourceUrls?: string[]
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: AgentSource[]
}

const agentAskUrl =
  import.meta.env.VITE_AGENT_ASK_URL || 'https://lab.colourfuldawn.com/xiqu-agent-api/agent/ask'
const agentApiBaseUrl = agentAskUrl.replace(/\/ask\/?$/, '')
const inputText = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '我是曲小知，可以问我戏曲、京剧、昆曲、剧目、唱腔等问题。',
  },
])

const quickReplies = [
  '昆曲为什么被称为百戏之祖？',
  '京剧有哪些经典剧目？',
  '初学者先了解京剧还是昆曲？',
]

function scrollToBottom() {
  nextTick(() => {
    const container = messagesContainer.value
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  })
}

function normalizeSourceUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url
  if (url.startsWith('/api/agent/')) {
    return `${agentApiBaseUrl}${url.replace('/api/agent', '')}`
  }
  return new URL(url, agentAskUrl).toString()
}

function getSourceUrl(source: AgentSource) {
  const firstUrl = source.sourceUrls?.[0]
  if (firstUrl) return normalizeSourceUrl(firstUrl)
  if (source.path) {
    return `${agentApiBaseUrl}/source?path=${encodeURIComponent(source.path)}`
  }
  return ''
}

function getSourceLabel(source: AgentSource) {
  return source.title || source.path || '原始资料'
}

function toRequestMessages(nextUserMessage: ChatMessage) {
  return [...messages.value, nextUserMessage].map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

async function sendMessage(question = inputText.value) {
  const text = question.trim()
  if (!text || loading.value) return

  const userMessage: ChatMessage = { role: 'user', content: text }
  const requestMessages = toRequestMessages(userMessage)
  messages.value.push(userMessage)
  inputText.value = ''
  loading.value = true
  scrollToBottom()

  try {
    const response = await fetch(agentAskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: text,
        messages: requestMessages,
      }),
    })

    if (!response.ok) {
      throw new Error(response.status === 504 ? '曲小知回答超时，请稍后再试。' : `请求失败：${response.status}`)
    }

    const data = await response.json()
    messages.value.push({
      role: 'assistant',
      content: data.answer || '曲小知暂时没有找到合适答案。',
      sources: Array.isArray(data.sources) ? data.sources : [],
    })
  } catch (error) {
    console.error(error)
    messages.value.push({
      role: 'assistant',
      content: error instanceof Error ? error.message : '曲小知暂时连接不上，请稍后再试。',
    })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}
</script>

<template>
  <main class="agent-chat-page" aria-label="曲小知智能体聊天窗口">
    <section class="agent-chat-shell">
      <header class="agent-chat-hero">
        <div class="agent-chat-hero__profile">
          <img class="agent-chat-hero__avatar" :src="navMaskUrl" alt="曲小知头像" />
          <div>
            <h1>曲小知</h1>
            <p>戏曲AI智能体</p>
          </div>
        </div>
      </header>

      <section class="agent-chat-panel" aria-label="聊天内容">
        <div ref="messagesContainer" class="agent-chat-messages">
          <article
            v-for="(message, index) in messages"
            :key="`${message.role}-${index}`"
            :class="[
              'chat-bubble',
              message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant',
            ]"
          >
            <p class="chat-message-content">{{ message.content }}</p>

            <details v-if="message.role === 'assistant' && message.sources?.length" class="answer-sources">
              <summary>参考资料 · {{ message.sources.length }}</summary>
              <ul>
                <li v-for="source in message.sources" :key="source.path || source.title">
                  <a v-if="getSourceUrl(source)" :href="getSourceUrl(source)" target="_blank" rel="noopener noreferrer">
                    {{ getSourceLabel(source) }}
                  </a>
                  <span v-else>{{ getSourceLabel(source) }}</span>
                </li>
              </ul>
            </details>
          </article>

          <div class="chat-quick-replies" aria-label="相关追问">
            <button
              v-for="reply in quickReplies"
              :key="reply"
              type="button"
              :disabled="loading"
              @click="sendMessage(reply)"
            >
              {{ reply }}
            </button>
          </div>
        </div>

        <form class="agent-chat-input" @submit.prevent="sendMessage()">
          <label class="sr-only" for="agent-chat-message">输入问题</label>
          <input
            id="agent-chat-message"
            v-model="inputText"
            type="text"
            :disabled="loading"
            :placeholder="loading ? '曲小知思考中…' : '快来和曲小知对话吧'"
          />
          <button type="submit" :disabled="loading || !inputText.trim()" aria-label="发送消息">
            <span aria-hidden="true" />
          </button>
        </form>
      </section>
    </section>
  </main>
</template>

<style scoped>
.agent-chat-page {
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  color: #2d6865;
  background:
    var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat,
    var(--xiqu-app-bg-color);
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.agent-chat-shell {
  position: relative;
  height: 100vh;
  height: 100svh;
  max-width: 30rem;
  margin: 0 auto;
  overflow: hidden;
  background:
    var(--xiqu-app-bg-image) center top / 30rem auto repeat,
    #f7edcf;
  box-shadow: 0 0 2rem rgb(51 32 24 / 0.08);
}

.agent-chat-shell::before {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background:
    radial-gradient(circle at 16% 9%, rgb(255 244 217 / 0.24), transparent 13rem),
    radial-gradient(circle at 88% 3%, rgb(255 255 255 / 0.16), transparent 10rem);
  mix-blend-mode: screen;
}

.agent-chat-hero {
  position: relative;
  z-index: 1;
  min-height: 15.1rem;
  padding: clamp(3.2rem, 11vw, 4.45rem) 2.9rem 4.1rem;
  background:
    linear-gradient(
      180deg,
      rgb(202 66 72 / 0.94) 0,
      rgb(220 111 104 / 0.84) 44%,
      rgb(71 166 159 / 0.78) 100%
    ),
    var(--xiqu-app-bg-image) center top / 30rem auto repeat;
}

.agent-chat-hero__profile {
  display: flex;
  align-items: center;
  gap: 1.15rem;
}

.agent-chat-hero__avatar {
  width: clamp(4.8rem, 18vw, 6.05rem);
  height: clamp(4.8rem, 18vw, 6.05rem);
  object-fit: contain;
  border-radius: 999px;
  background: #1e625f;
  box-shadow: 0 0.18rem 0.55rem rgb(40 31 27 / 0.16);
}

.agent-chat-hero h1 {
  margin: 0;
  color: #fffdf2;
  font-size: clamp(2.2rem, 11.2vw, 3.45rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.18em;
  text-shadow: 0 0.12rem 0.25rem rgb(82 48 43 / 0.16);
}

.agent-chat-hero p {
  margin: 0.78rem 0 0;
  color: rgb(255 253 242 / 0.86);
  font-size: clamp(1.1rem, 5.5vw, 1.62rem);
  font-weight: 700;
  letter-spacing: 0.13em;
}

.agent-chat-panel {
  position: relative;
  z-index: 2;
  display: flex;
  height: calc(100svh - 12.25rem);
  min-height: 0;
  flex-direction: column;
  margin: -2.35rem 0 0;
  padding: clamp(2.4rem, 9vw, 3.35rem) 1.25rem 6.7rem;
  overflow: hidden;
  border-radius: 2.2rem 2.2rem 0 0;
  background:
    linear-gradient(180deg, rgb(255 248 221 / 0.95), rgb(255 248 221 / 0.9)),
    var(--xiqu-app-bg-image) center top / 30rem auto repeat;
}

.agent-chat-messages {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 5.4rem;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.agent-chat-messages::-webkit-scrollbar {
  display: none;
}

.chat-bubble {
  margin: 0 auto;
  color: #41a7a0;
  font-family: inherit;
  font-size: clamp(0.9rem, 3.9vw, 1.08rem);
  font-weight: 700;
  line-height: 1.55;
  letter-spacing: 0.02em;
}

.chat-bubble p {
  margin: 0;
}

.chat-bubble p + p {
  margin-top: 0.24rem;
}

.chat-message-content {
  white-space: pre-wrap;
}

.chat-bubble--user {
  width: fit-content;
  max-width: 78%;
  margin-right: 0;
  padding: 0.68rem 0.88rem;
  color: #fff8df;
  background: #43aaa3;
  border-radius: 1rem 1rem 0.18rem;
  box-shadow: 0 0.28rem 0.7rem rgb(38 111 106 / 0.16);
}

.chat-bubble--assistant {
  width: calc(100% - 1.35rem);
  max-width: 23rem;
  margin-top: 0.8rem;
  padding: 0.92rem 1.05rem 0.88rem;
  border-radius: 1rem 1rem 1rem 0.18rem;
  background: rgb(255 255 255 / 0.98);
  box-shadow:
    0 0.45rem 0.9rem rgb(42 134 126 / 0.2),
    0 0 0.9rem rgb(61 183 172 / 0.32);
}

.answer-lead {
  color: #2f8f89;
}

.answer-section {
  margin-top: 0.58rem;
}

.answer-section h2 {
  margin: 0 0 0.12rem;
  color: #1f706c;
  font-size: 0.9em;
  font-weight: 800;
}

.answer-section p,
.answer-summary {
  color: #3c8f89;
  font-weight: 600;
}

.answer-summary {
  margin-top: 0.7rem;
}

.answer-sources {
  margin-top: 0.72rem;
  padding-top: 0.62rem;
  border-top: 1px solid rgb(67 170 163 / 0.18);
  color: #557f7c;
  font-size: 0.78rem;
  font-weight: 600;
}

.answer-sources summary {
  width: fit-content;
  color: #2f8f89;
  cursor: pointer;
}

.answer-sources ul {
  display: grid;
  gap: 0.28rem;
  padding-left: 1.05rem;
  margin: 0.48rem 0 0;
}

.answer-sources a {
  color: #2f8f89;
  text-decoration: underline;
  text-underline-offset: 0.18rem;
}

.chat-quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.chat-quick-replies button {
  padding: 0.44rem 0.72rem;
  color: #348f89;
  background: rgb(255 255 255 / 0.58);
  border: 1px solid rgb(65 167 160 / 0.3);
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  box-shadow: 0 0.22rem 0.62rem rgb(61 151 143 / 0.12);
}

.chat-quick-replies button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.agent-chat-input {
  position: absolute;
  right: 1.38rem;
  bottom: 5.9rem;
  left: 1.38rem;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
  align-items: center;
  min-height: 3.05rem;
  padding: 0.36rem 0.48rem 0.36rem 1rem;
  border-radius: 1.15rem;
  background: rgb(255 255 255 / 0.98);
  box-shadow: 0 0.35rem 0.85rem rgb(68 43 25 / 0.08);
}

.agent-chat-input input {
  min-width: 0;
  color: #3da59e;
  background: transparent;
  border: 0;
  outline: 0;
  font-family: inherit;
  font-size: clamp(1.05rem, 4.9vw, 1.45rem);
  letter-spacing: 0.08em;
}

.agent-chat-input input::placeholder {
  color: #42aaa3;
  opacity: 0.94;
}

.agent-chat-input button {
  position: relative;
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: #42aaa3;
  box-shadow: 0 0.18rem 0.42rem rgb(42 134 126 / 0.18);
}

.agent-chat-input button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.agent-chat-input button span {
  position: relative;
  width: 0.38rem;
  height: 1.18rem;
  border-radius: 999px;
  background: #fffdf2;
}

.agent-chat-input button span::before,
.agent-chat-input button span::after {
  position: absolute;
  top: -0.06rem;
  width: 0.38rem;
  height: 0.95rem;
  content: "";
  border-radius: 999px;
  background: #fffdf2;
  transform-origin: 50% 0.18rem;
}

.agent-chat-input button span::before {
  left: 0;
  transform: rotate(43deg);
}

.agent-chat-input button span::after {
  right: 0;
  transform: rotate(-43deg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 360px) {
  .agent-chat-hero {
    padding-right: 2rem;
    padding-left: 2rem;
  }

  .agent-chat-panel {
    border-radius: 2.2rem 2.2rem 0 0;
  }

  .agent-chat-input {
    right: 1rem;
    left: 1rem;
    padding-left: 1.05rem;
  }
}
</style>
