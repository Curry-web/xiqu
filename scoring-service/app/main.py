from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .scoring import score_singing


class ScoreRequest(BaseModel):
    reference_path: str = Field(min_length=1)
    attempt_path: str = Field(min_length=1)


app = FastAPI(title="Xiqu Acoustic Scoring", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "librosa-pyin-dtw"}


@app.post("/score")
def score(request: ScoreRequest) -> dict:
    reference_path = Path(request.reference_path).resolve()
    attempt_path = Path(request.attempt_path).resolve()

    if not reference_path.is_file():
        raise HTTPException(status_code=400, detail="示范唱段文件不存在")
    if not attempt_path.is_file():
        raise HTTPException(status_code=400, detail="用户录音文件不存在")

    try:
        return score_singing(reference_path, attempt_path)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Python 声学评分失败：{error}") from error

