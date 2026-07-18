<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFavorites, setChantFavorite } from '../api/favorites'
import { getOperaDetail, searchOperas, type OperaAsset, type OperaDetail } from '../api/operas'
import homeHeroUrl from '../assets/images/home-hero.jpg'

const route = useRoute()
const router = useRouter()
const searchKeyword = ref('')
const opera = ref<OperaDetail | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const selectedAsset = ref<OperaAsset | null>(null)
const chantFavoriteIds = ref(new Set<number>())
const chantFavoritePendingIds = ref(new Set<number>())

const tabs = [
  { label: '内容', target: 'detail-content-section' },
  { label: '知识', target: 'detail-knowledge-section' },
  { label: '唱段', target: 'detail-video-section' },
  { label: '实物', target: 'detail-object-section' },
  { label: '曲小知', routeName: 'stage' },
]

const summaryTitle = computed(() => opera.value ? `${opera.value.title}文本` : '戏文内容')
const coverUrl = computed(() => opera.value?.coverUrl || homeHeroUrl)

async function loadOpera() {
  const id = Number(route.params.id)
  loading.value = true
  errorMessage.value = ''
  selectedAsset.value = null

  try {
    const [detail, favorites] = await Promise.all([
      getOperaDetail(id),
      getFavorites({ operaId: id, sectionType: 'chant' }).catch(() => []),
    ])
    opera.value = detail
    chantFavoriteIds.value = new Set(favorites.flatMap((item) => item.assetId ? [item.assetId] : []))
    searchKeyword.value = opera.value.title
    const requestedAssetId = Number(route.query.asset)
    selectedAsset.value = Number.isInteger(requestedAssetId)
      ? opera.value.chants.find((item) => item.id === requestedAssetId) ?? null
      : null
    await nextTick()
    if (route.hash) document.querySelector(route.hash)?.scrollIntoView({ block: 'start' })
  } catch {
    opera.value = null
    errorMessage.value = '剧目资料暂时无法加载，请稍后再试。'
  } finally {
    loading.value = false
  }
}

async function toggleChantFavorite(asset: OperaAsset) {
  if (!opera.value || chantFavoritePendingIds.value.has(asset.id)) return

  const favorited = chantFavoriteIds.value.has(asset.id)
  chantFavoritePendingIds.value = new Set([...chantFavoritePendingIds.value, asset.id])
  try {
    await setChantFavorite(opera.value.id, asset.id, !favorited)
    const nextIds = new Set(chantFavoriteIds.value)
    if (favorited) nextIds.delete(asset.id)
    else nextIds.add(asset.id)
    chantFavoriteIds.value = nextIds
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '唱段收藏失败，请稍后重试。'
  } finally {
    const pendingIds = new Set(chantFavoritePendingIds.value)
    pendingIds.delete(asset.id)
    chantFavoritePendingIds.value = pendingIds
  }
}

function goBack() {
  router.replace({ name: 'home' })
}

async function searchOpera() {
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    await router.push({ name: 'opera' })
    return
  }

  try {
    const matches = await searchOperas(keyword)
    const exactMatch = matches.find((item) => item.title === keyword || item.title.includes(keyword) || keyword.includes(item.title))
      || (matches.length === 1 ? matches[0] : undefined)
    if (exactMatch) {
      await router.push({ name: 'opening-detail', params: { id: exactMatch.id } })
      return
    }
  } catch {
    // The search page can still show a helpful retry state if the request fails.
  }

  await router.push({ name: 'opera', query: { q: keyword } })
}

function scrollToSection(target: string) {
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleTabClick(tab: { target?: string; routeName?: string }) {
  if (tab.routeName) {
    router.push({ name: tab.routeName })
    return
  }
  if (tab.target) scrollToSection(tab.target)
}

function selectAsset(asset: OperaAsset) {
  selectedAsset.value = asset
  if (asset.mediaUrl) {
    nextTick(() => document.getElementById('detail-video-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
}

function openTextDetail(type: 'content' | 'knowledge') {
  router.push({
    name: 'opera-text-detail',
    params: { id: route.params.id, sectionType: type },
  })
}

function handleImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) image.src = homeHeroUrl
}

watch(() => route.params.id, loadOpera)
onMounted(loadOpera)
</script>

<template>
  <main class="opening-detail-page">
    <section class="opening-detail-shell">
      <header class="detail-top">
        <form class="detail-search-row" @submit.prevent="searchOpera">
          <button class="detail-back" type="button" aria-label="返回" @click="goBack"><span aria-hidden="true" /></button>
          <label class="detail-search" aria-label="搜索戏曲">
            <input v-model="searchKeyword" type="search" autocomplete="off" />
            <button class="detail-search__icon" type="submit" aria-label="搜索" />
          </label>
        </form>

        <nav class="detail-tabs" aria-label="剧目详情分类">
          <button
            v-for="tab in tabs"
            :key="tab.label"
            :class="['detail-tabs__item', { 'is-assistant': tab.label === '曲小知' }]"
            type="button"
            @click="handleTabClick(tab)"
          >
            <span v-if="tab.label === '曲小知'" class="detail-tabs__flower" aria-hidden="true" />
            {{ tab.label }}
          </button>
        </nav>
      </header>

      <section class="detail-content">
        <p v-if="loading" class="detail-status">正在整理戏文资料...</p>
        <p v-else-if="errorMessage" class="detail-status">{{ errorMessage }}</p>

        <template v-else-if="opera">
          <section id="detail-content-section" class="detail-block detail-scroll-target" aria-labelledby="detail-content-title">
            <h1 id="detail-content-title" class="detail-block__title">内容</h1>
            <button class="detail-summary-card detail-text-card" type="button" @click="openTextDetail('content')">
              <span class="detail-summary-card__text">
                <h2>{{ summaryTitle }}</h2>
                <p>{{ opera.content || opera.summary }}</p>
              </span>
              <span class="detail-text-card__more">详细查看 <span aria-hidden="true">›</span></span>
            </button>
          </section>

          <section id="detail-knowledge-section" class="detail-block detail-scroll-target" aria-labelledby="detail-knowledge-title">
            <h2 id="detail-knowledge-title" class="detail-block__title">知识</h2>
            <button class="detail-info-card detail-text-card" type="button" @click="openTextDetail('knowledge')">
              <h3>{{ opera.knowledgeTitle || '相关舞美知识' }}</h3>
              <p>{{ opera.knowledge || opera.summary }}</p>
              <span class="detail-text-card__more">详细查看 <span aria-hidden="true">›</span></span>
            </button>
          </section>

          <section id="detail-video-section" class="detail-block detail-scroll-target" aria-labelledby="detail-video-title">
            <h2 id="detail-video-title" class="detail-block__title">唱段</h2>
            <div v-if="opera.chants.length" class="detail-media-card">
              <article v-for="chant in opera.chants" :key="chant.id" class="detail-video">
                <button class="detail-video__open" type="button" @click="selectAsset(chant)">
                  <span class="detail-video__thumb">
                    <img :src="chant.imageUrl || coverUrl" :alt="chant.title" @error="handleImageError" />
                    <span class="detail-video__play" aria-hidden="true" />
                    <span class="detail-video__time">{{ chant.duration }}</span>
                  </span>
                </button>
                <span class="detail-video__footer">
                  <span class="detail-asset__title">{{ chant.title }}</span>
                  <button
                    :class="['detail-video__favorite', { 'is-favorited': chantFavoriteIds.has(chant.id) }]"
                    type="button"
                    :disabled="chantFavoritePendingIds.has(chant.id)"
                    :aria-label="chantFavoriteIds.has(chant.id) ? `取消收藏${chant.title}` : `收藏${chant.title}`"
                    @click="toggleChantFavorite(chant)"
                  >{{ chantFavoriteIds.has(chant.id) ? '已收藏' : '收藏' }}</button>
                </span>
              </article>
            </div>
            <p v-else class="detail-empty-card">该剧目的唱段资料正在整理中</p>
            <div v-if="selectedAsset?.mediaUrl" id="detail-video-player" class="detail-player">
              <div class="detail-player__top">
                <strong>{{ selectedAsset.title }}</strong>
                <button type="button" aria-label="关闭播放器" @click="selectedAsset = null">×</button>
              </div>
              <video :src="selectedAsset.mediaUrl" :poster="selectedAsset.imageUrl || coverUrl" controls playsinline preload="metadata" />
            </div>
          </section>

          <section id="detail-object-section" class="detail-block detail-scroll-target" aria-labelledby="detail-object-title">
            <h2 id="detail-object-title" class="detail-block__title">实物</h2>
            <div v-if="opera.objects.length" class="detail-object-card">
              <button v-for="object in opera.objects" :key="object.id" class="detail-object" type="button" @click="selectAsset(object)">
                <img :src="object.imageUrl" :alt="object.title" @error="handleImageError" />
                <span class="detail-asset__title">{{ object.title }}</span>
              </button>
            </div>
            <p v-else class="detail-empty-card">该剧目的图片资料正在整理中</p>
          </section>

          <p v-if="selectedAsset" class="detail-asset-note">已选择：{{ selectedAsset.title }}</p>
        </template>
      </section>

    </section>
  </main>
</template>

<style scoped>
.opening-detail-page {
  min-height: 100vh;
  min-height: 100svh;
  background: var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat, var(--xiqu-app-bg-color);
  color: #104d4a;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.opening-detail-shell {
  width: min(100%, 30rem);
  min-height: 100vh;
  margin: 0 auto;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(190 67 77 / 0.96) 0 17.1rem, transparent 17.1rem), var(--xiqu-app-bg-image) center top / 30rem auto repeat, #f4edcf;
  box-shadow: 0 0 2rem rgb(50 27 20 / 0.08);
}

.detail-top { padding: 5.05rem 1.58rem 0; color: #fff8df; }
.detail-search-row { display: grid; grid-template-columns: 2.2rem 1fr; gap: 0.82rem; align-items: center; }
.detail-back { position: relative; width: 2.2rem; height: 3rem; padding: 0; border: 0; background: transparent; }
.detail-back span { position: absolute; top: 50%; left: 0.42rem; width: 1.1rem; height: 1.1rem; border-bottom: 0.22rem solid #fff8df; border-left: 0.22rem solid #fff8df; transform: translateY(-50%) rotate(45deg); }

.detail-search { display: grid; grid-template-columns: 1fr 3.25rem; align-items: center; min-height: 3.98rem; padding: 0 0.64rem 0 1.3rem; border-radius: 0.82rem; background: #fffefd; box-shadow: 0 0 1.3rem rgb(255 240 219 / 0.92), 0 0.28rem 0.68rem rgb(83 30 35 / 0.22); }
.detail-search input { min-width: 0; color: #0c5350; border: 0; outline: 0; background: transparent; font: inherit; font-size: clamp(1.28rem, 6vw, 1.95rem); font-weight: 700; letter-spacing: 0.06em; }
.detail-search__icon { position: relative; display: block; width: 2.55rem; height: 2.55rem; border: 0; border-radius: 0.36rem; background: #d34f59; }
.detail-search__icon::before { position: absolute; top: 0.58rem; left: 0.56rem; width: 1.05rem; height: 1.05rem; content: ""; border: 0.22rem solid #fffefe; border-radius: 999px; }
.detail-search__icon::after { position: absolute; right: 0.58rem; bottom: 0.56rem; width: 0.88rem; height: 0.22rem; content: ""; border-radius: 999px; background: #fffefe; transform: rotate(45deg); transform-origin: right center; }

.detail-tabs { display: grid; grid-template-columns: 0.92fr 0.92fr 0.92fr 0.92fr 1.72fr; align-items: center; margin-top: 1.42rem; }
.detail-tabs__item { display: flex; min-width: 0; height: 2.5rem; align-items: center; justify-content: center; gap: 0.34rem; padding: 0; color: #fff5dc; border: 0; background: transparent; font: inherit; font-size: clamp(1.24rem, 5.5vw, 1.8rem); font-weight: 700; line-height: 1; letter-spacing: 0.12em; white-space: nowrap; }
.detail-tabs__item.is-assistant { justify-content: flex-start; border-left: 0.12rem solid rgb(255 248 223 / 0.86); letter-spacing: 0.04em; padding-left: 0.72rem; }
.detail-tabs__flower { position: relative; width: 1.16rem; height: 1.16rem; flex: 0 0 auto; border: 0.16rem solid #55d4ca; border-radius: 50%; }
.detail-tabs__flower::before, .detail-tabs__flower::after { position: absolute; inset: 0.24rem; content: ""; border: 0.16rem solid #55d4ca; border-radius: 50%; }
.detail-tabs__flower::after { inset: 0.39rem; background: #55d4ca; }

.detail-content { margin-top: 0.8rem; padding: 1.05rem 1.58rem 3rem; border-radius: 0.56rem 0.56rem 0 0; background: linear-gradient(180deg, rgb(255 247 221 / 0.18), rgb(255 247 221 / 0.08)), url("../assets/images/opera-search-bg.png") center top / 100% auto no-repeat, #f7efcf; }
.detail-status { padding: 2.5rem 1rem; color: #278b84; font-size: 1.12rem; font-weight: 700; text-align: center; }
.detail-block + .detail-block { margin-top: 0.88rem; }
.detail-scroll-target { scroll-margin-top: 1rem; }
.detail-block__title { margin: 0 0 0.58rem; color: #d6505a; font-size: clamp(1.28rem, 5.7vw, 1.9rem); font-weight: 700; line-height: 1.1; letter-spacing: 0.08em; }
.detail-summary-card, .detail-info-card, .detail-media-card, .detail-object-card { background: rgb(255 255 255 / 0.96); box-shadow: 0 0.22rem 0.62rem rgb(82 48 24 / 0.16); }
.detail-text-card { position: relative; display: block; width: 100%; padding: 0.84rem 0.92rem 2.32rem; color: inherit; border: 0; font: inherit; text-align: left; }
.detail-summary-card { min-height: 9.65rem; border-radius: 0.78rem 0.78rem 0 0; }
.detail-summary-card__text { display: block; min-width: 0; }
.detail-summary-card h2, .detail-info-card h3 { margin: 0 0 0.34rem; color: #0c5350; font-size: clamp(1rem, 4.6vw, 1.35rem); font-weight: 700; line-height: 1.22; letter-spacing: 0.05em; }
.detail-summary-card p, .detail-info-card p { margin: 0; color: #0b5350; font-size: clamp(0.88rem, 3.95vw, 1.14rem); font-weight: 700; line-height: 1.48; letter-spacing: 0.03em; white-space: pre-line; }
.detail-info-card { min-height: 7.35rem; }
.detail-text-card__more { position: absolute; right: 0.88rem; bottom: 0.56rem; color: #42b8b0; font-size: 0.88rem; font-weight: 700; }
.detail-text-card__more span { display: inline-grid; width: 1rem; height: 1rem; place-items: center; margin-left: 0.16rem; color: #fffef6; border-radius: 50%; background: #42b8b0; font-size: 1.08rem; line-height: 1; }
.detail-media-card, .detail-object-card { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; padding: 0.82rem 0.78rem 0.74rem; }
.detail-video, .detail-object { min-width: 0; padding: 0; color: inherit; border: 0; background: transparent; font: inherit; text-align: left; }
.detail-video__open { display: block; width: 100%; padding: 0; color: inherit; border: 0; background: transparent; font: inherit; text-align: left; }
.detail-video__thumb { position: relative; display: block; aspect-ratio: 1.58; overflow: hidden; border-radius: 0.44rem; background: #174f4b; }
.detail-video__thumb img, .detail-object img { display: block; width: 100%; height: 100%; object-fit: cover; }
.detail-video__play { position: absolute; top: 50%; left: 50%; width: 2.15rem; height: 2.15rem; border-radius: 999px; background: rgb(255 255 255 / 0.92); transform: translate(-50%, -50%); }
.detail-video__play::after { position: absolute; top: 50%; left: 54%; width: 0; height: 0; content: ""; border-top: 0.48rem solid transparent; border-bottom: 0.48rem solid transparent; border-left: 0.68rem solid #d45058; transform: translate(-50%, -50%); }
.detail-video__time { position: absolute; right: 0.36rem; bottom: 0.22rem; color: #fff8df; font-size: 0.78rem; font-weight: 700; text-shadow: 0 0.08rem 0.12rem rgb(0 0 0 / 0.42); }
.detail-video__footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.35rem; align-items: start; }
.detail-video__favorite { margin-top: 0.38rem; padding: 0.2rem 0.38rem; color: #287f79; border: 1px solid rgb(66 184 176 / 0.48); border-radius: 0.3rem; background: #fffdf5; font: inherit; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
.detail-video__favorite.is-favorited { color: #fff8df; background: #42b8b0; }
.detail-video__favorite:disabled { opacity: 0.55; }
.detail-player { margin-top: 0.72rem; overflow: hidden; background: #123f3c; box-shadow: 0 0.22rem 0.62rem rgb(82 48 24 / 0.2); }
.detail-player__top { display: flex; min-height: 2.4rem; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 0.42rem 0.72rem; color: #fff8df; }
.detail-player__top strong { overflow: hidden; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; }
.detail-player__top button { width: 1.9rem; height: 1.9rem; flex: 0 0 auto; padding: 0; color: #fff8df; border: 0; background: transparent; font: inherit; font-size: 1.7rem; line-height: 1; }
.detail-player video { display: block; width: 100%; max-height: 22rem; background: #000; }
.detail-object img { aspect-ratio: 1.18; height: auto; }
.detail-asset__title { display: block; min-height: 2.2rem; margin-top: 0.42rem; overflow: hidden; color: #164f4b; font-size: clamp(0.95rem, 4.4vw, 1.25rem); font-weight: 700; line-height: 1.16; letter-spacing: 0.04em; }
.detail-empty-card { margin: 0; padding: 1.4rem 1rem; color: #278b84; background: rgb(255 255 255 / 0.84); font-size: 0.95rem; font-weight: 700; text-align: center; }
.detail-asset-note { margin: 0.9rem 0 0; color: #278b84; font-size: 0.92rem; font-weight: 700; }

@media (max-width: 360px) {
  .detail-top, .detail-content { padding-right: 1rem; padding-left: 1rem; }
}
</style>
