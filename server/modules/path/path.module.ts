import { Module } from '@nestjs/common';
import { PathController } from './path.controller';
import { PathService } from './path.service';
import { RobotModule } from '../robot/robot.module';

@Module({
  imports: [RobotModule],
  controllers: [PathController],
  providers: [PathService],
})
export class PathModule {}
