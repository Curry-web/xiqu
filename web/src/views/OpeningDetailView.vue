<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import homeHeroUrl from '../assets/images/home-hero.jpg'

const router = useRouter()
const serverBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8788'
const fanImageUrl = `${serverBaseUrl}/openings/today-opening-fan.png`
const searchKeyword = ref('贵妃醉酒')

const tabs = [
  { label: '内容', target: 'detail-content-section' },
  { label: '知识', target: 'detail-knowledge-section' },
  { label: '唱段', target: 'detail-video-section' },
  { label: '实物', target: 'detail-object-section' },
  { label: '曲小知', routeName: 'stage' },
]

const videos = [
  {
    id: 1,
    title: '贵妃醉酒经典唱段',
    meta: '03:14',
    imageUrl: fanImageUrl,
  },
  {
    id: 2,
    title: '梅派身段赏析',
    meta: '03:04',
    imageUrl: fanImageUrl,
  },
]

const objects = [
  {
    id: 1,
    title: '如意冠与头面',
    imageUrl: homeHeroUrl,
  },
  {
    id: 2,
    title: '宫装戏服',
    imageUrl: fanImageUrl,
  },
]

function goBack() {
  router.back()
}

function scrollToSection(target: string) {
  document.getElementById(target)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function handleTabClick(tab: { target?: string; routeName?: string }) {
  if (tab.routeName) {
    router.push({ name: tab.routeName })
    return
  }

  if (tab.target) {
    scrollToSection(tab.target)
  }
}

function handleImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) {
    image.src = homeHeroUrl
  }
}
</script>

<template>
  <main class="opening-detail-page">
    <section class="opening-detail-shell">
      <header class="detail-top">
        <div class="detail-search-row">
          <button class="detail-back" type="button" aria-label="返回" @click="goBack">
            <span aria-hidden="true" />
          </button>

          <label class="detail-search" aria-label="搜索">
            <input v-model="searchKeyword" type="search" autocomplete="off" />
            <span class="detail-search__icon" aria-hidden="true" />
          </label>
        </div>

        <nav class="detail-tabs" aria-label="详情分类">
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
        <section id="detail-content-section" class="detail-block detail-scroll-target" aria-labelledby="detail-content-title">
          <h1 id="detail-content-title" class="detail-block__title">内容</h1>
          <article class="detail-summary-card">
            <div class="detail-summary-card__text">
              <h2>贵妃醉酒文本</h2>
              <p>
                《贵妃醉酒》又名《百花亭》，以杨贵妃酒后独赏花亭为核心情境，唱念做舞之间铺陈人物的失落、娇嗔与雍容。
              </p>
            </div>
            <img :src="fanImageUrl" alt="贵妃醉酒戏曲形象" @error="handleImageError" />
          </article>
        </section>

        <section id="detail-knowledge-section" class="detail-block detail-scroll-target" aria-labelledby="detail-knowledge-title">
          <h2 id="detail-knowledge-title" class="detail-block__title">知识</h2>
          <article class="detail-info-card">
            <h3>剧种、地域、相关舞美知识</h3>
            <p>
              该剧目常见于京剧舞台，表演重在梅派身段、眼神、圆场和水袖调度。服饰、头面、扇子等实物共同构成角色身份与舞台气韵。
            </p>
          </article>
        </section>

        <section id="detail-video-section" class="detail-block detail-scroll-target" aria-labelledby="detail-video-title">
          <h2 id="detail-video-title" class="detail-block__title">唱段</h2>
          <div class="detail-media-card">
            <article v-for="video in videos" :key="video.id" class="detail-video">
              <div class="detail-video__thumb">
                <img :src="video.imageUrl" :alt="video.title" @error="handleImageError" />
                <span class="detail-video__play" aria-hidden="true" />
                <span class="detail-video__time">{{ video.meta }}</span>
              </div>
              <h3>{{ video.title }}</h3>
            </article>
          </div>
        </section>

        <section id="detail-object-section" class="detail-block detail-scroll-target" aria-labelledby="detail-object-title">
          <h2 id="detail-object-title" class="detail-block__title">实物</h2>
          <div class="detail-object-card">
            <article v-for="object in objects" :key="object.id" class="detail-object">
              <img :src="object.imageUrl" :alt="object.title" @error="handleImageError" />
              <h3>{{ object.title }}</h3>
            </article>
          </div>
        </section>
      </section>
    </section>
  </main>
</template>

<style scoped>
.opening-detail-page {
  min-height: 100vh;
  min-height: 100svh;
  background:
    var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat,
    var(--xiqu-app-bg-color);
  color: #104d4a;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.opening-detail-shell {
  position: relative;
  width: min(100%, 30rem);
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgb(190 67 77 / 0.96) 0 17.1rem, transparent 17.1rem),
    var(--xiqu-app-bg-image) center top / 30rem auto repeat,
    #f4edcf;
  box-shadow: 0 0 2rem rgb(50 27 20 / 0.08);
}

.detail-top {
  position: relative;
  z-index: 1;
  padding: 5.05rem 1.58rem 0;
  color: #fff8df;
}

.detail-search-row {
  display: grid;
  grid-template-columns: 2.2rem 1fr;
  gap: 0.82rem;
  align-items: center;
}

.detail-back {
  position: relative;
  width: 2.2rem;
  height: 3rem;
  padding: 0;
  border: 0;
  background: transparent;
}

.detail-back span {
  position: absolute;
  top: 50%;
  left: 0.42rem;
  width: 1.1rem;
  height: 1.1rem;
  border-bottom: 0.22rem solid #fff8df;
  border-left: 0.22rem solid #fff8df;
  transform: translateY(-50%) rotate(45deg);
}

.detail-search {
  display: grid;
  grid-template-columns: 1fr 3.25rem;
  align-items: center;
  min-height: 3.98rem;
  padding: 0 0.64rem 0 1.3rem;
  border-radius: 0.82rem;
  background: #fffefd;
  box-shadow:
    0 0 1.3rem rgb(255 240 219 / 0.92),
    0 0.28rem 0.68rem rgb(83 30 35 / 0.22);
}

.detail-search input {
  min-width: 0;
  color: #0c5350;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: clamp(1.28rem, 6vw, 1.95rem);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.detail-search__icon {
  position: relative;
  display: block;
  width: 2.55rem;
  height: 2.55rem;
  border-radius: 0.36rem;
  background: #d34f59;
}

.detail-search__icon::before {
  position: absolute;
  top: 0.58rem;
  left: 0.56rem;
  width: 1.05rem;
  height: 1.05rem;
  content: "";
  border: 0.22rem solid #fffefe;
  border-radius: 999px;
}

.detail-search__icon::after {
  position: absolute;
  right: 0.58rem;
  bottom: 0.56rem;
  width: 0.88rem;
  height: 0.22rem;
  content: "";
  border-radius: 999px;
  background: #fffefe;
  transform: rotate(45deg);
  transform-origin: right center;
}

.detail-tabs {
  display: grid;
  grid-template-columns: 0.92fr 0.92fr 0.92fr 0.92fr 1.72fr;
  align-items: center;
  margin-top: 1.42rem;
}

.detail-tabs__item {
  display: flex;
  min-width: 0;
  height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  padding: 0;
  color: #fff5dc;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: clamp(1.24rem, 5.5vw, 1.8rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.detail-tabs__item.is-assistant {
  justify-content: flex-start;
  border-left: 0.12rem solid rgb(255 248 223 / 0.86);
  color: #fff5dc;
  letter-spacing: 0.04em;
  padding-left: 0.72rem;
}

.detail-tabs__flower {
  position: relative;
  width: 1.16rem;
  height: 1.16rem;
  flex: 0 0 auto;
  border: 0.16rem solid #55d4ca;
  border-radius: 50%;
}

.detail-tabs__flower::before,
.detail-tabs__flower::after {
  position: absolute;
  inset: 0.24rem;
  content: "";
  border: 0.16rem solid #55d4ca;
  border-radius: 50%;
}

.detail-tabs__flower::after {
  inset: 0.39rem;
  background: #55d4ca;
}

.detail-content {
  position: relative;
  z-index: 1;
  margin-top: 0.8rem;
  padding: 1.05rem 1.58rem 3rem;
  border-radius: 0.56rem 0.56rem 0 0;
  background:
    linear-gradient(180deg, rgb(255 247 221 / 0.18), rgb(255 247 221 / 0.08)),
    url("../assets/images/opera-search-bg.png") center top / 100% auto no-repeat,
    #f7efcf;
}

.detail-block + .detail-block {
  margin-top: 0.88rem;
}

.detail-scroll-target {
  scroll-margin-top: 1rem;
}

.detail-block__title {
  margin: 0 0 0.58rem;
  color: #d6505a;
  font-size: clamp(1.28rem, 5.7vw, 1.9rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.08em;
}

.detail-summary-card,
.detail-info-card,
.detail-media-card,
.detail-object-card {
  background: rgb(255 255 255 / 0.96);
  box-shadow: 0 0.22rem 0.62rem rgb(82 48 24 / 0.16);
}

.detail-summary-card {
  display: grid;
  grid-template-columns: 1fr 6.45rem;
  gap: 0.8rem;
  min-height: 9.65rem;
  padding: 0.75rem 1rem 0.85rem 0.78rem;
  border-radius: 0.78rem 0.78rem 0 0;
}

.detail-summary-card__text {
  min-width: 0;
}

.detail-summary-card h2,
.detail-info-card h3 {
  margin: 0 0 0.34rem;
  color: #0c5350;
  font-size: clamp(1rem, 4.6vw, 1.35rem);
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: 0.05em;
}

.detail-summary-card p,
.detail-info-card p {
  margin: 0;
  color: #0b5350;
  font-size: clamp(0.88rem, 3.95vw, 1.14rem);
  font-weight: 700;
  line-height: 1.36;
  letter-spacing: 0.03em;
}

.detail-summary-card img {
  width: 6.1rem;
  height: 8.6rem;
  align-self: center;
  object-fit: cover;
}

.detail-info-card {
  min-height: 7.35rem;
  padding: 0.86rem 0.86rem 1rem;
}

.detail-media-card,
.detail-object-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  padding: 0.82rem 0.78rem 0.74rem;
}

.detail-video,
.detail-object {
  min-width: 0;
}

.detail-object {
  display: grid;
  grid-template-rows: auto minmax(2.4rem, auto);
  align-content: start;
}

.detail-video__thumb {
  position: relative;
  aspect-ratio: 1.58;
  overflow: hidden;
  border-radius: 0.44rem;
  background: #174f4b;
}

.detail-video__thumb img,
.detail-object img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-video__play {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.92);
  transform: translate(-50%, -50%);
}

.detail-video__play::after {
  position: absolute;
  top: 50%;
  left: 54%;
  width: 0;
  height: 0;
  content: "";
  border-top: 0.48rem solid transparent;
  border-bottom: 0.48rem solid transparent;
  border-left: 0.68rem solid #d45058;
  transform: translate(-50%, -50%);
}

.detail-video__time {
  position: absolute;
  right: 0.36rem;
  bottom: 0.22rem;
  color: #fff8df;
  font-size: clamp(0.86rem, 4vw, 1.18rem);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0.08rem 0.12rem rgb(0 0 0 / 0.42);
}

.detail-video h3,
.detail-object h3 {
  margin: 0.36rem 0 0;
  color: #164f4b;
  font-size: clamp(1rem, 4.6vw, 1.35rem);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-object h3 {
  min-height: 2.3rem;
  margin-top: 0.52rem;
  padding: 0 0.08rem;
  background: rgb(255 255 255 / 0.96);
}

.detail-object img {
  aspect-ratio: 1.18;
  height: auto;
}

@media (max-width: 360px) {
  .detail-top {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .detail-content {
    padding-right: 1rem;
    padding-left: 1rem;
  }

  .detail-summary-card {
    grid-template-columns: 1fr 5.4rem;
  }

  .detail-summary-card img {
    width: 5.25rem;
  }
}
</style>
