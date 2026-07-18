# 戏曲 Python 声学评分服务

该服务由 Node.js 后台在本机调用，负责示范唱段与用户录音的声学比对。

## 创建 Conda 环境

```powershell
cd D:\xiqu
conda env create -f scoring-service\environment.yml
```

## 启动

```powershell
cd D:\xiqu
conda run -n xiqu-score uvicorn app.main:app --app-dir scoring-service --host 127.0.0.1 --port 8790
```

健康检查：`http://127.0.0.1:8790/health`

评分使用 pYIN 提取基频、DTW 对齐旋律，并比较音准、旋律走向、时值、颤音、音色频谱和音量包络。腾讯云唱词分仍由 Node.js 获取，并在最终综合分中占 10%。

