# web 工程约束

本文件用于约束 Codex/Agent 在 `web/` 前端工程内的后续开发。除非用户明确要求调整架构，否则优先遵守这里的约定。

## 1. 工程边界

- 当前前端工程根目录是 `web/`，常用命令都应在 `/Users/guolimin/Desktop/project-git/github/xiqu/web` 下执行。
- 仓库根目录还包含 `README.md`、`api.md`、`agent/` 等内容；不要把它们误认为 Vite 应用入口。
- 构建产物位于 `web/dist`，不要手工编辑或提交构建产物，除非用户明确要求发布产物。
- 依赖和 lockfile 以 `web/package.json` 与 `web/pnpm-lock.yaml` 为准。

## 2. 技术栈与命令

- 技术栈：Vue 3、TypeScript、Vite、Vue Router、Pinia、Vant、Tailwind CSS v4。
- 包管理器：pnpm 10。
- 常用命令：
  - `pnpm dev`：启动 Vite，脚本绑定 `127.0.0.1`。
  - `pnpm typecheck`：执行 `vue-tsc -b`。
  - `pnpm build`：执行 `vue-tsc -b && vite build`。
  - `pnpm preview`：预览构建产物，脚本绑定 `127.0.0.1`。
- 修改 TypeScript/Vue/CSS 后，优先用 `pnpm build` 验证；若只需要快速类型检查，可用 `pnpm typecheck`。
- `vite.config.ts` 当前配置 `base: '/xiqu-agent/'`，生成静态资源路径时必须兼容该子路径部署，不要写死根路径 `/` 资源引用。

## 3. 代码风格与 TypeScript 约束

- 项目使用严格 TypeScript：`strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 都开启。
- 新增代码必须避免未使用变量、未使用 import、隐式 any 和不可达分支。
- Vue 单文件组件默认使用 `<script setup lang="ts">`。
- 资源图片应通过 ES import 引入，例如 `import imageUrl from '../assets/images/foo.png'`，避免在组件中硬编码 `/src/assets/...` 作为运行时展示路径。
- 保持改动小而聚焦，不做与当前需求无关的重构或格式化。

## 4. 路由与应用壳

- 路由集中在 `web/src/router/index.ts`。
- 页面标题由路由守卫写入 `document.title`，新增页面应配置 `meta.title`。
- 底部导航统一在 `web/src/App.vue` 管理。
- 需要隐藏底部导航的页面通过路由 `meta.showTabbar = false` 控制；当前登录页 `/login` 使用该方式。
- 当前主要路由：
  - `/`：`home`，首页/开台。
  - `/opera`：`opera`，搜戏/戏单。
  - `/stage`：`stage`，中间脸谱入口/戏台。
  - `/ticket`：`ticket`，练功/票务预留入口。
  - `/profile`：`profile`，我的。
  - `/login`：`login`，登录页且隐藏底部导航。

## 5. 视觉与布局约束

- 这是移动端优先的 H5 项目，页面主视觉宽度以 `30rem` / `max-w-md` 为基准。
- 全局核心视觉样式集中在 `web/src/styles/main.css`。
- 宣纸背景图使用 `web/src/assets/images/app-bg-texture.jpg`，通过 CSS 变量 `--xiqu-app-bg-image` 管理；原始素材 `app-bg.jpg` 底部含纯色横带，不应直接用于 repeat 铺底。
- 页面背景应保持统一：
  - 使用 `var(--xiqu-app-bg-image) center top / min(100%, 30rem) auto repeat`。
  - 不要使用 `cover` 拉大宣纸背景图。
  - 不要用大块纯色背景把宣纸纹理遮住。
  - `.app-shell` 应保持透明，让底层背景透出。
- 常规页面应使用 `.xiqu-page` 作为页面根 class，以继承统一背景和底部导航留白。
- 首页 `HomeView.vue` 的山水亭台图 `home-hero.jpg` 是内容视觉图，不等同于全局宣纸背景。
- 底部导航图标优先使用 `web/src/assets/nav/*.png` 透明图，不要换成 JPG 版本，除非用户明确要求。
- 底部导航的红色戏台栏、青绿色光晕、中间脸谱凸起是当前核心视觉特征，调整时要保持整体风格一致。

## 6. 登录与状态

- 当前登录接口是前端 Mock，实现在 `web/src/api/auth.ts`。
- 登录态由 Pinia store `web/src/stores/auth.ts` 管理，并持久化到 `localStorage` 的 `xiqu.auth`。
- Mock 手机号登录要求：手机号匹配 `^1[3-9]\d{9}$`，并勾选用户协议/隐私政策。
- 接入真实后端时应优先遵循根目录 `api.md` 的接口路径、请求参数和返回结构。
- 不要把真实 token、手机号测试数据或其它敏感信息写入仓库。

## 7. 样式体系

- Tailwind CSS v4 通过 `@import "tailwindcss";` 和 `@tailwindcss/vite` 接入。
- 可以在模板中使用 Tailwind 工具类；跨页面复用或核心视觉样式优先放到 `web/src/styles/main.css`。
- Vant 主题变量在 `:root` 中覆盖，例如 `--van-primary-color`。
- 页面局部强视觉可使用 scoped CSS，但不要重复定义与全局背景相冲突的整页背景规则。

## 8. 资源与素材

- 图片素材目录：
  - `web/src/assets/images`：首页、登录、我的页等视觉素材。
  - `web/src/assets/nav`：底部导航图标素材。
- 新增素材应放在语义清晰的目录中，并通过 import 使用，确保 Vite 能参与打包和路径重写。
- 注意图片体积，当前若新增大图，应尽量压缩后再提交。

## 9. 开发流程建议

- 修改前先确认当前工作树，避免把他人/用户已有改动误当成自己的改动处理。
- 不要随意回滚用户已有变更；如果发现无关变更，只报告并绕开。
- 新增页面时至少同步检查：
  - `web/src/router/index.ts`
  - `web/src/App.vue` 底部导航配置（如需要入口）
  - `README.md` 路由说明（如用户要求更新文档）
- 完成后报告具体改动文件和验证命令结果。
