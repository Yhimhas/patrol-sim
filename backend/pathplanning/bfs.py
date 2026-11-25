from collections import deque
from pathplanning.grid_map import W, H, OBSTACLES

def find_path(start, goal):
    """返回从 start 到 goal 的格子列表；走不到返回 None"""
    if goal in OBSTACLES:
        return None
    q = deque([start])
    came = {start: None}
    while q:
        cur = q.popleft()
        if cur == goal:
            path = []
            while cur:
                path.append(cur)
                cur = came[cur]
            return path[::-1]
        x, y = cur
        for dx, dy in ((1,0), (-1,0), (0,1), (0,-1)):
            nxt = (x + dx, y + dy)
            if 0 <= nxt[0] < W and 0 <= nxt[1] < H \
               and nxt not in OBSTACLES and nxt not in came:
                came[nxt] = cur
                q.append(nxt)
    return None

if __name__ == "__main__":
    print(find_path((1,1), (12,10)))
