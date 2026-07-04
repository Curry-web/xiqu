<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import aiFansUrl from '../assets/images/onboarding-ai-fans.png'
import arrowActiveUrl from '../assets/images/onboarding-arrow-active.png'
import arrowIdleUrl from '../assets/images/onboarding-arrow-idle.png'
import libraryBoxesUrl from '../assets/images/onboarding-library-boxes.png'
import practicePendantUrl from '../assets/images/onboarding-practice-pendant.png'

const ONBOARDING_STORAGE_KEY = 'xiqu.onboarding.seen'

const router = useRouter()
const scrollerRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)
const isDragging = ref(false)

let dragStartX = 0
let dragStartScrollLeft = 0
let scrollFrame = 0

const slides = [
  {
    label: 'AI智能解惑',
    title: '智解戏韵',
    subtitle: 'AI检索戏曲疑难，快速答疑',
    image: aiFansUrl,
    imageClass: 'onboarding-slide__art--fans',
  },
  {
    label: '曲库素材典藏',
    title: '曲藏万象',
    subtitle: '分类搜寻，收录图文戏文',
    image: libraryBoxesUrl,
    imageClass: 'onboarding-slide__art--boxes',
  },
  {
    label: '练戏打卡集章',
    title: '习曲集佩',
    subtitle: '练戏打卡，收集戏曲佩饰',
    image: practicePendantUrl,
    imageClass: 'onboarding-slide__art--pendant',
  },
]

function finishOnboarding() {
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  router.replace({ name: 'login' })
}

function scrollToSlide(index: number) {
  const scroller = scrollerRef.value
  const nextIndex = Math.min(Math.max(index, 0), slides.length - 1)
  activeIndex.value = nextIndex

  if (!scroller) {
    return
  }

  scroller.scrollTo({
    left: nextIndex * scroller.clientWidth,
    behavior: 'smooth',
  })
}

function handleIndicatorClick(index: number) {
  if (index === slides.length - 1 && activeIndex.value === slides.length - 1) {
    finishOnboarding()
    return
  }

  scrollToSlide(index)
}

function handleScroll() {
  const scroller = scrollerRef.value

  if (!scroller) {
    return
  }

  window.cancelAnimationFrame(scrollFrame)
  scrollFrame = window.requestAnimationFrame(() => {
    activeIndex.value = Math.round(scroller.scrollLeft / scroller.clientWidth)
  })
}

function handlePointerDown(event: PointerEvent) {
  const scroller = scrollerRef.value

  if (!scroller) {
    return
  }

  isDragging.value = true
  dragStartX = event.clientX
  dragStartScrollLeft = scroller.scrollLeft
  scroller.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  const scroller = scrollerRef.value

  if (!scroller || !isDragging.value) {
    return
  }

  scroller.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX)
}

function handlePointerUp(event: PointerEvent) {
  const scroller = scrollerRef.value

  if (!scroller || !isDragging.value) {
    return
  }

  isDragging.value = false
  scroller.releasePointerCapture(event.pointerId)
  scrollToSlide(Math.round(scroller.scrollLeft / scroller.clientWidth))
}
</script>

<template>
  <main class="onboarding-page">
    <section class="onboarding-shell" aria-label="启动介绍">
      <div
        ref="scrollerRef"
        class="onboarding-scroller"
        :class="{ 'is-dragging': isDragging }"
        @scroll.passive="handleScroll"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
      >
        <article
          v-for="slide in slides"
          :key="slide.label"
          class="onboarding-slide"
          :aria-label="slide.label"
        >
          <div class="onboarding-slide__copy">
            <h1>{{ slide.title }}</h1>
            <p>{{ slide.subtitle }}</p>
          </div>

          <img
            class="onboarding-slide__art"
            :class="slide.imageClass"
            :src="slide.image"
            :alt="slide.label"
            draggable="false"
          />
        </article>
      </div>

      <nav
        class="onboarding-indicators"
        :class="`is-slide-${activeIndex}`"
        aria-label="启动页切换"
      >
        <button
          v-for="(slide, index) in slides"
          :key="slide.label"
          class="onboarding-indicators__item"
          type="button"
          :aria-label="slide.label"
          :aria-current="activeIndex === index ? 'step' : undefined"
          @click="handleIndicatorClick(index)"
        >
          <img :src="activeIndex === index ? arrowActiveUrl : arrowIdleUrl" alt="" aria-hidden="true" />
        </button>
      </nav>

      <button
        v-if="activeIndex === slides.length - 1"
        class="onboarding-enter"
        type="button"
        @click="finishOnboarding"
      >
        点击进入
      </button>
    </section>
  </main>
</template>

<style scoped>
.onboarding-page {
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  background: #f0b0a3;
}

.onboarding-shell {
  position: relative;
  width: min(100%, 30rem);
  height: 100vh;
  height: 100svh;
  margin: 0 auto;
  overflow: hidden;
  background: #f0b0a3;
}

.onboarding-shell::after {
  position: absolute;
  inset: 0;
  z-index: 4;
  content: "";
  pointer-events: none;
  background:
    linear-gradient(rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.035)),
    radial-gradient(circle at 24% 18%, rgb(43 91 84 / 0.13) 0 0.04rem, transparent 0.055rem),
    radial-gradient(circle at 68% 34%, rgb(43 91 84 / 0.11) 0 0.035rem, transparent 0.05rem);
  background-size: auto, 2.6rem 3.1rem, 3.3rem 2.8rem;
  mix-blend-mode: multiply;
  opacity: 0.45;
}

.onboarding-scroller {
  display: flex;
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  cursor: grab;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  touch-action: pan-x;
  -webkit-overflow-scrolling: touch;
}

.onboarding-scroller::-webkit-scrollbar {
  display: none;
}

.onboarding-scroller.is-dragging {
  cursor: grabbing;
  scroll-behavior: auto;
}

.onboarding-slide {
  position: relative;
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
  overflow: hidden;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  background:
    radial-gradient(circle at 50% 53%, rgb(255 250 214 / 0.42), transparent 30%),
    linear-gradient(180deg, #00766d 0%, #1e958c 34%, #d8d8be 63%, #eea196 100%);
}

.onboarding-slide__copy {
  position: relative;
  z-index: 2;
  padding: clamp(4.25rem, 9.5vh, 6.4rem) 1.5rem 0;
  text-align: center;
  color: #fff8dc;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  text-shadow: 0 0.08rem 0.16rem rgb(0 59 55 / 0.22);
}

.onboarding-slide__copy h1 {
  margin: 0;
  font-size: clamp(2.9rem, 13vw, 4.25rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: 0;
}

.onboarding-slide__copy p {
  margin: 1.55rem 0 0;
  font-size: clamp(1.08rem, 4.8vw, 1.5rem);
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: 0.12em;
}

.onboarding-slide__art {
  position: absolute;
  left: 50%;
  z-index: 1;
  display: block;
  max-width: 26.5rem;
  height: auto;
  transform: translateX(-50%);
  user-select: none;
  pointer-events: none;
}

.onboarding-slide__art--fans {
  top: clamp(11.7rem, 25vh, 15rem);
  width: 82%;
}

.onboarding-slide__art--boxes {
  top: clamp(3.8rem, 8vh, 5.4rem);
  width: 80%;
}

.onboarding-slide__art--pendant {
  top: clamp(10.9rem, 23vh, 14rem);
  width: 78%;
}

.onboarding-indicators {
  position: absolute;
  bottom: clamp(2.8rem, 5.6vh, 3.9rem);
  left: 50%;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.3rem, 1.4vw, 0.58rem);
  transform: translateX(-50%);
}

.onboarding-indicators.is-slide-2 {
  bottom: clamp(5.25rem, 9.2vh, 6.4rem);
}

.onboarding-indicators.is-slide-1 {
  bottom: clamp(1.75rem, 3.6vh, 2.7rem);
}

.onboarding-indicators__item {
  display: grid;
  width: clamp(1.82rem, 6.6vw, 2.34rem);
  height: clamp(1.82rem, 6.6vw, 2.34rem);
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
}

.onboarding-indicators__item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0.04rem 0.08rem rgb(93 55 49 / 0.16));
}

.onboarding-enter {
  position: absolute;
  right: 50%;
  bottom: clamp(0.28rem, 0.85vh, 0.58rem);
  z-index: 9;
  min-width: clamp(10.8rem, 43vw, 13.4rem);
  padding: 0.46rem 1.35rem 0.58rem;
  border: 0.08rem solid rgb(255 255 255 / 0.94);
  border-radius: 0.72rem;
  background: rgb(255 255 255 / 0.96);
  color: #42aaa2;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
  font-size: clamp(1.65rem, 7vw, 2.18rem);
  font-weight: 700;
  line-height: 1;
  box-shadow:
    0 0 0.72rem rgb(57 199 190 / 0.82),
    0 0.2rem 0.45rem rgb(41 100 96 / 0.2);
  transform: translateX(50%);
}

@media (max-height: 760px) {
  .onboarding-slide__copy {
    padding-top: 3.7rem;
  }

  .onboarding-slide__copy p {
    margin-top: 0.85rem;
  }

  .onboarding-slide__art--fans {
    top: 9.2rem;
    width: 68%;
  }

  .onboarding-slide__art--boxes {
    top: 3.2rem;
    width: 64%;
  }

  .onboarding-slide__art--pendant {
    top: 9rem;
    width: 68%;
  }

  .onboarding-indicators {
    bottom: 2.65rem;
  }

  .onboarding-indicators.is-slide-2 {
    bottom: 4.9rem;
  }

  .onboarding-indicators.is-slide-1 {
    bottom: 1.65rem;
  }
}
</style>
