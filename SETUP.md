# 环境准备 SETUP（10 分钟）

> 新成员或重装电脑后，从「WSL2 + Ubuntu 装好」到「可以开工」的全部步骤。
> 每步末尾有验收点——看到什么才算对，对了再往下。卡住先问 AI，超 30 分钟发群 @具身智能。

**你不需要装任何重东西**：不用 Node、不用 Docker、不用任何 AI 库。全文就是
「令牌 → git 登记 → 拉库 → 虚拟环境」四小样。

---

## 第 1 步 · GitHub 令牌（网页点击，2 分钟）

以后往仓库「上传代码」的钥匙。clone（下载）不需要，push（上传）必须要。

1. 浏览器打开 `github.com` 登录（没账号先注册）
2. 右上角头像 → **Settings** → 左侧拉到最底 → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. Note 填 `patrol-sim`；Expiration 选 **90 days**；勾选框**只勾第一项 repo**
5. 点绿色 Generate token → 复制那串 **ghp 开头**的字符 → 立刻存进手机备忘录
   （只显示这一次，刷新就没了）

**纪律**：这串绝不发群、不发任何人、不粘贴给 AI——它等于你的上传密码。

> 已做过这步的老队员：跳到第 3 步。

---

## 第 2 步 · 告诉 git 你是谁（2 条命令，1 分钟）

每次提交都会署名。不设置的话，第一次 `git commit` 会报
`Please tell me who you are` 直接被拒。在自己的 Ubuntu 终端里执行
（把两处 `你的GitHub用户名` 换成真实的）：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub用户名@users.noreply.github.com"
```

验收：`git config user.name` 能回显你的用户名。

---

## 第 3 步 · 拉库（2 条命令，1 分钟）

```bash
git config --global credential.helper store
git clone https://github.com/zhuyuhan-nb/patrol-sim.git ~/patrol-sim
```

- 仓库是 Public，**下载不要密码**，直接能拉
- 做过老队员：仓库已存在的话，用 `cd ~/patrol-sim && git pull` 代替 clone

验收：

```bash
git config user.name        # 回显你的用户名
ls ~/patrol-sim             # 列出 backend  docs  frontend 等
```

---

## 第 4 步 · Python 虚拟环境（5 条命令，5 分钟）★ 本文档最重要的一步

pytest（跑测试）等工具住在 `.venv` 这个「项目专属工具箱」里。
**它永远不会被上传 GitHub**——所以 clone 下来的仓库没有它，
**每台电脑都要自己建一次**。没做这步，后面跑测试/起后端必报
`No module named pytest`。

```bash
sudo apt install -y python3-venv python3-pip
cd ~/patrol-sim/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- 第 1 条要密码：输的是你**装 Ubuntu 时设的密码**（输入时屏幕不显示任何字符，正常）
- 第 4 条成功的标志：提示符开头出现 **`(.venv)`**
- 第 5 条下载 fastapi / uvicorn / httpx / pytest 四样，几十秒

---

## 第 5 步 · 30 秒终检（两条全过 = 环境完整）

```bash
cd ~/patrol-sim/backend
python3 -m pathplanning.grid_map     # 打印 12 行地图：· 空地，■ 障碍
source .venv/bin/activate
python3 -m pytest -q                 # 打印 N passed（没有任何 failed）
```

两条都过 → 群里发「环境就绪」+ 截图，按各自方向的执行指南开工。

---

## 以后每天开工三条（背下来）

```bash
cd ~/patrol-sim
git pull
cd backend && source .venv/bin/activate    # 看到 (.venv) 才继续
```

**最容易忘**：新开一个终端窗口 = 工具箱灯灭了，必须重新
`source .venv/bin/activate`。

---

## 排障速查

| 看到什么 | 怎么修 |
| --- | --- |
| Ctrl+V 粘贴没反应 | Ubuntu 终端不吃 Ctrl+V，用鼠标右键或 Ctrl+Shift+V |
| clone/push 报 TLS / GnuTLS -110 | 校园网抖动：退出 Watt Toolkit/Steam++ 加速器，重试一两次 |
| push 报 403 Permission denied | 协作者邀请没点 Accept：GitHub 铃铛通知里接受，或打开 `github.com/zhuyuhan-nb/patrol-sim/invitations` |
| push 要密码 | 输 **ghp 开头的令牌**（不是网页密码）；屏幕不显示字符是正常的 |
| commit 报 Please tell me who you are | 回第 2 步，两条命令没跑或没换成自己的用户名 |
| sudo 密码总不对 | 输的是 Ubuntu 安装时设的密码（不是 GitHub 令牌）；屏幕不显示 |
| No module named pytest | `(.venv)` 没亮：`source .venv/bin/activate` 再跑 |
| No module named pathplanning | 不在 backend 目录：`cd ~/patrol-sim/backend` |
| pip 下载中断 | 重跑 `pip install -r requirements.txt`（可重入，不会装坏） |
| 报错看不懂 | 截图发群 @具身智能，附一句你当时在哪一步 |
