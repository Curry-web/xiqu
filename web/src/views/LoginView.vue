<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { phoneLogin } from '../api/auth'
import loginAvatarUrl from '../assets/images/login-avatar-cropped.jpg'
import loginBgUrl from '../assets/images/login-bg.jpg'
import { useAuthStore } from '../stores/auth'

const phone = ref('')
const agreed = ref(false)
const loading = ref(false)
const router = useRouter()
const authStore = useAuthStore()

async function submitLogin() {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    showToast('请输入正确的手机号')
    return
  }

  if (!agreed.value) {
    showToast('请先阅读并同意用户协议和隐私政策')
    return
  }

  loading.value = true

  try {
    const session = await phoneLogin({
      loginType: 'phone',
      phone: phone.value,
      agreedPolicyVersion: '2026-06-03',
      agreedPrivacyVersion: '2026-06-03',
      device: {
        platform: 'web',
        userAgent: window.navigator.userAgent,
      },
    })

    authStore.setLoginSession(session)
    showToast('登录成功')
    await router.replace('/')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main
    class="min-h-screen text-[#1f2422]"
    style="background: var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat, var(--xiqu-app-bg-color)"
  >
    <section
      class="mx-auto flex min-h-screen w-full max-w-md flex-col items-center overflow-hidden bg-cover bg-center px-8 pt-[29vh]"
      :style="{ backgroundColor: 'var(--xiqu-app-bg-color)', backgroundImage: `url(${loginBgUrl})` }"
    >
      <img class="h-36 w-36 rounded-full object-cover" :src="loginAvatarUrl" alt="戏曲头像" />

      <input
        v-model="phone"
        class="mt-8 w-full bg-transparent text-center font-serif tracking-[0.03em] text-[#1c2422] outline-none placeholder:text-[#1c2422]/45"
        inputmode="numeric"
        maxlength="11"
        placeholder="请输入手机号"
        style="font-size: 32px"
        type="tel"
      />

      <van-button
        class="mt-8 !h-14 w-full max-w-[18.75rem] !rounded-[1.05rem] !border-[#d8d8d8] !bg-white/95 !font-serif !text-[1.35rem] !tracking-[0.26em] !text-[#b24a58] shadow-[0_2px_0_rgba(0,0,0,0.18),0_8px_18px_rgba(0,0,0,0.06)]"
        native-type="button"
        plain
        :loading="loading"
        loading-text="正在登录"
        @click="submitLogin"
      >
        手机号登录
      </van-button>

      <label class="mt-7 flex items-center gap-2 text-[1rem] font-medium tracking-[0.12em] text-[#1f2422]">
        <input
          v-model="agreed"
          class="h-4 w-4 appearance-none rounded-full border-2 border-[#1f2422] bg-transparent checked:border-[#16706f] checked:bg-[#16706f]"
          type="checkbox"
        />
        <span>
          阅读并同意
          <a class="font-semibold text-[#16706f]" href="javascript:void(0)">《用户协议》</a>
          和
          <a class="font-semibold text-[#16706f]" href="javascript:void(0)">《隐私政策》</a>
        </span>
      </label>
    </section>
  </main>
</template>
