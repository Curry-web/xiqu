<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { showToast } from 'vant'

interface ScoreResult {
  id: number
  fileUrl: string
  refText: string
  totalScore: number
  accuracyScore: number
  fluencyScore: number
  completionScore: number
  feedback: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8788'

const refText = ref('海岛冰轮初转腾')
const title = ref('贵妃醉酒练唱')
const isRecording = ref(false)
const isSubmitting = ref(false)
const elapsedSeconds = ref(0)
const audioBlob = ref<Blob | null>(null)
const audioUrl = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileUrl = ref('')
const scoreResult = ref<ScoreResult | null>(null)

let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let timerId = 0
let chunks: BlobPart[] = []

const recordingLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
  const seconds = elapsedSeconds.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

function releasePreviewUrl() {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }

  if (selectedFileUrl.value) {
    URL.revokeObjectURL(selectedFileUrl.value)
    selectedFileUrl.value = ''
  }
}

function stopTimer() {
  window.clearInterval(timerId)
  timerId = 0
}

function stopMediaTracks() {
  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('当前浏览器不支持录音')
    return
  }

  try {
    releasePreviewUrl()
    scoreResult.value = null
    audioBlob.value = null
    selectedFile.value = null
    elapsedSeconds.value = 0
    chunks = []

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
    mediaRecorder = new MediaRecorder(mediaStream, preferredMime ? { mimeType: preferredMime } : undefined)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const type = mediaRecorder?.mimeType || 'audio/webm'
      const blob = new Blob(chunks, { type })
      audioBlob.value = blob
      audioUrl.value = URL.createObjectURL(blob)
      stopMediaTracks()
      mediaRecorder = null
      isRecording.value = false
      stopTimer()
    }

    mediaRecorder.start()
    isRecording.value = true
    timerId = window.setInterval(() => {
      elapsedSeconds.value += 1
    }, 1000)
  } catch {
    showToast('无法打开麦克风，请检查浏览器权限')
  }
}

function stopRecording() {
  isRecording.value = false
  stopTimer()

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    stopMediaTracks()
    return
  }

  mediaRecorder.stop()
  stopMediaTracks()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  releasePreviewUrl()
  audioBlob.value = null
  scoreResult.value = null

  if (!file) {
    selectedFile.value = null
    return
  }

  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    showToast('请选择音频或视频文件')
    input.value = ''
    selectedFile.value = null
    return
  }

  selectedFile.value = file
  selectedFileUrl.value = URL.createObjectURL(file)
}

async function submitScore() {
  if (!refText.value.trim()) {
    showToast('请先填写标准唱词')
    return
  }

  const practiceFile = selectedFile.value || audioBlob.value
  if (!practiceFile) {
    showToast('请先录音或上传音视频')
    return
  }

  isSubmitting.value = true

  try {
    const formData = new FormData()
    formData.append('title', title.value.trim() || '唱戏评分')
    formData.append('refText', refText.value.trim())
    formData.append(
      'audio',
      practiceFile,
      selectedFile.value?.name || `practice-${Date.now()}.webm`,
    )

    const response = await fetch(`${apiBaseUrl}/api/practice/score`, {
      method: 'POST',
      body: formData,
    })

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.error || '评分失败')
    }

    scoreResult.value = payload.item
    showToast('评分完成')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '评分失败，请稍后重试')
  } finally {
    isSubmitting.value = false
  }
}

onBeforeUnmount(() => {
  stopTimer()
  stopMediaTracks()
  releasePreviewUrl()
})
</script>

<template>
  <main class="practice-score-page">
    <section class="practice-score-shell">
      <header class="practice-score-header">
        <p>练功</p>
        <h1>唱戏评分</h1>
      </header>

      <section class="practice-score-panel">
        <label class="practice-field">
          <span>练习名称</span>
          <input v-model="title" maxlength="40" type="text" />
        </label>

        <label class="practice-field">
          <span>标准唱词</span>
          <textarea v-model="refText" maxlength="120" rows="3" />
        </label>

        <div class="practice-recorder">
          <div>
            <span class="practice-recorder__label">录音时长</span>
            <strong>{{ recordingLabel }}</strong>
          </div>
          <button
            class="practice-recorder__button"
            :class="{ 'is-recording': isRecording }"
            type="button"
            @click="isRecording ? stopRecording() : startRecording()"
          >
            {{ isRecording ? '停止录音' : '开始录音' }}
          </button>
        </div>

        <label class="practice-upload">
          <span>上传音频/视频</span>
          <strong>{{ selectedFile?.name || '选择本地文件' }}</strong>
          <input accept="audio/*,video/mp4,video/webm,video/quicktime" type="file" @change="handleFileChange" />
        </label>

        <audio v-if="audioUrl" class="practice-audio" :src="audioUrl" controls />
        <audio
          v-else-if="selectedFileUrl && selectedFile?.type.startsWith('audio/')"
          class="practice-audio"
          :src="selectedFileUrl"
          controls
        />
        <video
          v-else-if="selectedFileUrl && selectedFile?.type.startsWith('video/')"
          class="practice-video"
          :src="selectedFileUrl"
          controls
        />

        <button class="practice-submit" type="button" :disabled="isSubmitting || isRecording" @click="submitScore">
          {{ isSubmitting ? '正在评分' : '提交评分' }}
        </button>
      </section>

      <section v-if="scoreResult" class="practice-score-result">
        <div class="practice-score-result__main">
          <span>综合得分</span>
          <strong>{{ scoreResult.totalScore }}</strong>
        </div>

        <div class="practice-score-grid">
          <div>
            <span>唱词准确</span>
            <strong>{{ scoreResult.accuracyScore }}</strong>
          </div>
          <div>
            <span>流畅稳定</span>
            <strong>{{ scoreResult.fluencyScore }}</strong>
          </div>
          <div>
            <span>完整程度</span>
            <strong>{{ scoreResult.completionScore }}</strong>
          </div>
        </div>

        <p class="practice-feedback">{{ scoreResult.feedback }}</p>
      </section>
    </section>
  </main>
</template>

<style scoped>
.practice-score-page {
  min-height: 100vh;
  padding-bottom: 6rem;
  background:
    var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat,
    var(--xiqu-app-bg-color);
  color: #164c48;
}

.practice-score-shell {
  width: min(100%, 30rem);
  margin: 0 auto;
  padding: 2rem 1.2rem 0;
}

.practice-score-header p {
  margin: 0;
  color: #bb4d55;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.28em;
}

.practice-score-header h1 {
  margin: 0.55rem 0 1.3rem;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: clamp(2.2rem, 9vw, 3rem);
  line-height: 1;
}

.practice-score-panel,
.practice-score-result {
  border-radius: 0.65rem;
  background: rgb(255 253 241 / 0.94);
  box-shadow: 0 0.4rem 1rem rgb(72 43 20 / 0.12);
}

.practice-score-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.practice-field {
  display: grid;
  gap: 0.45rem;
}

.practice-field span,
.practice-recorder__label,
.practice-score-grid span,
.practice-score-result__main span {
  color: #b94b54;
  font-size: 0.88rem;
  font-weight: 700;
}

.practice-field input,
.practice-field textarea {
  width: 100%;
  border: 0.08rem solid rgb(22 76 72 / 0.18);
  border-radius: 0.42rem;
  background: #fff;
  color: #164c48;
  font: inherit;
  line-height: 1.5;
  outline: none;
  padding: 0.72rem 0.8rem;
}

.practice-recorder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 0.58rem;
  background: rgb(67 207 198 / 0.12);
  padding: 0.85rem;
}

.practice-recorder strong {
  display: block;
  margin-top: 0.2rem;
  color: #164c48;
  font-size: 1.45rem;
}

.practice-recorder__button,
.practice-submit {
  border: 0;
  border-radius: 999px;
  color: #fff8e4;
  cursor: pointer;
  font-weight: 700;
}

.practice-recorder__button {
  min-width: 6.5rem;
  padding: 0.7rem 1rem;
  background: #43cfc6;
}

.practice-recorder__button.is-recording {
  background: #c84b50;
}

.practice-audio {
  width: 100%;
}

.practice-video {
  width: 100%;
  max-height: 14rem;
  border-radius: 0.5rem;
  background: #164c48;
}

.practice-upload {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  overflow: hidden;
  border: 0.08rem dashed rgb(22 76 72 / 0.28);
  border-radius: 0.58rem;
  background: rgb(255 255 255 / 0.68);
  cursor: pointer;
  padding: 0.85rem;
}

.practice-upload span {
  color: #b94b54;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
}

.practice-upload strong {
  min-width: 0;
  overflow: hidden;
  color: #164c48;
  font-size: 0.95rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.practice-upload input {
  position: absolute;
  inset: 0;
  cursor: pointer;
  opacity: 0;
}

.practice-submit {
  min-height: 3rem;
  background: #c84b50;
  font-size: 1.08rem;
}

.practice-submit:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.practice-score-result {
  margin-top: 1rem;
  padding: 1rem;
}

.practice-score-result__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 0.08rem solid rgb(22 76 72 / 0.12);
  padding-bottom: 0.9rem;
}

.practice-score-result__main strong {
  color: #c84b50;
  font-size: 3rem;
  line-height: 1;
}

.practice-score-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.9rem;
}

.practice-score-grid div {
  border-radius: 0.5rem;
  background: rgb(255 255 255 / 0.78);
  padding: 0.72rem 0.45rem;
  text-align: center;
}

.practice-score-grid strong {
  display: block;
  margin-top: 0.25rem;
  color: #164c48;
  font-size: 1.42rem;
}

.practice-feedback {
  margin: 0.95rem 0 0;
  color: #164c48;
  font-weight: 700;
  line-height: 1.7;
}
</style>
