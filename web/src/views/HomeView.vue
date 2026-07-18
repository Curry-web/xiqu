<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getLiyuanMaterials, getTodayOpenings, type LiyuanMaterialItem, type OpeningItem } from '../api/home'
import homeHeroUrl from '../assets/images/home-hero.jpg'
import blackFaceUrl from '../assets/lianpu images/black-cutout.png'
import blackLiyuanUrl from '../assets/lianpu images/blackliyuan.png'
import blueFaceUrl from '../assets/lianpu images/blue-cutout.png'
import blueLiyuanUrl from '../assets/lianpu images/blueliyuan.png'
import greenFaceUrl from '../assets/lianpu images/green-cutout.png'
import greenLiyuanUrl from '../assets/lianpu images/greenliyuan.png'
import purpleFaceUrl from '../assets/lianpu images/purple-cutout.png'
import purpleLiyuanUrl from '../assets/lianpu images/purpleliyuan.png'
import redFaceUrl from '../assets/lianpu images/red-cutout.png'
import redLiyuanUrl from '../assets/lianpu images/redliyuan.png'
import whiteFaceUrl from '../assets/lianpu images/white-cutout.png'
import whiteLiyuanUrl from '../assets/lianpu images/whiteliyuan.png'
import yellowFaceUrl from '../assets/lianpu images/yellow-cutout.png'
import yellowLiyuanUrl from '../assets/lianpu images/yellowliyuan.png'

const router = useRouter()

const todayOpenings = ref<OpeningItem[]>([])
const homeDataError = ref('')
const liyuanMaterials = ref<{ performers: LiyuanMaterialItem[]; costumes: LiyuanMaterialItem[] }>({
  performers: [],
  costumes: [],
})

function handleOpeningImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) image.src = homeHeroUrl
}

function goOpeningDetail(id: number) {
  router.push({ name: 'opening-detail', params: { id } })
}

const lunarDayMap = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

function formatLunarDate(date: Date) {
  const formatter = new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const parts = formatter.formatToParts(date)
  const yearName = parts.find((part) => String(part.type) === 'yearName')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const dayValue = Number(parts.find((part) => part.type === 'day')?.value)
  return {
    year: `${yearName}年`,
    date: `${month}${lunarDayMap[dayValue - 1] ?? dayValue}`,
  }
}

const lunarDate = computed(() => formatLunarDate(new Date()))

const lianpuThemes = [
  { color: 'black', label: '黑', liyuanImage: blackLiyuanUrl, faceImage: blackFaceUrl, accent: '#334148', block: '#596571', pale: '#d8dde3' },
  { color: 'blue', label: '蓝', liyuanImage: blueLiyuanUrl, faceImage: blueFaceUrl, accent: '#11699a', block: '#697da8', pale: '#cdd6ea' },
  { color: 'green', label: '青', liyuanImage: greenLiyuanUrl, faceImage: greenFaceUrl, accent: '#25806c', block: '#6ba18c', pale: '#d3e5d9' },
  { color: 'purple', label: '紫', liyuanImage: purpleLiyuanUrl, faceImage: purpleFaceUrl, accent: '#74498f', block: '#9271aa', pale: '#ded3eb' },
  { color: 'red', label: '红', liyuanImage: redLiyuanUrl, faceImage: redFaceUrl, accent: '#b24a4d', block: '#bd656a', pale: '#edd1d3' },
  { color: 'white', label: '白', liyuanImage: whiteLiyuanUrl, faceImage: whiteFaceUrl, accent: '#6f777a', block: '#9ba2a7', pale: '#e7e9ea' },
  { color: 'yellow', label: '黄', liyuanImage: yellowLiyuanUrl, faceImage: yellowFaceUrl, accent: '#b58a24', block: '#d2aa50', pale: '#efe3bd' },
]

function getDailyThemeIndex(date: Date) {
  const dayKey = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`)
  return (dayKey * 9301 + 49297) % lianpuThemes.length
}

const selectedLiyuanColor = ref(lianpuThemes[getDailyThemeIndex(new Date())].color)
const dailyLianpuTheme = computed(() => lianpuThemes.find((theme) => theme.color === selectedLiyuanColor.value) ?? lianpuThemes[0])

onMounted(async () => {
  const [openingsResult, materialsResult] = await Promise.allSettled([
    getTodayOpenings(),
    getLiyuanMaterials(dailyLianpuTheme.value.color),
  ])

  if (openingsResult.status === 'fulfilled' && openingsResult.value.length > 0) {
    todayOpenings.value = openingsResult.value
  } else if (openingsResult.status === 'rejected') {
    homeDataError.value = '首页数据暂时无法加载，请确认后台服务已经启动'
  }
  if (materialsResult.status === 'fulfilled') {
    liyuanMaterials.value = materialsResult.value
    if (materialsResult.value.colorCode) {
      selectedLiyuanColor.value = materialsResult.value.colorCode
    }
  }
})
</script>

<template>
  <main class="xiqu-page home-page">
    <section class="home-hero" aria-label="首页视觉">
      <img class="home-hero__image" :src="homeHeroUrl" alt="戏曲山水亭台视觉" />
      <div class="home-lunar-date" aria-label="今日阴历日期">
        <span>{{ lunarDate.year }}</span>
        <span>{{ lunarDate.date }}</span>
      </div>
    </section>

    <section class="today-opening" aria-labelledby="today-opening-title">
      <h1 id="today-opening-title" class="today-opening__title">今日开场</h1>
      <div class="today-opening__grid">
        <button
          v-for="item in todayOpenings"
          :key="item.id"
          :class="['opening-card', { 'opening-card--featured': item.featured }]"
          type="button"
          @click="goOpeningDetail(item.id)"
        >
          <img
            class="opening-card__image"
            :src="item.imageUrl || homeHeroUrl"
            :alt="item.title"
            @error="handleOpeningImageError"
          />
          <div class="opening-card__content">
            <p class="opening-card__title">{{ item.title }}</p>
            <p class="opening-card__meta">{{ item.startTime }} · {{ item.venue }}</p>
          </div>
          <span class="opening-card__button" :aria-label="`查看${item.title}`"><span aria-hidden="true" /></span>
        </button>
        <p v-if="todayOpenings.length === 0" class="today-opening__empty">
          {{ homeDataError || '今日暂无推荐剧目' }}
        </p>
      </div>
    </section>

    <section
      class="liyuan-color"
      :style="{
        '--liyuan-accent': dailyLianpuTheme.accent,
        '--liyuan-block': dailyLianpuTheme.block,
        '--liyuan-pale': dailyLianpuTheme.pale,
      }"
      aria-labelledby="liyuan-color-title"
    >
      <header class="liyuan-color__header">
        <h2 id="liyuan-color-title">梨园物色</h2>
        <button class="liyuan-color__more" type="button"><span>了解更多</span><span aria-hidden="true">›</span></button>
      </header>

      <div class="liyuan-color__symbol" :data-color="dailyLianpuTheme.color">
        <img :src="dailyLianpuTheme.liyuanImage" :alt="`${dailyLianpuTheme.label}色梨园物色`" />
      </div>

      <div class="liyuan-color__grid">
        <article class="liyuan-color__panel liyuan-color__panel--names">
          <h3>&gt;&gt;名角</h3>
          <div class="liyuan-color__name-grid" aria-label="名角资料">
            <figure v-for="item in liyuanMaterials.performers" :key="item.id" class="liyuan-color__material-card">
              <img :src="item.imageUrl" :alt="item.title" />
              <figcaption>{{ item.title }}</figcaption>
            </figure>
            <span v-for="index in Math.max(0, 2 - liyuanMaterials.performers.length)" :key="`performer-placeholder-${index}`" class="liyuan-color__placeholder" />
          </div>
        </article>

        <article class="liyuan-color__panel">
          <h3>&gt;&gt;衣裳</h3>
          <figure v-if="liyuanMaterials.costumes[0]" class="liyuan-color__material-card liyuan-color__material-card--tall">
            <img :src="liyuanMaterials.costumes[0].imageUrl" :alt="liyuanMaterials.costumes[0].title" />
            <figcaption>{{ liyuanMaterials.costumes[0].title }}</figcaption>
          </figure>
          <span v-else class="liyuan-color__placeholder liyuan-color__placeholder--tall" aria-label="暂无同色衣裳资料" />
        </article>

        <article class="liyuan-color__panel liyuan-color__panel--face">
          <h3>&gt;&gt;粉墨</h3>
          <img class="liyuan-color__face" :src="dailyLianpuTheme.faceImage" :alt="`${dailyLianpuTheme.label}色脸谱`" />
        </article>
      </div>
    </section>
  </main>
</template>
