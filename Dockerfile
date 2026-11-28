# 运行阶段：复用本机已安装的 node_modules（纯 JS 运行时依赖；
# 私有缓存包在公网镜像源上存在校验不一致问题，不在容器内重新 npm ci）
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3000 \
    FORCE_FRAMEWORK_DISABLE_DATAPASS=true \
    FORCE_AUTHN_INNERAPI_DOMAIN=http://127.0.0.1:3000

COPY node_modules ./node_modules
COPY dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/main.js"]
