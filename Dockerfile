# ---------- 阶段 1：构建前端（Vue + Vite） ----------
FROM node:24-alpine AS web
WORKDIR /web
ARG NPM_REGISTRY=https://registry.npmmirror.com
COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set registry $NPM_REGISTRY && npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 阶段 2：运行后端（FastAPI） ----------
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist ./static
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
