<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import navTheaterUrl from './assets/nav/nav-theater.png'
import navOperaListUrl from './assets/nav/nav-opera-list.png'
import navMaskUrl from './assets/nav/nav-mask.png'
import navFlagsUrl from './assets/nav/nav-flags.png'
import navProfileUrl from './assets/nav/nav-profile.png'

const route = useRoute()
const router = useRouter()

const tabItems = [
  { name: 'home', label: '开台', image: navTheaterUrl },
  { name: 'opera', label: '搜戏', image: navOperaListUrl },
  { name: 'stage', label: '', image: navMaskUrl, featured: true, ariaLabel: '戏台' },
  { name: 'ticket', label: '练功', image: navFlagsUrl },
  { name: 'profile', label: '我的', image: navProfileUrl },
]

const activeTab = computed(() => (typeof route.name === 'string' ? route.name : 'home'))
const showTabbar = computed(() => route.meta.showTabbar !== false)

function goTab(name: string) {
  if (name !== route.name) {
    router.push({ name })
  }
}
</script>

<template>
  <div class="app-shell">
    <RouterView />

    <nav v-if="showTabbar" class="xiqu-bottom-nav" aria-label="底部导航">
      <div class="xiqu-bottom-nav__bar">
        <span class="xiqu-bottom-nav__base" aria-hidden="true" />
        <button
          v-for="item in tabItems"
          :key="item.name"
          :class="[
            'xiqu-bottom-nav__item',
            { 'is-active': activeTab === item.name, 'is-featured': item.featured },
          ]"
          type="button"
          :aria-label="item.ariaLabel ?? item.label"
          @click="goTab(item.name)"
        >
          <span class="xiqu-bottom-nav__halo" aria-hidden="true" />
          <span class="xiqu-bottom-nav__icon-wrap">
            <img class="xiqu-bottom-nav__icon" :src="item.image" :alt="item.ariaLabel ?? item.label" />
          </span>
          <span v-if="item.label" class="xiqu-bottom-nav__label">{{ item.label }}</span>
        </button>
      </div>
    </nav>
  </div>
</template>
