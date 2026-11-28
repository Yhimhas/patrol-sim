"""应用入口：创建仿真单例、注册 API 路由并托管前端静态页面。

本地启动（项目根目录）：

    uvicorn app.main:app --app-dir backend --reload --port 8000
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api.routes import create_router
from .simulator.simulator import Simulator


class NoCacheStaticFiles(StaticFiles):
    """静态资源不缓存，保证代码更新后浏览器拿到最新页面与脚本。"""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store"
        return response

# backend/app/main.py → 向上三级到项目根目录，再定位 frontend/
BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"


def create_app() -> FastAPI:
    app = FastAPI(title="智能巡检机器人二维仿真系统", docs_url="/api/docs", openapi_url="/api/openapi.json")
    sim = Simulator()
    app.state.simulator = sim
    app.include_router(create_router(sim))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "invalid_request", "message": "请求 JSON 或参数有误"}},
        )

    # 静态资源兜底：API 路由已先注册，未匹配 API 的路径由前端静态目录处理。
    app.mount("/", NoCacheStaticFiles(directory=FRONTEND_DIR, html=True), name="static")
    return app


app = create_app()
