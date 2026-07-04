<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getTodayOpenings, type OpeningItem } from '../api/home'
import homeHeroUrl from '../assets/images/home-hero.jpg'

const router = useRouter()

const fallbackOpenings: OpeningItem[] = [
  {
    id: 1,
    title: '春江花月夜',
    venue: '梨园小剧场',
    startTime: '19:30',
    imagePath: 'openings/today-opening-fan.png',
    imageUrl: 'http://127.0.0.1:8788/openings/today-opening-fan.png',
    featured: true,
  },
  {
    id: 2,
    title: '水袖折子戏',
    venue: '兰苑厅',
    startTime: '14:30',
    imagePath: 'openings/opening-water-sleeves.jpg',
    imageUrl: 'http://127.0.0.1:8788/openings/opening-water-sleeves.jpg',
  },
  {
    id: 3,
    title: '变脸火彩',
    venue: '锦绣戏台',
    startTime: '20:00',
    imagePath: 'openings/opening-fire.jpg',
    imageUrl: 'http://127.0.0.1:8788/openings/opening-fire.jpg',
  },
]

const todayOpenings = ref<OpeningItem[]>(fallbackOpenings)

function handleOpeningImageError(event: Event) {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement && image.src !== homeHeroUrl) {
    image.src = homeHeroUrl
  }
}

function goOpeningDetail(id: number) {
  router.push({ name: 'opening-detail', params: { id } })
}

const lunarDayMap = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
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
  const day = lunarDayMap[dayValue - 1] ?? `${dayValue}`

  return {
    year: `${yearName}年`,
    date: `${month}${day}`,
  }
}

const lunarDate = computed(() => formatLunarDate(new Date()))

onMounted(async () => {
  try {
    const items = await getTodayOpenings()
    if (items.length > 0) {
      todayOpenings.value = items
    }
  } catch {
    todayOpenings.value = fallbackOpenings
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
            v-if="item.featured"
            class="opening-card__image"
            :src="item.imageUrl"
            :alt="item.title"
            @error="handleOpeningImageError"
          />
          <div class="opening-card__content">
            <p class="opening-card__title">{{ item.title }}</p>
            <p class="opening-card__meta">{{ item.startTime }} · {{ item.venue }}</p>
          </div>
          <span class="opening-card__button" :aria-label="`查看${item.title}`">
            <span aria-hidden="true" />
          </span>
        </button>
      </div>
    </section>
  </main>
</template>
