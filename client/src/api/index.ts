import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { MapData, RobotState, MoveRequest, MoveResponse, PathPlanRequest, PathPlanResponse } from '@shared/api.interface';

export async function getMap(): Promise<MapData> {
  const response = await axiosForBackend.get('/api/map');
  return response.data;
}

export async function getRobotState(): Promise<RobotState> {
  const response = await axiosForBackend.get('/api/robot');
  return response.data;
}

export async function moveRobot(direction: MoveRequest['direction']): Promise<MoveResponse> {
  const response = await axiosForBackend.post('/api/robot/move', { direction });
  return response.data;
}

export async function resetRobot(): Promise<RobotState> {
  const response = await axiosForBackend.post('/api/robot/reset');
  return response.data;
}

export async function planPath(req: PathPlanRequest): Promise<PathPlanResponse> {
  const response = await axiosForBackend.post('/api/path/plan', req);
  return response.data;
}
