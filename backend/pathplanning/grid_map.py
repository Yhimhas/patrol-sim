"""全项目唯一的地图数据源（契约版，具身智能/算法共同维护）。

16 列 x 12 行；障碍坐标与 docs/03 契约一致。
其他模块一律 import 本文件，不得自行复制地图数据。
"""

W = 16
H = 12
OBSTACLES = {(5, 3), (5, 4), (6, 4), (10, 7), (11, 7)}


def in_bounds(x, y):
    return 0 <= x < W and 0 <= y < H


def can_stand(x, y):
    return in_bounds(x, y) and (x, y) not in OBSTACLES


def print_map():
    for y in range(H):
        print("".join("■" if (x, y) in OBSTACLES else "·" for x in range(W)))


if __name__ == "__main__":
    print_map()
