from pathplanning.bfs import find_path


def plan_patrol(start, points):
    """依次串联巡检点：返回分段路径列表；某段不可达返回 None"""
    segs = []
    cur = start
    for pt in points:
        seg = find_path(cur, pt)
        if seg is None:
            return None
        segs.append(seg)
        cur = pt
    return segs


def patrol_progress(segs, walked):
    """进度对象：walked = 已走完的段数"""
    total = len(segs)
    return {"total": total, "current": walked + 1, "done": walked >= total}
