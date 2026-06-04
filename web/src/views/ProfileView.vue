<script setup lang="ts">
import profileAvatarUrl from '../assets/images/profile-avatar.png'

const stats = [
  { value: '17', unit: '天', label: '已打卡' },
  { value: '126', unit: '分钟', label: '已学习' },
  { value: '3', unit: '枚', label: '践迹佩' },
]

const boxes = [
  { title: '青衣入门', color: '#3f8b82' },
  { title: '身段练习', color: '#dfc3bd' },
  { title: '名段鉴赏', color: '#9c747b' },
]

const favorites = [
  { title: '梨园旧影', color: '#afc1bd' },
  { title: '昆曲雅集', color: '#3f8b82' },
  { title: '梅派唱腔', color: '#dfc3bd' },
]
</script>

<template>
  <main class="profile-page" aria-label="我的页面">
    <section class="profile-hero">
      <div class="profile-hero__pine" aria-hidden="true" />

      <div class="profile-card">
        <img class="profile-card__avatar" :src="profileAvatarUrl" alt="京剧头像" />
        <div class="profile-card__name-wrap">
          <h1 class="profile-card__name">曲 曲</h1>
          <p class="profile-card__tag">初入梨园</p>
        </div>
        <button class="profile-card__checkin" type="button">今日打卡</button>
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
        <div class="profile-grid" aria-label="我的戏箱">
          <article v-for="item in boxes" :key="item.title" class="profile-tile" :style="{ '--tile-color': item.color }">
            <span>{{ item.title }}</span>
          </article>
        </div>
      </div>

      <div class="profile-divider" aria-hidden="true" />

      <div class="profile-section">
        <h2>我的收藏</h2>
        <div class="profile-grid" aria-label="我的收藏">
          <article v-for="item in favorites" :key="item.title" class="profile-tile" :style="{ '--tile-color': item.color }">
            <span>{{ item.title }}</span>
          </article>
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
    linear-gradient(180deg, rgb(194 58 67 / 0.86) 0%, rgb(196 73 82 / 0.68) 20%, rgb(70 139 132 / 0.64) 37%, transparent 43%),
    var(--xiqu-app-bg-image) center top / cover no-repeat,
    #f3ecd4;
  font-family: "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif;
}

.profile-page::before {
  position: absolute;
  inset: 0;
  content: "";
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 12%, rgb(255 255 255 / 0.2), transparent 22%),
    linear-gradient(180deg, transparent 0 88%, rgb(191 51 59 / 0.92) 96% 100%);
  mix-blend-mode: soft-light;
}

.profile-hero {
  position: relative;
  max-width: 30rem;
  margin: 0 auto;
  padding: clamp(6.6rem, 22vw, 8rem) 1.7rem 1.4rem;
}

.profile-hero__pine {
  position: absolute;
  top: -1.5rem;
  right: -5.5rem;
  width: 21rem;
  height: 13rem;
  opacity: 0.42;
  background:
    radial-gradient(ellipse at 18% 42%, transparent 0 42%, #f6a26f 43% 47%, transparent 48%),
    radial-gradient(ellipse at 38% 22%, transparent 0 42%, #f6a26f 43% 47%, transparent 48%),
    radial-gradient(ellipse at 58% 38%, transparent 0 42%, #f6a26f 43% 47%, transparent 48%),
    linear-gradient(145deg, transparent 0 42%, #f6a26f 43% 46%, transparent 47%),
    linear-gradient(165deg, transparent 0 47%, #f6a26f 48% 51%, transparent 52%);
  transform: rotate(-9deg);
}

.profile-card {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 4.95rem 1fr auto;
  gap: 1rem;
  align-items: center;
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
  min-width: 6.5rem;
  min-height: 2.95rem;
  padding: 0.36rem 0.8rem;
  color: #22948c;
  background: #fff7d9;
  border: 0.22rem solid #2ca9a2;
  border-radius: 999px;
  box-shadow: 0 0.16rem 0 rgb(25 91 87 / 0.12);
  font: inherit;
  font-size: 1.32rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 3.2rem 0 0;
  color: #fffbe3;
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
  margin: 1.35rem auto 0;
  padding: 2.2rem 1.7rem 3rem;
  background:
    linear-gradient(180deg, rgb(255 252 222 / 0.78), rgb(255 252 222 / 0.88)),
    var(--xiqu-app-bg-image) center top / cover no-repeat;
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

@media (max-width: 380px) {
  .profile-hero,
  .profile-content {
    padding-right: 1.35rem;
    padding-left: 1.35rem;
  }

  .profile-card {
    grid-template-columns: 4.4rem 1fr;
  }

  .profile-card__avatar {
    width: 4.4rem;
    height: 4.4rem;
  }

  .profile-card__checkin {
    grid-column: 2;
    justify-self: start;
    min-height: 2.35rem;
    font-size: 1.12rem;
  }

  .profile-grid {
    gap: 1.25rem;
  }
}
</style>
