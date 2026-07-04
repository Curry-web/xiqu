# xiqu server

独立 API 后台，使用 Node.js + Fastify + Prisma，连接远程 PostgreSQL。前端 `web/` 只请求这个服务，不直连数据库。

## 本地配置

```powershell
cd D:\xiqu\server
Copy-Item .env.example .env
```

把 `.env` 里的 `DATABASE_URL` 改成你的远程 PostgreSQL 连接串：

```env
DATABASE_URL="postgresql://xiqu:你的密码@1.95.87.192:3002/xiqu?schema=public"
SERVER_PORT="8788"
```

不要把真实 `.env` 提交到 Git。

## 初始化数据库

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:push
pnpm seed
```

`prisma:push` 会按 `prisma/schema.prisma` 在远程库创建这些表：

- `users`：登录用户。
- `home_openings`：首页“今日开场”数据。
- `operas`：剧目数据。
- `practice_records`：练功记录。
- `recording_uploads`：录音上传记录。

## 启动

```powershell
pnpm dev
```

默认地址：

```text
http://127.0.0.1:8788
```

健康检查：

```text
GET /api/health
```

## 图片和录音放哪

首页固定素材可以放在：

```text
web/public/openings
```

数据库里存相对路径，例如：

```text
openings/today-opening-fan.jpg
```

用户上传的录音由 server 接收，保存到：

```text
server/uploads/recordings
```

数据库 `recording_uploads.file_path` 会保存：

```text
uploads/recordings/xxx.m4a
```
