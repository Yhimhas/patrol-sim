import { IsIn } from 'class-validator';
import { ROBOT_DIRECTIONS } from '@shared/api.interface';
import type { MoveRequest } from '@shared/api.interface';

export class MoveDto implements MoveRequest {
  @IsIn(ROBOT_DIRECTIONS)
  direction!: 'up' | 'down' | 'left' | 'right';
}
