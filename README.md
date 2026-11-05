<p align="center"><img src="icon.svg" width="84" alt="dsh-restart-handoff"></p>

<h1 align="center">dsh-restart-handoff</h1>

<p align="center"><strong>改完东西必须重启？它替你重启，再把对话接回原来的会话。</strong></p>

<p align="center"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/license-MIT-2f6f4f?style=flat-square"></a>
  <img alt="仅 macOS" src="https://img.shields.io/badge/platform-macOS-4b6fff?style=flat-square">
  <img alt="仅 DSH 桌面版" src="https://img.shields.io/badge/host-DSH%20Desktop-7da1de?style=flat-square">
  <a href="https://github.com/Saolence/dsh-restart-handoff/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/Saolence/dsh-restart-handoff?style=flat-square"></a>
  <a href="https://github.com/Saolence/dsh-restart-handoff/stargazers"><img alt="Star 数" src="https://img.shields.io/github/stars/Saolence/dsh-restart-handoff?style=flat-square"></a>
</p>

<div align="center">

> 普通的「重启」只是关掉再打开：你正在做的事全没了，得从头解释一遍自己在哪一步。
> 这个插件补上缺的那一半——**为什么重启、重启后第一步做什么**，跟着进程一起活下来。
>
> *A plain restart throws the work away. This plugin keeps the "why" and the "what next" alive across the relaunch.*

</div>

## 它解决什么

Agent 改完插件代码，宿主会回一句 `application: "restart-required"`——改动只有重启才生效。于是你手动关掉 App、重新打开、想起来刚才做到哪、再打一遍需求。

这个插件把这三步接了起来：

- **不用你记得**——重启前先把「下一步做什么」写成交接话存到磁盘，重启后它作为会话的第一条消息出现；
- **不打断回答**——重启排到这一轮说完之后才执行，不会把句子截断在半路；
- **不连环重启**——冷却时间、尝试次数上限、一次性续跑，撞车时也只重启一次。

## 三种开始方式

| 触发源 | 谁发起 | 什么时候 |
| --- | --- | --- |
| 自动 | 宿主监听 `plugin_manager` 的工具结果 | 结果里出现 `restart-required`，即改动必须重启才生效 |
| 工具 | 主会话主动调 `restart_handoff` | 知道自己刚改了什么，顺手把交接话写掉 |
| 手动 | 设置 →「重启交接」→ 现在重启 | 你现在就想重启（**这一种不续跑**） |

两条自动路径撞车时，后到的会让位（日志里是 `hand-off request dropped`），已排程或已在等待时返回 `already-scheduled` / `already-deferred`。

## 重启后会收到什么

不是模板，是**模型自己写的**一段话——插件只负责搬运，原样投递：

> 🔄 **DSH 已自动重启完成，接着做未完成的部分**
>
> **发生了什么**：触发原因是 `plugin-manager: host-module`，上一轮是等回答说完、结果落盘之后才退出的（不是崩溃），上下文完整。
>
> **接下来怎么做**：① 从这句话中断的地方继续：把 `client.js` 的新开关接上；② 先确认上一步有没有只做了一半。

兜底只在三种情况下出场：没给交接话、交接超时（2 分钟）、拿不到会话 id——而且兜底只有一句话：`🔄 DSH 已重启完成，继续未完成的工作。`

## 安装

前提：**DSH 桌面版**（Electron）。宿主这一半要重启 App，纯 web / CLI 宿主会拿到 `status: "unsupported"`。

**从 Release 的 tarball 装**（不需要 npm 账号）：

```
plugin_manager: { action: "install_bundle", target: "/绝对路径/saolence-dsh-restart-handoff-0.1.0.tgz" }
```

**从 npm 装**（发布后）：

```
plugin_manager: { action: "install_bundle", target: "@saolence/dsh-restart-handoff" }
```

**从本地仓库装**：

```
plugin_manager: { action: "install_bundle", target: "/绝对路径/dsh-restart-handoff" }
```

`package.json` 声明了 `dsh.bundle.patch`，bundle 自带的 `cordis.patch.yml` 会自动插入 `restart-handoff` 这一条。之后停用 / 启用：

```
plugin_manager: { action: "set_plugin", target: "include:restart-handoff", enabled: false }
```

> ⚠️ **改这个包本身不会热重载。** profile 指向它的是符号链接，HMR 收不到通知；改完 `index.js` / `client.js` 要 toggle 一次（或重启一次）才生效。

## 设置面板

设置 →「重启交接」：

> 命名：设置分区叫「重启交接」，插件列表里显示包名 `dsh-restart-handoff`，主页只留图标。

侧栏最下面、账号那一行的**上面**是一个**只有图标**的圆形按钮（`↻`，24px 圆形浅色底，与账号行图标同尺寸、12px 圆角），不再带「重启」二字，悬停时才用文字说明当前状态。点一下弹「现在重启？ 是 / 否」，选「是」后按钮变琥珀色、显示 3 秒倒计时，旁边出现一枚细小的进度环；到点就重启，这 3 秒里再点一下能取消。排队或正在自动重启时显示小环（排队时是暂停符），点一下直接取消。

面板上那张大卡片就是全部：一行大字说明现在什么情况，有事就变成倒计时或「等你忙完」。
下面的开关只留三个常用的：

- **需要重开时自动帮我重启**——默认开；盯着 `plugin_manager` 的结果找 `restart-required`；
- **等所有任务都做完再重启**——默认开；不打断正在跑的对话、子任务和别的窗口；
- **重启后自动接着做**——默认开；把交接话投回原会话，关掉就只重启、等你开口。

「更多设置」折叠着三个不常动的：允许我主动申请重启、每轮说完再动手、顺手清理过时的登录记录。

再往下是**交接话模板**：重启后你看到的那段话长什么样，由这里决定。模型只填内容（`{{reason}}` `{{progress}}` `{{next}}` `{{skip}}`），排版按模板走；某一行引用的字段模型没填，那一行整行不显示，不会留下「下一步：（空）」。还有 `{{session}}`（会话号前 8 位）和 `{{time}}`（重启时刻）可用。输入框下方是实时预览，改一个字就重排一次；保存时宿主会再校验一遍占位符，认不出的名字直接报错、不写入。模板留空 = 用内置的默认排版。
大卡片右边的「现在重启」要连点两下才生效（第二步确认），手动重启不续跑；倒计时或排队时那个按钮会变成「先不重启」。

设置存在 `~/.dsh/restart-handoff/settings.json`，事件在 `history.jsonl`，完整日志在 `~/.dsh/restart-handoff.log`。

## 一次重启的完整路径

```
改动需要重启
      │
      ├── 自动：宿主看到 restart-required → 用 steer 问模型
      │        「写交接话，然后调 restart_handoff」
      │        └── 2 分钟没回音：发一句提示照常重启
      └── 工具：agent 调 restart_handoff({ reason, progress, next, skip })
      │
      ▼
挂起请求            pending.json ← { sessionId, reason, progress, next, skip, requestedAt, attempts }
      ▼
等所有会话说完      别的会话还在跑就不动手（gate.json 每秒刷新一次）
      ▼
1.5 秒倒计时（可取消）→ detached 的 sh helper
      │   再看一眼 gate.json（有人又开始跑了就等到最多 900 秒）· 确认 App 真退出后才写 exit.json
      │   退出 App · 清理 Singleton 锁 · 清掉陈旧的登录 cookie · open -n
      │   确认新主进程真的活着
      ▼
新宿主启动，插件加载：比对 exit.json / boot.json（区分「计划内重启」和「异常退出」）
      ▼
2.5 秒后：resolveAgent(sessionId) → prompt({ mode: "queue", content: [按模板渲染的交接话] }) → 删掉 pending.json
      ▼
同一个会话收到的下一条消息，就是那段交接话
```

## 等谁说完：不只看本会话

只等当前这一轮是不够的——另一个会话可能正在写答案，为它杀掉宿主等于把那段回答吞掉。所以插件维护一份「现在有几个会话在跑」的名单：

- `api-session/status` 和 `agent/status` 两个信号共同维护这份名单；
- 名单里还有人时，挂起的重启不进入倒计时，面板显示「等这 N 个会话都说完再重启」；
- 名单清空的瞬间才开始 1.5 秒倒计时；
- 倒计时结束时（`performRestart`）再查一次，中途有人插进来就往后推 2 秒，最多推 60 次；
- helper 杀 App 之前**第三次**检查：读 `gate.json` 里的 `busy`、`waitAll` 和 `at`（超过 8 秒没刷新视为宿主已走，不算忙），忙就每 0.5 秒看一次，最多等 900 秒（15 分钟，和宿主自己的兜底一致）；`waitAll: false` 时 helper 不再等。

面板上「等所有会话都空闲」关掉，就退回只看本会话的老行为。

杀不掉旧进程时 helper 直接放弃这次重启（日志 `could not stop the old app; aborting the restart`），不写 `exit.json`、不启动第二份 App——宁可下次启动报「异常退出」，也不谎报一次干净重启。

## 谁能发起：只有主会话

重启宿主会打断所有正在跑的活，所以决定权只放在主会话（人正在看的那个）手里：

- **子代理、子会话、teammate 调用 `restart_handoff` 一律被拒绝**，返回 `status: "not-root"`，不排队、不重启。它们该做的是把「改动需要重启」写进结果或消息交给主会话。
- 自动触发也守同一条线：子会话里的 `plugin_manager` 报 `restart-required` 时只记日志（`history.jsonl` 里的 `restart-refused`），不发起重启；主会话看到子代理的结果后自己判断。
- **主会话调用时如果还有别的 agent/会话在跑，不拒绝也不催**：重启挂起，等所有会话都空闲（子代理、teammate、其它窗口的对话都算）再执行，然后照常重启、投递交接话。调用方这一轮说完就行，不需要过一会儿再来问一次。等太久（15 分钟）还没空闲会兜底重启，避免状态事件漏掉导致永远不重启。
- 判断依据两层：会话头里的 `origin: "subagent"` / `parentSession`，以及 Agent 注册表的归属链（`isOwnedBy`）。两条都说「不是子会话」才放行。
- 名单里的死条目会被清理：如果某个会话已经销毁却没来得及报 idle，插件会对一下 Agent 注册表，**连续 5 秒**都查不到才删（注册表在插件重载时会短暂查不到活着的会话，一次查不到不算数），免得一次永久「忙」把重启永远挂住。

面板按钮和自动触发不受这条限制——那是人按的、或主会话自己的东西，`waitForAllSessions` 那套「等所有人说完」照旧生效。

## 工具：`restart_handoff`

```json
{
  "reason": "换了侧边栏插件",
  "progress": "面板已经接上新的插槽，测试还没跑",
  "next": "跑 npm test，然后看设置页有没有报错",
  "skip": "不用再改 client.js 的样式",
  "delay_ms": 1500
}
```

四个字段里 `reason` 一句话就够，另外三项写清楚到能直接照着执行：`progress` 是这一轮做到哪、`next` 是重启后第一步、`skip` 是别重复劳动的部分。排版不归模型管，模板在设置页里定。

工具立刻返回，不等重启，也不阻塞这一轮：

| 返回 | 含义 |
| --- | --- |
| `deferred` | 已挂起，这一轮说完再重启 |
| `scheduled` | 倒计时已经在跑 |
| `already-deferred` / `already-scheduled` | 已经有一次在排队了 |
| `not-root` | 调用方是子代理/子会话：没有重启权，把需求带回主会话 |
| `cooldown` / `disabled` / `unsupported` | 冷却中 / 功能被关 / 不是桌面宿主 |

**排队成功时返回里带 `mustStopNow: true`、`waitFor: "turn-end"` 和一句 `note`。模型看到它就当场停手：只回一句「已排定重启」，不再调用工具、不再开新任务。**

这条约束是行为层面的，不是客套。重启挂在回合结束时触发，所以调用之后继续干的活全跑在旧进程上——正是这次重启想换掉的环境——而且会和交接话里同一件事重复一遍。插件在 `tools/post-execute` 上兜了一道：真的有人接着调工具，日志会写一条 `[warn] tool "X" ran after restart_handoff in the same turn`，`history.jsonl` 里记一条 `late-tool` 事件。它只记录、不阻断（当事没有权限替模型结束回合）。判断只看**调用方自己的**会话：子代理、其它窗口的对话在重启挂起期间干活，不会被算进来。

「重启完成」永远不会从这个工具返回——**完成证据就是那段交接话本身**，它作为下一条消息到达。

`next_step` 和自由文本 `continuation` 都已移除：传了会被 schema 拒绝（`additionalProperties: false`），旧版留下的 pending 文件在下次启动时直接删掉，不投递。

## 写入的文件

```
~/.dsh/restart-handoff/
├── pending.json     # 跨重启保留；交接话投递成功后删除
├── settings.json    # 第一次改设置时创建；没有文件 = 默认值
├── gate.json        # 宿主活着时每秒刷新：有没有会话在跑（helper 会读）
├── exit.json        # helper 确认旧进程真的退出后才写：这次退出是"计划内重启"
├── boot.json        # 每次启动写：pid + 时间，用来判断上次是不是正常退出
├── last-restart.json # 上次真正动手重启的时间：让冷却跨重启有效
└── history.jsonl    # 面板时间线用的追加式事件日志（超过 512KB 只留最近 400 行）
~/.dsh/restart-handoff.log   # 完整文本日志，含 helper 脚本自己的输出
```

## 已知边界

- **工具只出现在新会话里**：一个会话能调用哪些工具，在它创建那一刻就定下来了。插件是后来装的、或者装好后重启过宿主，已经打开的会话都拿不到 `restart_handoff`——重启宿主也不会刷新它。要用工具就新开一个会话；老会话仍然可以用面板按钮或自动触发。
- **只有桌面版**。其它宿主拿到 `status: "unsupported"`。
- **只有 macOS**：重启 helper 是 `/bin/sh` 脚本，用 `osascript` 退出 App、`open -n` 重开。
- 重启仍然会打断正在跑的那一步：shell 命令没法接着跑，只能重跑。交接话说的是「从哪继续」，不是「当时手里有什么」。
- **GUI 端口会变**：重启后请用 App 打印出来的地址，别用书签。
- 「立即重启」按钮不续跑，因为不写 pending。
- 冷却时间写在 `last-restart.json` 里，重启后依然有效；`pending.json` 另带尝试次数和 10 分钟有效期，双保险成不了无限重启循环。
- 「所有会话空闲」看的是宿主报告的会话状态；藏在后台、既不报 idle 也不报 running 的东西（比如外部脚本直接杀进程）挡不住重启。
- 登录 cookie 清理默认只留最新一条 `dsh-auth-*`：如果 App 同时依赖多条不同作用域的登录态，关掉这个开关即可。
- 异常退出的判定比对 `boot.json` 的 pid：插件被禁用期间发生的崩溃，下次启用时只会记一次，不会追责。

## 开发

```bash
node --check index.js && node --check client.js
node test/smoke.mjs          # 状态读写往返 + helper 脚本断言，不需要装进 Harness
```

不装进 App 也能看面板长什么样（自带一个极简 React 替身 + 静态页）：

```bash
cd test/preview && cp ../../client.js . && python3 -m http.server 8781
# 打开 http://127.0.0.1:8781/preview.html?s=idle
```

`s` 可选 `idle` / `countdown` / `waiting` / `handoff` / `empty`。

## 目录

```
.
├── index.js             # 宿主：排程、工具、post-execute 监听、HTTP 路由
├── client.js            # 设置面板（__ModuleLoader__ + settings.section）
├── lib/relaunch.js      # sh helper：退出 → 清锁 → open -n → 确认活着
├── lib/state.js         # pending / settings / history / log
├── cordis.patch.yml     # 一条 insert
├── locale/{en,zh}.json  # 插件列表里的名字与简介
├── icon.svg
└── test/                # 冒烟测试 + 面板预览台
```

## 许可

MIT

---

[English](README.en.md) · **简体中文**
