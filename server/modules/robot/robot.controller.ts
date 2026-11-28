import { Controller, Get, Post, Body } from '@nestjs/common';
import { RobotService } from './robot.service';
import { MoveDto } from './dto/move.dto';
import type { MapData, RobotState, MoveResponse } from '@shared/api.interface';

@Controller('api')
export class RobotController {
  constructor(private readonly robotService: RobotService) {}

  @Get('map')
  getMap(): MapData {
    return this.robotService.getMap();
  }

  @Get('robot')
  getRobot(): RobotState {
    return this.robotService.getRobotState();
  }

  @Post('robot/move')
  move(@Body() dto: MoveDto): MoveResponse {
    return this.robotService.move(dto.direction);
  }

  @Post('robot/reset')
  reset(): RobotState {
    return this.robotService.reset();
  }
}
