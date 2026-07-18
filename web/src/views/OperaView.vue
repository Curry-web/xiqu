<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchOperas, type OperaListItem } from '../api/operas'
import homeHeroUrl from '../assets/images/home-hero.jpg'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const operas = ref<OperaListItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

function routeKeyword() {
  return typeof route.query.q === 'string' ? route.query.q : ''
}

async function loadOperas() {
  keyword.value = routeKeyword()
  loading.value = true
  errorMessage.value = ''

  try {
    operas.value = await searchOperas(keyword.value)
  } catch {
    operas.value = []
    errorMessage.value = '剧目资料暂时无法加载，请稍后再试。'
  } finally {
    loading.value = false
  }
}

async function submitSearch() {
  const query = keyword.value.trim()

  if (!query) {
    await router.replace({ name: 'opera' })
    return
  }

  const visibleMatch = operas.value.find((item) => item.title === query || item.title.includes(query) || query.includes(item.title))
  if (visibleMatch) {
    await router.push({ name: 'opening-detail', params: { id: visibleMatch.id } })
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const matches = await searchOperas(query)
    const exactMatch = matches.find((item) => item.title === query || item.title.includes(query) || query.includes(item.title))
      || (matches.length === 1 ? matches[0] : undefined)

    if (exactMatch) {
      await router.push({ name: 'opening-detail', params: { id: exactMatch.id } })
      return
    }

    operas.value = matches
    await router.replace({ name: 'opera', query: { q: query } })
  } catch {
    errorMessage.value = '搜索暂时无法完成，请稍后再试。'
  } finally {
    loading.value = false
  }
}

function openOpera(id: number) {
  router.push({ name: 'opening-detail', params: { id } })
}

function handleImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) image.src = homeHeroUrl
}

watch(() => route.query.q, loadOperas)
onMounted(loadOperas)
</script>

<template>
  <main class="xiqu-page opera-search-page">
    <section class="today-opening opera-search">
      <form class="opera-search__form" @submit.prevent="submitSearch">
        <label class="opera-search__field">
          <span class="sr-only">搜索戏曲</span>
          <input v-model="keyword" type="search" placeholder="搜索戏曲名称" autocomplete="off" />
        </label>
        <button class="opera-search__button" type="submit" aria-label="搜索戏曲">
          <span aria-hidden="true" />
        </button>
      </form>

      <div class="opera-search__heading">
        <p>OPERA LIST</p>
        <h1>{{ keyword ? '搜索结果' : '搜戏' }}</h1>
        <span v-if="keyword">“{{ keyword }}”</span>
      </div>

      <p v-if="loading" class="opera-search__status">正在查找戏文资料...</p>
      <p v-else-if="errorMessage" class="opera-search__status">{{ errorMessage }}</p>
      <p v-else-if="!operas.length" class="opera-search__status">暂未找到对应戏曲，请换个剧目名称再试。</p>

      <div v-else class="today-opening__grid">
        <button
          v-for="(opera, index) in operas"
          :key="opera.id"
          :class="['opening-card', { 'opening-card--feature': index === 0 }]"
          type="button"
          @click="openOpera(opera.id)"
        >
          <img
            v-if="index === 0"
            class="opening-card__image"
            :src="opera.coverUrl || homeHeroUrl"
            :alt="opera.title"
            @error="handleImageError"
          />
          <span class="opening-card__shade" :class="{ 'is-visible': index === 0 }" />
          <span class="opening-card__copy">
            <strong>{{ opera.title }}</strong>
            <small>{{ opera.genre }}<template v-if="opera.startTime || opera.venue"> · {{ opera.startTime }}{{ opera.venue ? ` · ${opera.venue}` : '' }}</template></small>
          </span>
          <span class="opening-card__arrow" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.opera-search { padding-top: 1.6rem; }

.opera-search__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3.2rem;
  gap: 0.55rem;
  align-items: center;
  margin: 0 0 1.55rem;
}

.opera-search__field {
  min-width: 0;
  padding: 0.62rem 0.95rem;
  border: 1px solid rgb(25 113 105 / 0.22);
  border-radius: 0.55rem;
  background: rgb(255 255 255 / 0.85);
  box-shadow: 0 0.18rem 0.5rem rgb(76 53 30 / 0.1);
}

.opera-search__field input {
  width: 100%;
  color: #0c5350;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 1.03rem;
  letter-spacing: 0.03em;
}

.opera-search__field input::placeholder { color: rgb(12 83 80 / 0.55); }

.opera-search__button {
  position: relative;
  width: 3.2rem;
  height: 3.2rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #42cfc6;
  box-shadow: 0 0.18rem 0.42rem rgb(32 112 105 / 0.2);
}

.opera-search__button span::before {
  position: absolute;
  top: 0.83rem;
  left: 0.81rem;
  width: 0.91rem;
  height: 0.91rem;
  content: '';
  border: 0.18rem solid #fffdf0;
  border-radius: 50%;
}

.opera-search__button span::after {
  position: absolute;
  right: 0.8rem;
  bottom: 0.84rem;
  width: 0.8rem;
  height: 0.18rem;
  content: '';
  border-radius: 1rem;
  background: #fffdf0;
  transform: rotate(45deg);
}

.opera-search__heading { margin-bottom: 1.28rem; }
.opera-search__heading p { margin: 0 0 0.28rem; color: #c44d57; font-family: Arial, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.27em; }
.opera-search__heading h1 { margin: 0; }
.opera-search__heading span { display: block; margin-top: 0.36rem; color: #267e78; font-size: 1rem; font-weight: 700; }
.opera-search__status { margin: 2.4rem 0; color: #278b84; font-size: 1rem; font-weight: 700; text-align: center; }
</style>
