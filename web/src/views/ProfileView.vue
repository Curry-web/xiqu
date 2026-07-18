<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getFavorites, type OperaFavorite } from '../api/favorites'
import { getPracticeRepertoire, type PracticeRepertoire } from '../api/practice'
import homeHeroUrl from '../assets/images/home-hero.jpg'
import profileAvatarUrl from '../assets/images/profile-avatar.png'
import profileHeaderBgUrl from '../assets/images/profile-header-bg.png'
import profileCheckinUrl from '../assets/images/profile-checkin.png'

const stats = [
  { value: '17', unit: '天', label: '已打卡' },
  { value: '126', unit: '分钟', label: '已学习' },
  { value: '3', unit: '枚', label: '践迹佩' },
]

const router = useRouter()
const favorites = ref<OperaFavorite[]>([])
const repertoire = ref<PracticeRepertoire[]>([])
const favoritesLoading = ref(true)
const favoritesError = ref('')
const repertoireLoading = ref(true)
const repertoireError = ref('')

async function loadFavorites() {
  favoritesLoading.value = true
  favoritesError.value = ''
  try {
    favorites.value = await getFavorites()
  } catch (error) {
    favoritesError.value = error instanceof Error ? error.message : '收藏暂时无法加载'
  } finally {
    favoritesLoading.value = false
  }
}

async function loadRepertoire() {
  repertoireLoading.value = true
  repertoireError.value = ''
  try {
    repertoire.value = await getPracticeRepertoire()
  } catch (error) {
    repertoireError.value = error instanceof Error ? error.message : '练功记录暂时无法加载'
  } finally {
    repertoireLoading.value = false
  }
}

function openFavorite(item: OperaFavorite) {
  if (item.sectionType === 'chant') {
    router.push({
      name: 'opening-detail',
      params: { id: item.operaId },
      query: item.assetId ? { asset: String(item.assetId) } : {},
      hash: '#detail-video-section',
    })
    return
  }

  router.push({
    name: 'opera-text-detail',
    params: { id: item.operaId, sectionType: item.sectionType },
  })
}

function openRepertoire(item: PracticeRepertoire) {
  if (item.operaId) {
    router.push({ name: 'opening-detail', params: { id: item.operaId } })
    return
  }
  router.push({ name: 'ticket', query: item.referenceId ? { referenceId: item.referenceId } : {} })
}

function handleFavoriteImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) image.src = homeHeroUrl
}

onMounted(() => {
  loadFavorites()
  loadRepertoire()
})
</script>

<template>
  <main class="profile-page" aria-label="我的页面">
    <section class="profile-hero" :style="{ '--profile-header-bg': `url(${profileHeaderBgUrl})` }">
      <div class="profile-card">
        <img class="profile-card__avatar" :src="profileAvatarUrl" alt="京剧头像" />
        <div class="profile-card__name-wrap">
          <h1 class="profile-card__name">曲 曲</h1>
          <p class="profile-card__tag">初入梨园</p>
        </div>
        <button class="profile-card__checkin" type="button" aria-label="今日打卡">
          <img :src="profileCheckinUrl" alt="" aria-hidden="true" />
        </button>
      </div>

      <dl class="profile-stats" aria-label="学习统计">
        <div v-for="(item, index) in stats" :key="item.label" class="profile-stats__item">
          <dt>{{ item.label }}</dt>
          <dd>
            <span>{{ item.value }}</span>{{ item.unit }}
          </dd>
          <i v-if="index < stats.length - 1" aria-hidden="true" />
        </div>
      </dl>
    </section>

    <section class="profile-content">
      <div class="profile-section">
        <h2>我的戏箱</h2>
        <p v-if="repertoireLoading" class="profile-favorites-status">正在整理练过的戏...</p>
        <p v-else-if="repertoireError" class="profile-favorites-status">{{ repertoireError }}</p>
        <p v-else-if="repertoire.length === 0" class="profile-favorites-status">完成一次唱戏评分后，剧目会收进戏箱</p>
        <div v-else class="profile-grid" aria-label="我的戏箱">
          <button v-for="item in repertoire" :key="item.id" class="profile-tile profile-repertoire" type="button" @click="openRepertoire(item)">
            <img :src="item.coverUrl || homeHeroUrl" :alt="item.title" @error="handleFavoriteImageError" />
            <span class="profile-repertoire__caption">
              <strong>{{ item.title }}</strong>
              <small>练习 {{ item.practiceCount }} 次 · 最高 {{ item.bestScore }} 分</small>
            </span>
          </button>
        </div>
      </div>

      <div class="profile-divider" aria-hidden="true" />

      <div class="profile-section">
        <h2>我的收藏</h2>
        <p v-if="favoritesLoading" class="profile-favorites-status">正在整理收藏...</p>
        <p v-else-if="favoritesError" class="profile-favorites-status">{{ favoritesError }}</p>
        <p v-else-if="favorites.length === 0" class="profile-favorites-status">还没有收藏内容</p>
        <div v-else class="profile-grid" aria-label="我的收藏">
          <button v-for="item in favorites" :key="`${item.sectionType}-${item.id}`" class="profile-tile profile-favorite" type="button" @click="openFavorite(item)">
            <img :src="item.coverUrl || homeHeroUrl" :alt="item.operaTitle" @error="handleFavoriteImageError" />
            <span>{{ item.title }}</span>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  padding-bottom: 6rem;
  overflow: hidden;
  color: #173f3d;
  background:
    var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat,
    var(--xiqu-app-bg-color);
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.profile-page::before {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 12%, rgb(255 255 255 / 0.2), transparent 22%);
  mix-blend-mode: soft-light;
}

.profile-hero {
  position: relative;
  max-width: 30rem;
  margin: 0 auto;
  padding: clamp(3.7rem, 12vw, 4.9rem) 1.7rem 3.25rem;
  background: var(--profile-header-bg) center top / cover no-repeat;
}


.profile-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 4.95rem 1fr auto;
  gap: 1rem;
  align-items: center;
  transform: translateY(-0.55rem);
}

.profile-card__avatar {
  width: 4.95rem;
  height: 4.95rem;
  padding: 0.18rem;
  object-fit: cover;
  border-radius: 999px;
  background: #15534e;
  box-shadow: 0 0.25rem 0.8rem rgb(33 27 25 / 0.18);
}

.profile-card__name {
  margin: 0;
  color: #102f2e;
  font-size: clamp(1.72rem, 8vw, 2.35rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.16em;
}

.profile-card__tag {
  display: inline-block;
  margin: 0.42rem 0 0;
  padding: 0.1rem 0.75rem 0.16rem;
  color: #fff5d6;
  background: #2fa59e;
  font-size: 1.05rem;
  line-height: 1.1;
  letter-spacing: 0.08em;
}

.profile-card__checkin {
  width: clamp(7.4rem, 22vw, 9.5rem);
  padding: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 1.5rem;
  filter: drop-shadow(0 0.16rem 0.18rem rgb(25 91 87 / 0.14));
}
.profile-card__checkin img {
  display: block;
  width: 100%;
  height: auto;
  mix-blend-mode: multiply;
}


.profile-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 1.7rem 0 0;
  color: #fffbe3;
  transform: translateY(-0.45rem);
  text-shadow: 0 0.08rem 0.25rem rgb(66 54 41 / 0.18);
}

.profile-stats__item {
  position: relative;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 0.16rem;
}

.profile-stats__item dd,
.profile-stats__item dt {
  margin: 0;
}

.profile-stats__item dd {
  font-size: 1.26rem;
  letter-spacing: 0.04em;
}

.profile-stats__item dd span {
  margin-right: 0.16rem;
  font-size: clamp(2.95rem, 14vw, 4rem);
  font-weight: 700;
  line-height: 0.9;
}

.profile-stats__item dt {
  font-size: 1.42rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-stats__item i {
  position: absolute;
  top: 0.2rem;
  right: -0.02rem;
  width: 1px;
  height: 4.6rem;
  background: rgb(255 251 227 / 0.72);
}

.profile-content {
  position: relative;
  z-index: 1;
  max-width: 30rem;
  margin: -2.35rem auto 0;
  padding: 2.85rem 1.7rem 3rem;
  background:
    var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat,
    var(--xiqu-app-bg-color);
  border-radius: 2.2rem 2.2rem 0 0;
  box-shadow: 0 -0.45rem 1rem rgb(60 56 43 / 0.04);
}

.profile-section h2 {
  margin: 0 0 1.2rem;
  color: #163e3c;
  font-size: clamp(1.9rem, 9vw, 2.62rem);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1.6rem, 8vw, 2.45rem);
}

.profile-tile {
  position: relative;
  aspect-ratio: 0.76;
  overflow: hidden;
  background: var(--tile-color);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
}

.profile-favorite { padding: 0; color: inherit; border: 0; font: inherit; cursor: pointer; }
.profile-favorite img { display: block; width: 100%; height: 100%; object-fit: cover; }
.profile-favorite span { opacity: 1; }

.profile-repertoire { padding: 0; color: inherit; border: 0; background: #3f8b82; font: inherit; cursor: pointer; }
.profile-repertoire img { display: block; width: 100%; height: 100%; object-fit: cover; }
.profile-repertoire .profile-repertoire__caption { display: grid; gap: 0.1rem; padding: 0.62rem 0.32rem 0.5rem; opacity: 1; }
.profile-repertoire__caption strong { overflow: hidden; font-size: 0.96rem; text-overflow: ellipsis; white-space: nowrap; }
.profile-repertoire__caption small { overflow: hidden; font-size: 0.68rem; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }

.profile-favorites-status {
  min-height: 7rem;
  margin: 0;
  display: grid;
  place-items: center;
  color: #2c817b;
  border: 1px solid rgb(47 165 158 / 0.18);
  background: rgb(255 255 255 / 0.3);
  font-size: 1.05rem;
  font-weight: 700;
}

.profile-tile span {
  position: absolute;
  inset: auto 0 0;
  padding: 0.45rem 0.24rem;
  color: #fff8df;
  background: linear-gradient(180deg, transparent, rgb(18 54 52 / 0.4));
  font-size: 0.92rem;
  line-height: 1.1;
  text-align: center;
  opacity: 0;
  transition: opacity 160ms ease;
}

.profile-tile:focus-within span,
.profile-tile:hover span {
  opacity: 1;
}

.profile-divider {
  height: 0.18rem;
  margin: 3.25rem 0 1.7rem;
  background: #1fa6a0;
}

@media (max-width: 480px) {
  .profile-hero {
    padding-right: 1.35rem;
    padding-left: 1.35rem;
  }

  .profile-card {
    grid-template-columns: 4.6rem minmax(0, 1fr) 6.8rem;
    gap: 0.72rem;
    transform: translateY(-0.55rem);
  }

  .profile-card__avatar {
    width: 4.6rem;
    height: 4.6rem;
  }

  .profile-card__name {
    font-size: clamp(1.72rem, 10vw, 2.1rem);
    letter-spacing: 0.12em;
    white-space: nowrap;
  }

  .profile-card__tag {
    padding-inline: 0.6rem;
    font-size: 1rem;
    white-space: nowrap;
  }

  .profile-card__checkin {
    width: 6.8rem;
    justify-self: end;
    border-radius: 1.15rem;
  }

  .profile-stats {
    margin-top: 1.45rem;
    transform: translateY(-0.25rem);
  }

  .profile-stats__item {
    min-width: 0;
    padding: 0 0.45rem;
  }

  .profile-stats__item dd {
    display: flex;
    align-items: baseline;
    justify-content: center;
    min-width: 0;
    white-space: nowrap;
    font-size: 0.92rem;
    line-height: 1;
  }

  .profile-stats__item dd span {
    margin-right: 0.1rem;
    font-size: clamp(2.35rem, 12.5vw, 3rem);
  }

  .profile-stats__item:nth-child(2) dd {
    font-size: 0.82rem;
  }

  .profile-stats__item:nth-child(2) dd span {
    font-size: clamp(2.2rem, 11.4vw, 2.85rem);
  }

  .profile-stats__item dt {
    font-size: 1.12rem;
    line-height: 1.12;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .profile-stats__item i {
    top: 0.25rem;
    right: 0;
    height: 3.7rem;
  }

  .profile-content {
    padding-right: 1.35rem;
    padding-left: 1.35rem;
  }
}

</style>
