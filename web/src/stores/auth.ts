import { defineStore } from 'pinia'
import type { AuthUser, PhoneLoginResponse } from '../api/auth'

const AUTH_STORAGE_KEY = 'xiqu.auth'

interface AuthState {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: AuthUser | null
}

function getInitialState(): AuthState {
  const fallback: AuthState = {
    accessToken: '',
    refreshToken: '',
    expiresAt: 0,
    user: null,
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return fallback
    }

    return {
      ...fallback,
      ...JSON.parse(raw),
    }
  } catch {
    return fallback
  }
}

export const useAuthStore = defineStore('auth', {
  state: getInitialState,
  getters: {
    isLoggedIn: (state) => Boolean(state.accessToken && state.user && state.expiresAt > Date.now()),
  },
  actions: {
    setLoginSession(session: PhoneLoginResponse) {
      this.accessToken = session.accessToken
      this.refreshToken = session.refreshToken
      this.expiresAt = Date.now() + session.expiresIn * 1000
      this.user = session.user
      this.persist()
    },
    logout() {
      this.accessToken = ''
      this.refreshToken = ''
      this.expiresAt = 0
      this.user = null
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    },
    persist() {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt,
          user: this.user,
        }),
      )
    },
  },
})
