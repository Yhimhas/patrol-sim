import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_CHECKPOINTS, PATH_ALGORITHMS } from '@shared/api.interface';
import type { PathPlanRequest, Point } from '@shared/api.interface';

const MAX_COORDINATE = 1000;

export class PointDto implements Point {
  @IsInt()
  @Min(0)
  @Max(MAX_COORDINATE)
  x!: number;

  @IsInt()
  @Min(0)
  @Max(MAX_COORDINATE)
  y!: number;
}

export class PlanDto implements PathPlanRequest {
  @IsIn(PATH_ALGORITHMS)
  algorithm!: 'bfs' | 'astar';

  @IsDefined()
  @ValidateNested()
  @Type(() => PointDto)
  start!: Point;

  @IsDefined()
  @ValidateNested()
  @Type(() => PointDto)
  end!: Point;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHECKPOINTS)
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  checkpoints?: Point[];
}
