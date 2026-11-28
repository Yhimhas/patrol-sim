import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { HealthModule } from './modules/health/health.module';
import { RobotModule } from './modules/robot/robot.module';
import { PathModule } from './modules/path/path.module';
import { ViewModule } from './modules/view/view.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    // 公网独立部署（Docker）时没有平台 Cookie/CSRF 上下文，关闭 CSRF 中间件，避免 /api/* 被 403 拦截
    PlatformModule.forRoot({ enableCsrf: false }),
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    RobotModule,
    PathModule,
    HealthModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
