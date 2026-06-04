# 戏曲网站 API 约定

本文档记录前端当前 mock 的后台接口，后续开发 `server` 时按这里的路径、参数和返回结构实现即可。

## 通用约定

- Base URL：`/api`
- 请求格式：`application/json`
- 返回格式：`application/json`
- 鉴权方式：登录后前端在请求头携带：

```http
Authorization: Bearer <accessToken>
```

## 1. 手机号直接登录

### 接口

```http
POST /api/auth/phone-login
```

### 说明

用于登录页的手机号登录。当前前端先用 mock 实现：用户输入手机号并勾选协议后，直接生成登录态并进入首页。

后续如果需要短信验证码，可在此接口前增加发送验证码和验证码校验流程。

### 请求参数

```json
{
  "loginType": "phone",
  "phone": "13700003812",
  "agreedPolicyVersion": "2026-06-03",
  "agreedPrivacyVersion": "2026-06-03",
  "device": {
    "platform": "web",
    "userAgent": "Mozilla/5.0 ..."
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `loginType` | string | 是 | 固定为 `phone` |
| `phone` | string | 是 | 用户输入的 11 位手机号 |
| `agreedPolicyVersion` | string | 是 | 用户同意的用户协议版本 |
| `agreedPrivacyVersion` | string | 是 | 用户同意的隐私政策版本 |
| `device.platform` | string | 是 | 当前为 `web` |
| `device.userAgent` | string | 是 | 浏览器 UA，便于后台做风控和日志 |

### 成功返回

```json
{
  "accessToken": "mock_access_token_xiqu",
  "refreshToken": "mock_refresh_token_xiqu",
  "expiresIn": 604800,
  "user": {
    "id": "mock-user-3812",
    "nickname": "戏曲爱好者",
    "phone": "13700003812",
    "maskedPhone": "137****3812",
    "avatarUrl": "/src/assets/images/login-avatar-cropped.jpg"
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `accessToken` | string | 访问令牌 |
| `refreshToken` | string | 刷新令牌 |
| `expiresIn` | number | access token 有效期，单位秒 |
| `user.id` | string | 用户 ID |
| `user.nickname` | string | 用户昵称 |
| `user.phone` | string | 手机号 |
| `user.maskedPhone` | string | 脱敏手机号 |
| `user.avatarUrl` | string | 用户头像地址 |

### 错误返回

```json
{
  "code": "PHONE_INVALID",
  "message": "请输入正确的手机号"
}
```

建议错误码：

| 错误码 | 说明 |
| --- | --- |
| `PHONE_REQUIRED` | 缺少手机号 |
| `PHONE_INVALID` | 手机号格式不正确 |
| `POLICY_NOT_AGREED` | 未同意用户协议或隐私政策 |
| `USER_DISABLED` | 用户被禁用 |

## 2. 退出登录

### 接口

```http
POST /api/auth/logout
```

### 请求头

```http
Authorization: Bearer <accessToken>
```

### 成功返回

```json
{
  "success": true
}
```

前端当前退出登录只会清除本地 `localStorage` 登录态；后台接入后可调用该接口使 token 失效。
