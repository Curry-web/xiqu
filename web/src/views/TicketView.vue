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
  lyricCompletionScore?: number
  performanceCompletionScore?: number
  tencentScore: number
  tencentRawScore?: number
  practiceScore: number
  audioQualityScore: number
  referenceId: string
  referenceTitle: string
  pitchScore: number
  contourScore: number
  melodyScore: number
  rhythmScore: number
  ornamentScore: number
  vibratoScore: number
  timbreScore: number
  resonanceScore: number
  dynamicsScore: number
  breathScore: number
  periodicityScore: number
  referenceVibratoRateHz: number
  attemptVibratoRateHz: number
  referenceVibratoExtentCents: number
  attemptVibratoExtentCents: number
  pitchOffsetCents: number
  meanPitchErrorCents: number
  durationScore: number
  activityScore: number
  levelScore: number
  clippingScore: number
  scoringFormula: string
  feedback: string
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8788'

const refText = ref('可知我常一生儿爱好，是天然。')
const title = ref('《牡丹亭·游园》完整唱句练习')
const isRecording = ref(false)
const isSubmitting = ref(false)
const elapsedSeconds = ref(0)
const audioBlob = ref<Blob | null>(null)
const audioUrl = ref('')
const selectedFile = ref<File | null>(null)
const selectedFileUrl = ref('')
const scoreResult = ref<ScoreResult | null>(null)
const isLoadingDemo = ref(false)

const demoSample = {
  id: 'mudanting-youyuan-yiju',
  title: '《牡丹亭·游园》完整唱句练习',
  fileName: 'mudanting-youyuan-yiju.mp4',
  url: `${apiBaseUrl}/practice-samples/mudanting-youyuan-yiju.mp4`,
  refText: '可知我常一生儿爱好，是天然。',
}

function pitchOffsetLabel(result: ScoreResult) {
  const offset = Math.round(result.pitchOffsetCents)
  if (Math.abs(offset) < 35) return '音区接近'
  return offset > 0 ? `偏高 ${offset} 音分` : `偏低 ${Math.abs(offset)} 音分`
}

function lyricRecognitionLabel(result: ScoreResult) {
  if (Number.isFinite(result.tencentRawScore)) return Math.round(result.tencentScore)
  const completion = result.lyricCompletionScore ?? result.completionScore
  return Math.round(
    result.accuracyScore * 0.55
      + result.fluencyScore * 0.3
      + completion * 0.15,
  )
}

function tencentRawLabel(result: ScoreResult) {
  return Math.round(result.tencentRawScore ?? result.tencentScore)
}

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

async function useDemoSample() {
  isLoadingDemo.value = true

  try {
    const response = await fetch(demoSample.url)
    if (!response.ok) throw new Error('示范片段暂时无法加载')

    const blob = await response.blob()
    releasePreviewUrl()
    audioBlob.value = null
    scoreResult.value = null
    selectedFile.value = new File([blob], demoSample.fileName, { type: 'video/mp4' })
    selectedFileUrl.value = URL.createObjectURL(selectedFile.value)
    title.value = demoSample.title
    refText.value = demoSample.refText
    showToast('已载入完整唱句示范，可直接试听或提交评分')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '示范片段加载失败')
  } finally {
    isLoadingDemo.value = false
  }
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
    formData.append('referenceId', demoSample.id)
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
        <section class="practice-demo" aria-label="完整唱句练唱示范">
          <div>
            <span>完整唱句示范 · 25 秒</span>
            <strong>《牡丹亭·游园》片段</strong>
            <small>先试听示范，再演唱同一片段；系统会比对唱词、旋律、板眼、颤音与声学特征。</small>
          </div>
          <button type="button" :disabled="isLoadingDemo || isRecording" @click="useDemoSample">
            {{ isLoadingDemo ? '载入中' : '使用示范' }}
          </button>
        </section>

        <label class="practice-field">
          <span>练习名称</span>
          <input v-model="title" maxlength="40" type="text" />
        </label>

        <label class="practice-field">
          <span>标准唱词</span>
          <textarea v-model="refText" maxlength="120" readonly rows="3" />
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
          <span>练功综合分</span>
          <strong>{{ scoreResult.practiceScore || scoreResult.totalScore }}</strong>
        </div>

        <div class="practice-score-source">
          <span>唱词识别参考 {{ lyricRecognitionLabel(scoreResult) }}/100</span>
          <span>音准旋律 {{ scoreResult.melodyScore }}</span>
          <span>板眼拖腔 {{ scoreResult.rhythmScore }}</span>
          <span>颤音转音 {{ scoreResult.ornamentScore }}</span>
          <span>音色共鸣 {{ scoreResult.timbreScore }}</span>
          <span>气息录音 {{ scoreResult.breathScore }}</span>
        </div>
        <p class="practice-tencent-raw">
          腾讯原始建议分 {{ tencentRawLabel(scoreResult) }}/100；戏曲拖腔容易造成漏字，原始分仅作接口记录。
        </p>

        <div class="practice-opera-grid">
          <div><span>颤音相似</span><strong>{{ scoreResult.vibratoScore }}</strong></div>
          <div><span>中频共鸣</span><strong>{{ scoreResult.resonanceScore }}</strong></div>
          <div><span>动态气息</span><strong>{{ scoreResult.dynamicsScore }}</strong></div>
        </div>

        <div class="practice-score-grid">
          <div>
            <span>绝对音高</span>
            <strong>{{ scoreResult.pitchScore }}</strong>
          </div>
          <div>
            <span>旋律走向</span>
            <strong>{{ scoreResult.contourScore }}</strong>
          </div>
          <div>
            <span>整体音区</span>
            <strong class="practice-pitch-offset">{{ pitchOffsetLabel(scoreResult) }}</strong>
          </div>
        </div>

        <div class="practice-recording-grid">
          <div><span>唱词准确（腾讯）</span><strong>{{ scoreResult.accuracyScore }}<small>/100</small></strong></div>
          <div><span>流畅参考（腾讯）</span><strong>{{ scoreResult.fluencyScore }}<small>/100</small></strong></div>
          <div><span>唱词覆盖（腾讯）</span><strong>{{ scoreResult.lyricCompletionScore ?? scoreResult.completionScore }}<small>/100</small></strong></div>
          <div><span>演唱完整度（综合）</span><strong>{{ scoreResult.performanceCompletionScore ?? scoreResult.completionScore }}<small>/100</small></strong></div>
        </div>

        <p v-if="scoreResult.scoringFormula" class="practice-formula">{{ scoreResult.scoringFormula }}</p>
        <p class="practice-feedback">{{ scoreResult.feedback }}</p>
        <p class="practice-disclaimer">当前为戏曲声学评分 v4：腾讯云唱词识别仅占 10%，旋律、板眼和装饰音比对是主要依据。颤音、音色和气息属于自动声学估计，会受伴奏、麦克风和环境影响；结果用于练习反馈，不代替专业老师对字韵、行腔与流派风格的判断。</p>
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

.practice-demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.78rem 0.85rem;
  border: 0.08rem solid rgb(67 207 198 / 0.38);
  border-radius: 0.58rem;
  background: rgb(67 207 198 / 0.1);
}

.practice-demo div { display: grid; gap: 0.16rem; min-width: 0; }
.practice-demo span { color: #b94b54; font-size: 0.78rem; font-weight: 700; }
.practice-demo strong { color: #164c48; font-size: 0.98rem; }
.practice-demo small { color: rgb(22 76 72 / 0.75); font-size: 0.74rem; line-height: 1.35; }
.practice-demo button { flex: 0 0 auto; padding: 0.56rem 0.72rem; color: #fff8e4; border: 0; border-radius: 0.48rem; background: #43cfc6; font: inherit; font-size: 0.82rem; font-weight: 700; }
.practice-demo button:disabled { opacity: 0.58; }

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

.practice-score-source,
.practice-recording-grid,
.practice-opera-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.56rem;
  margin-top: 0.86rem;
}

.practice-score-source span {
  padding: 0.56rem;
  color: #277c76;
  border-radius: 0.44rem;
  background: rgb(67 207 198 / 0.1);
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}

.practice-tencent-raw {
  margin: 0.58rem 0 0;
  color: #6d7f78;
  font-size: 0.72rem;
  line-height: 1.45;
  text-align: center;
}

.practice-recording-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.practice-opera-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.practice-recording-grid div,
.practice-opera-grid div { padding: 0.58rem 0.35rem; border-radius: 0.44rem; background: rgb(255 255 255 / 0.72); text-align: center; }
.practice-recording-grid span,
.practice-opera-grid span { display: block; color: #b94b54; font-size: 0.74rem; font-weight: 700; }
.practice-recording-grid strong,
.practice-opera-grid strong { display: block; margin-top: 0.2rem; color: #164c48; font-size: 1.14rem; }
.practice-formula { margin: 0.92rem 0 0; color: #277c76; font-size: 0.76rem; font-weight: 700; line-height: 1.45; }

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

.practice-score-grid .practice-pitch-offset {
  min-height: 2.5rem;
  display: grid;
  place-items: center;
  font-size: 0.88rem;
  line-height: 1.25;
}

.practice-feedback {
  margin: 0.95rem 0 0;
  color: #164c48;
  font-weight: 700;
  line-height: 1.7;
}

.practice-disclaimer {
  margin: 0.7rem 0 0;
  color: rgb(22 76 72 / 0.68);
  font-size: 0.72rem;
  line-height: 1.55;
}
</style>
