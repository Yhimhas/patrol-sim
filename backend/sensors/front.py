from pathplanning.grid_map import W, H, OBSTACLES
from simulation.robot import STEP


def probe(x, y, heading):
    """沿朝向一格一格看，返回到障碍/边界的距离；blocked=紧贴着"""
    dx, dy = STEP[heading]
    dist = 0
    while True:
        nx, ny = x + dx * (dist + 1), y + dy * (dist + 1)
        if not (0 <= nx < W and 0 <= ny < H) or (nx, ny) in OBSTACLES:
            return {"blocked": dist == 0, "distance": dist}
        dist += 1
