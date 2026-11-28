import { Body, Controller, Post } from '@nestjs/common';
import { PathService } from './path.service';
import { PlanDto } from './dto/plan.dto';
import type { PathPlanResponse } from '@shared/api.interface';

@Controller('api/path')
export class PathController {
  constructor(private readonly pathService: PathService) {}

  @Post('plan')
  plan(@Body() dto: PlanDto): PathPlanResponse {
    return this.pathService.plan(dto);
  }
}
