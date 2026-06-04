# xiqu

戏曲主题移动端网站。项目以移动端体验为主，围绕「首页视觉、戏曲导航、登录、戏单、练功、我的」等核心入口搭建，用国风插画、宣纸纹理、戏曲图标和底部戏台式导航形成统一视觉风格。

## 项目概览

- **项目名称**：xiqu
- **项目类型**：移动端 Web / H5
- **当前阶段**：前端静态页面与 Mock 登录逻辑
- **主要入口**：`web/`
- **包管理器**：pnpm 10
- **技术栈**：Vue 3 + TypeScript + Vite + Tailwind CSS + Vant + Pinia + Vue Router

## 已实现功能

### 1. 首页

- 使用戏曲山水亭台视觉图作为首页上半部分。
- 使用宣纸纹理 `app-bg.jpg` 作为页面底层背景。
- 首页叠加当前阴历日期，日期通过浏览器 `Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese')` 自动计算。
- 顶部视觉图底部带圆角，衔接下方宣纸背景。

### 2. 底部导航栏

底部导航参照戏曲风格设计实现：

- 红色横幅底栏。
- 中间脸谱图标凸起。
- 左右弧形收口。
- 图标带青绿色光晕。
- 四个可见文字入口：
  - 开台
  - 搜戏
  - 练功
  - 我的
- 中间脸谱入口保留为主入口，仅提供无障碍名称「戏台」。

### 3. 登录页

- 手机号输入。
- 用户协议 / 隐私政策勾选。
- Mock 手机号登录。
- 登录态写入 `localStorage`。
- 登录页隐藏底部导航。

### 4. 其他页面骨架

- 戏单页：展示剧目列表入口。
- 票务 / 练功页：预留练功、预约、票务等模块。
- 戏台页：中间脸谱入口对应的核心页面。
- 我的页：用户信息、打卡、学习统计、收藏等视觉模块。

## 路由说明

| 路径 | 路由名 | 页面 | 说明 |
| --- | --- | --- | --- |
| `/` | `home` | `HomeView.vue` | 首页 / 开台 |
| `/opera` | `opera` | `OperaView.vue` | 搜戏 / 戏单 |
| `/stage` | `stage` | `StageView.vue` | 中间脸谱入口 / 戏台 |
| `/ticket` | `ticket` | `TicketView.vue` | 练功 / 票务预留入口 |
| `/profile` | `profile` | `ProfileView.vue` | 我的 |
| `/login` | `login` | `LoginView.vue` | 手机号登录，隐藏底部导航 |

## 技术栈

| 技术 | 用途 |
| --- | --- |
| Vue 3 | 页面和组件开发 |
| TypeScript | 类型约束 |
| Vite | 开发服务器与构建工具 |
| Vue Router | 页面路由 |
| Pinia | 登录态管理 |
| Vant | 移动端基础组件 |
| Tailwind CSS | 工具类样式 |
| pnpm workspace | 根项目与前端子包管理 |

## 目录结构

```text
.
├── README.md
├── api.md                         # 后端接口约定文档
├── package.json                   # 根项目脚本
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── web
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tsconfig.app.json
    └── src
        ├── App.vue                # 应用壳与底部导航
        ├── main.ts                # Vue 应用入口
        ├── api
        │   └── auth.ts            # Mock 登录接口
        ├── assets
        │   ├── images             # 首页、登录、我的页等视觉素材
        │   └── nav                # 底部导航图标素材
        ├── router
        │   └── index.ts           # 路由配置
        ├── stores
        │   └── auth.ts            # Pinia 登录态
        ├── styles
        │   └── main.css           # 全局样式与核心视觉样式
        └── views
            ├── HomeView.vue
            ├── LoginView.vue
            ├── OperaView.vue
            ├── ProfileView.vue
            ├── StageView.vue
            └── TicketView.vue
```

## 本地开发

### 环境要求

- Node.js：建议 20+
- pnpm：项目声明使用 `pnpm@10.0.0`

### 安装依赖

```bash
pnpm install
```

### 启动开发服务

```bash
pnpm dev
```

默认启动前端 Vite 服务：

```text
http://127.0.0.1:5173
```

如端口被占用，请以终端输出为准。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务 |
| `pnpm typecheck` | 执行 TypeScript / Vue 类型检查 |
| `pnpm build` | 构建生产包 |
| `pnpm preview` | 本地预览生产构建产物 |

## 构建发布

执行：

```bash
pnpm build
```

构建产物位于：

```text
web/dist
```

仓库 `.gitignore` 已忽略 `dist`、`node_modules`、`.pnpm-store`、`*.tsbuildinfo` 等本地构建或依赖产物。

## 登录与接口说明

当前登录接口为前端 Mock，接口约定见：

```text
api.md
```

当前 Mock 登录流程：

1. 用户输入手机号。
2. 勾选用户协议与隐私政策。
3. 调用 `phoneLogin()`。
4. 生成 mock token 和 mock 用户信息。
5. 登录态保存到 `localStorage` 的 `xiqu.auth`。

后续接入真实后端时，可按照 `api.md` 中的接口路径和参数实现服务端接口。

## 视觉素材说明

主要素材位置：

```text
web/src/assets/images
web/src/assets/nav
```

说明：

- `home-hero.jpg`：首页上半部分山水亭台视觉。
- `app-bg.jpg`：宣纸质感背景，用于页面底层铺底。
- `login-bg.jpg`、`login-avatar*.jpg`：登录页视觉素材。
- `profile-*.png`：我的页视觉素材。
- `nav-*.png`：底部导航透明图标。
- `nav-*.jpg`：底部导航原始图标素材备份。

底部导航图标建议优先使用透明 PNG，因为 JPG 不支持透明背景。

## 开发约定

- 移动端优先，页面最大宽度以 `30rem` 左右为视觉参考。
- 全局视觉样式主要集中在 `web/src/styles/main.css`。
- 底部导航由 `web/src/App.vue` 统一管理。
- 登录页通过路由 `meta.showTabbar = false` 隐藏底部导航。
- 页面标题通过路由守卫写入 `document.title`。
- 新增页面时建议同步更新：
  - `web/src/router/index.ts`
  - `web/src/App.vue` 中的导航配置，如需要
  - 本 README 的路由说明，如需要

## 后续可扩展方向

- 接入真实手机号登录 / 短信验证码。
- 完善搜戏页：搜索、分类、剧目详情。
- 完善练功页：课程、打卡、身段训练、唱腔练习。
- 完善戏台页：推荐内容、直播、沉浸式剧场。
- 完善我的页：用户资料、收藏、订单、学习记录。
- 增加真实 API 服务端。
- 增加移动端真机适配测试。

## 许可证

本项目根目录包含 `LICENSE`，请以该文件为准。
