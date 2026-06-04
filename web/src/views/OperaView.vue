<script setup lang="ts">
const operaList = [
  { title: '牡丹亭', genre: '昆曲', tag: '梦境美学', time: '今晚 19:30' },
  { title: '霸王别姬', genre: '京剧', tag: '经典名段', time: '明日 20:00' },
  { title: '梁祝', genre: '越剧', tag: '江南雅韵', time: '周六 19:00' },
]
</script>

<template>
  <main class="xiqu-page">
    <section class="mx-auto max-w-md px-5 pb-8 pt-8">
      <p class="text-xs font-medium tracking-[0.3em] text-red-900">OPERA LIST</p>
      <h1 class="mt-2 text-3xl font-semibold">今日戏单</h1>
      <p class="mt-3 text-sm leading-6 text-stone-600">浏览近期上演剧目，后续可接入搜索、分类筛选和剧目详情。</p>

      <div class="mt-6 space-y-3">
        <article v-for="item in operaList" :key="item.title" class="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-red-950/5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="rounded-full bg-red-100 px-3 py-1 text-xs text-red-900">{{ item.genre }}</span>
              <h2 class="mt-3 text-xl font-semibold">{{ item.title }}</h2>
              <p class="mt-2 text-sm text-stone-500">{{ item.tag }}</p>
            </div>
            <time class="whitespace-nowrap text-sm font-medium text-amber-700">{{ item.time }}</time>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
