import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { configureApp } from '@lark-apaas/fullstack-nestjs-core';
import { existsSync } from 'fs';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });
  await configureApp(app, {
    disableSwagger: true,
  });
  // 显式启用 DTO 校验：whitelist 会剔除未声明的字段，transform 负责嵌套 DTO 转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3000');

  // 注册视图引擎, 渲染 client 目录下的 html 文件。
  // 不同构建产物可能把入口 html 直接放在 dist/client 或嵌套在 dist/client/client，这里按实际存在的目录识别。
  const clientRoot = join(process.cwd(), 'dist/client');
  const viewsDir = existsSync(join(clientRoot, 'client', 'index.html'))
    ? join(clientRoot, 'client')
    : clientRoot;
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('html');
  app.engine('html', hbsExpressEngine);

  // 独立部署/本地预览时，平台不再由 CDN 托管前端静态资源，这里把构建产物目录挂为静态目录，
  // 让 /assets/*、/favicon.svg 等能直接访问；index:false 保证根路径仍走页面渲染而不是直出静态 html。
  app.useStaticAssets(clientRoot, { index: false, prefix: '/' });

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
