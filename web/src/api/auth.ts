export interface PhoneLoginRequest {
  loginType: 'phone'
  phone: string
  agreedPolicyVersion: string
  agreedPrivacyVersion: string
  device: {
    platform: 'web'
    userAgent: string
  }
}

export interface AuthUser {
  id: string
  nickname: string
  phone: string
  maskedPhone: string
  avatarUrl: string
}

export interface PhoneLoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

export async function phoneLogin(request: PhoneLoginRequest): Promise<PhoneLoginResponse> {
  await delay(600)

  if (!/^1[3-9]\d{9}$/.test(request.phone)) {
    throw new Error('请输入正确的手机号')
  }

  const user: AuthUser = {
    id: `mock-user-${request.phone.slice(-4)}`,
    nickname: '戏曲爱好者',
    phone: request.phone,
    maskedPhone: maskPhone(request.phone),
    avatarUrl: '/src/assets/images/login-avatar-cropped.jpg',
  }

  return {
    accessToken: 'mock_access_token_xiqu',
    refreshToken: 'mock_refresh_token_xiqu',
    expiresIn: 7 * 24 * 60 * 60,
    user,
  }
}
