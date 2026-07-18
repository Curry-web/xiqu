<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFavorites, setFavorite, type FavoriteSectionType } from '../api/favorites'
import { getOperaDetail, type OperaDetail } from '../api/operas'

const route = useRoute()
const router = useRouter()
const opera = ref<OperaDetail | null>(null)
const loading = ref(true)
const saving = ref(false)
const favorited = ref(false)
const errorMessage = ref('')

const operaId = computed(() => Number(route.params.id))
const sectionType = computed<FavoriteSectionType>(() => route.params.sectionType === 'knowledge' ? 'knowledge' : 'content')
const sectionLabel = computed(() => sectionType.value === 'content' ? '内容' : '知识')
const detailTitle = computed(() => {
  if (!opera.value) return sectionLabel.value
  return sectionType.value === 'content'
    ? `${opera.value.title}文本`
    : opera.value.knowledgeTitle || `${opera.value.title}知识`
})
const detailText = computed(() => {
  if (!opera.value) return ''
  return sectionType.value === 'content'
    ? opera.value.contentDetail || opera.value.content || opera.value.summary
    : opera.value.knowledgeDetail || opera.value.knowledge || opera.value.summary
})

async function loadDetail() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [operaDetail, favoriteItems] = await Promise.all([
      getOperaDetail(operaId.value),
      getFavorites({ operaId: operaId.value, sectionType: sectionType.value }),
    ])
    opera.value = operaDetail
    favorited.value = favoriteItems.length > 0
  } catch (error) {
    opera.value = null
    errorMessage.value = error instanceof Error ? error.message : '详细资料暂时无法加载，请稍后再试。'
  } finally {
    loading.value = false
  }
}

async function toggleFavorite() {
  if (!opera.value || saving.value) return
  saving.value = true
  errorMessage.value = ''

  try {
    const result = await setFavorite(opera.value.id, sectionType.value, !favorited.value)
    favorited.value = result.favorited
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '收藏操作失败，请稍后再试。'
  } finally {
    saving.value = false
  }
}

function returnToOpera() {
  router.replace({
    name: 'opening-detail',
    params: { id: operaId.value },
    hash: sectionType.value === 'content' ? '#detail-content-section' : '#detail-knowledge-section',
  })
}

watch([operaId, sectionType], loadDetail, { immediate: true })
</script>

<template>
  <main class="text-detail-page">
    <section class="text-detail-shell">
      <header class="text-detail-header">
        <button class="text-detail-back" type="button" :aria-label="`返回${opera?.title || '剧目'}页面`" @click="returnToOpera">
          <span aria-hidden="true" />
        </button>
        <div class="text-detail-heading">
          <p>{{ opera?.title || '剧目详情' }}</p>
          <h1>{{ sectionLabel }}</h1>
        </div>
        <button
          :class="['text-detail-favorite', { 'is-favorited': favorited }]"
          type="button"
          :disabled="loading || saving || !opera"
          :aria-pressed="favorited"
          @click="toggleFavorite"
        >
          {{ saving ? '保存中' : favorited ? '已收藏' : '收藏' }}
        </button>
      </header>

      <section class="text-detail-content">
        <p v-if="loading" class="text-detail-status">正在展开完整资料...</p>
        <p v-else-if="errorMessage && !opera" class="text-detail-status">{{ errorMessage }}</p>
        <template v-else-if="opera">
          <article class="text-detail-card">
            <h2>{{ detailTitle }}</h2>
            <p>{{ detailText }}</p>
          </article>
          <p v-if="errorMessage" class="text-detail-message">{{ errorMessage }}</p>
        </template>
      </section>
    </section>
  </main>
</template>

<style scoped>
.text-detail-page {
  min-height: 100vh;
  min-height: 100svh;
  color: #104d4a;
  background: var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat, var(--xiqu-app-bg-color);
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.text-detail-shell {
  width: min(100%, 30rem);
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  background: url("../assets/images/opera-search-bg.png") center top / 100% auto no-repeat, #f7efcf;
  box-shadow: 0 0 2rem rgb(50 27 20 / 0.08);
}

.text-detail-header {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr) auto;
  gap: 0.72rem;
  align-items: center;
  min-height: 10.4rem;
  padding: 3.5rem 1.35rem 1.25rem;
  color: #fff8df;
  background: rgb(193 69 79 / 0.96);
  box-shadow: 0 0.42rem 1rem rgb(117 40 46 / 0.2);
}

.text-detail-back {
  position: relative;
  width: 2.6rem;
  height: 3rem;
  padding: 0;
  border: 0;
  background: transparent;
}

.text-detail-back span {
  position: absolute;
  top: 50%;
  left: 0.62rem;
  width: 1.2rem;
  height: 1.2rem;
  border-bottom: 0.22rem solid #fff8df;
  border-left: 0.22rem solid #fff8df;
  transform: translateY(-50%) rotate(45deg);
}

.text-detail-heading { min-width: 0; }
.text-detail-heading p { margin: 0 0 0.22rem; overflow: hidden; font-size: clamp(1.2rem, 5.8vw, 1.55rem); font-weight: 700; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.text-detail-heading h1 { margin: 0; font-size: clamp(1.72rem, 7.4vw, 2.2rem); line-height: 1; letter-spacing: 0.1em; }

.text-detail-favorite {
  min-width: 4.3rem;
  padding: 0.58rem 0.68rem;
  color: #b9434e;
  border: 0.1rem solid #fff8df;
  border-radius: 0.42rem;
  background: #fff8df;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 700;
}

.text-detail-favorite.is-favorited { color: #fff8df; background: #2fa59e; }
.text-detail-favorite:disabled { opacity: 0.58; }

.text-detail-content { padding: 1.45rem 1.35rem 4rem; }
.text-detail-card { padding: 1.25rem 1.15rem 1.65rem; background: rgb(255 255 255 / 0.96); box-shadow: 0 0.22rem 0.7rem rgb(82 48 24 / 0.16); }
.text-detail-card h2 { margin: 0 0 0.85rem; color: #0c5350; font-size: clamp(1.35rem, 6vw, 1.8rem); line-height: 1.2; letter-spacing: 0.06em; }
.text-detail-card p { margin: 0; color: #0b5350; font-size: clamp(1rem, 4.7vw, 1.28rem); font-weight: 700; line-height: 1.85; letter-spacing: 0.035em; white-space: pre-line; }
.text-detail-status, .text-detail-message { color: #278b84; font-weight: 700; text-align: center; }
.text-detail-status { padding: 3rem 1rem; font-size: 1.08rem; }
.text-detail-message { margin: 1rem 0 0; }
</style>
