<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { askAgent, type AgentChatMessage, type AgentSource } from '../api/agent'
import navMaskUrl from '../assets/nav/nav-mask.png'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: AgentSource[]
}

const messages = ref<ChatMessage[]>([
  {
    id: 1,
    role: 'assistant',
    content: '我是曲小知，可以帮你查戏曲知识、剧目资料、唱词典故和相关图片来源。你可以问：昆曲是什么？牡丹亭讲了什么？',
  },
])
const quickReplies = ref(['昆曲是什么？', '京剧和昆曲有什么区别？', '牡丹亭有哪些经典唱段？'])
const inputText = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const messageListRef = ref<HTMLElement | null>(null)

const history = computed<AgentChatMessage[]>(() =>
  messages.value
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    })),
)

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

async function sendQuestion(question = inputText.value) {
  const trimmed = question.trim()
  if (!trimmed || isLoading.value) return

  errorMessage.value = ''
  inputText.value = ''
  messages.value.push({
    id: Date.now(),
    role: 'user',
    content: trimmed,
  })
  scrollToBottom()

  isLoading.value = true
  try {
    const response = await askAgent(trimmed, history.value)
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: response.answer || '我查到了资料，但接口没有返回文字答案。',
      sources: response.sources || [],
    })

    if (response.relatedQuestions?.length) {
      quickReplies.value = response.relatedQuestions.slice(0, 3)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '曲小知暂时没有连上，请稍后再试。'
    messages.value.push({
      id: Date.now() + 2,
      role: 'assistant',
      content: errorMessage.value,
    })
  } finally {
    isLoading.value = false
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
            <p>戏曲 AI 智能体</p>
          </div>
        </div>
      </header>

      <section class="agent-chat-panel" aria-label="聊天内容">
        <div ref="messageListRef" class="agent-chat-messages">
          <article
            v-for="message in messages"
            :key="message.id"
            :class="['chat-bubble', message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant']"
          >
            <p class="chat-content">{{ message.content }}</p>

            <details v-if="message.sources?.length" class="answer-sources">
              <summary>参考资料 · {{ message.sources.length }}</summary>
              <ul>
                <li v-for="source in message.sources" :key="source.path || source.title">
                  <a v-if="source.sourceUrls?.[0]" :href="source.sourceUrls[0]" target="_blank" rel="noreferrer">
                    {{ source.title || source.path || '查看资料' }}
                  </a>
                  <span v-else>{{ source.title || source.path || '资料来源' }}</span>
                </li>
              </ul>
            </details>
          </article>

          <p v-if="isLoading" class="chat-loading">曲小知正在查资料...</p>

          <div class="chat-quick-replies" aria-label="相关追问">
            <button v-for="reply in quickReplies" :key="reply" type="button" @click="sendQuestion(reply)">
              {{ reply }}
            </button>
          </div>
        </div>

        <form class="agent-chat-input" @submit.prevent="sendQuestion()">
          <label class="sr-only" for="agent-chat-message">输入问题</label>
          <input
            id="agent-chat-message"
            v-model="inputText"
            type="text"
            :disabled="isLoading"
            placeholder="快来和曲小知对话吧"
          />
          <button type="submit" :disabled="isLoading || !inputText.trim()" aria-label="发送消息">
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
    linear-gradient(180deg, rgb(202 66 72 / 0.94) 0, rgb(220 111 104 / 0.84) 44%, rgb(71 166 159 / 0.78) 100%),
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
  margin: 0 auto 0.8rem;
  color: #41a7a0;
  font-family: Inter, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: clamp(0.9rem, 3.9vw, 1.08rem);
  font-weight: 700;
  line-height: 1.55;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
}

.chat-content {
  margin: 0;
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
  padding: 0.92rem 1.05rem 0.88rem;
  border-radius: 1rem 1rem 1rem 0.18rem;
  background: rgb(255 255 255 / 0.98);
  box-shadow:
    0 0.45rem 0.9rem rgb(42 134 126 / 0.2),
    0 0 0.9rem rgb(61 183 172 / 0.32);
}

.chat-loading {
  margin: 0.6rem auto;
  color: #3a918b;
  font-family: Inter, "PingFang SC", sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: center;
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
  text-decoration: none;
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
  font-family: Inter, "PingFang SC", sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  box-shadow: 0 0.22rem 0.62rem rgb(61 151 143 / 0.12);
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
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
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

  .agent-chat-input {
    right: 1rem;
    left: 1rem;
    padding-left: 1.05rem;
  }
}
</style>
