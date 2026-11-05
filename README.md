<p align="center"><img src="icon.svg" width="84" alt="dsh-restart-handoff"></p>

<h1 align="center">dsh-restart-handoff</h1>

<p align="center"><strong>DSH 桌面版的自动重启插件：当改动必须重启才生效时，它替你重启，并把「为什么重启、接下来做什么」接回原来的会话。</strong></p>

<p align="center"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/license-MIT-2f6f4f?style=flat-square"></a>
  <img alt="仅 macOS" src="https://img.shields.io/badge/platform-macOS-4b6fff?style=flat-square">
  <img alt="仅 DSH 桌面版" src="https://img.shields.io/badge/host-DSH%20Desktop-7da1de?style=flat-square">
  <a href="https://github.com/Saolence/dsh-restart-handoff/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/Saolence/dsh-restart-handoff?style=flat-square"></a>
  <a href="https://github.com/Saolence/dsh-restart-handoff/stargazers"><img alt="Star 数" src="https://img.shields.io/github/stars/Saolence/dsh-restart-handoff?style=flat-square"></a>
</p>

> 普通的「重启」只是关掉再打开：你正在做的事全没了，得从头解释一遍自己在哪一步。
> 这个插件补上缺的那一半——**为什么重启、重启后第一步做什么**，跟着进程一起活下来。

## 一句话

改完插件、装完工具，DSH 常会说一句「需要重启才生效」。手动重启意味着：关掉窗口、重新打开、自己回想刚才做到哪，再把需求重打一遍。

这个插件把这段空档填上：重启前把交接话写到磁盘，重开之后它作为新会话的第一条消息出现，模型照着往下做。

它不改造你的模型，也不联网——只在本机读写几个状态文件。

## 你会用到它的三个时刻

**一、让 Agent 改插件代码**

改完，宿主回一句 `application: "restart-required"`。插件自己重启，几秒后你回到同一个会话，第一条消息就是交接话。

**二、你自己知道这一改得重启**

跟模型说一句「改完重启一下」。它调一次工具，顺手把交接话写掉，然后重启。

**三、你现在就想要新版**

设置 →「重启交接」→ 点「现在重启」。这一种只重启，不会自动帮你续跑。

## 重启后看到什么

不是固定模板，是模型自己写的四段话（排版由你在设置页定）：

```text
## DSH 已重启完成 · 15:04

- 起因：设置页的开关在暗色下看不见

- 做到哪了：开关底色改成层色，文档补了两行

- 接下来第一步：刷新窗口，确认暗色下的开关清晰

- 不用重做：不用再跑测试
```

某项模型没填，那一行整行消失，不会留下「下一步：（空）」。

兜底只在三种情况下出现：模型没写、5 分钟内没写、拿不到会话号——而且只有一句「DSH 刚重启好，继续没做完的部分。」

## 它替你处理的四件事

- **不打断正在回答的那一轮**——重启排在这一轮说完、结果落盘之后才动手，不会把句子截断在半路。
- **等所有窗口都空下来**——不只是当前会话，子任务和别的窗口也在等，避免重启时把别人的回答掐掉。
- **不会连环重启**——两次重启之间至少隔 60 秒；一次重启只续跑一次，交接话最多投递 3 次。
- **拒绝时说清原因**——冷却期内点重启，界面会说「刚重启过，再等 42 秒」，而不是假装正在重开。

## 和「手动重启」的差别

| | 手动重启 | 这个插件 |
| --- | --- | --- |
| 何时动手 | 你什么时候想起来就什么时候 | 这一轮答完、所有窗口空闲之后 |
| 做到哪了 | 全靠你自己回忆 | 重启前写进交接话，重开就出现在眼前 |
| 回答会被截断吗 | 随时可能 | 不会，等这一轮说完 |
| 想反悔 | 已经关掉了 | 倒计时 5 秒内可以取消 |
| 重复重启 | 可能反复关开 | 60 秒冷却，撞车时只重启一次 |

## 常见问题

### 重启会丢掉正在跑的对话吗？

不会。插件先等你这一轮答完、结果落盘，再等所有窗口空闲，然后才开始 5 秒倒计时。倒计时期间点「取消」就取消；来不及取消的时候，交接话已经写好，重开后会投回同一个会话。

### 它会不会自己反复重启？

不会。两次重启之间强制隔 60 秒（`cooldownMs`），这期间任何来源的请求都会被挡下并说明还要等几秒。自动触发被挡下不会丢，冷却结束后自己重试一次。

### 我只要重启，不要它自动接着说？

设置里关掉「重启后自动接着做」。这时它只重启，不投递交接话，你回来说话就好。

### 交接话的样式能自己定吗？

能。设置页最下面就是模板编辑器，改一个字，右边预览立刻重排。模型只负责填内容（起因、做到哪、下一步、别重做，外加会话号与重启时刻），排版全按你的模板走。模板留空就恢复内置排版。

### 需要联网吗？数据存在哪？

完全不联网，没有任何外发请求。状态都在这几个本机文件里：`~/.dsh/restart-handoff/settings.json`（设置）、`pending.json`（待投递的交接话）、`history.jsonl`（事件）、`~/.dsh/restart-handoff.log`（日志）。删掉这个目录等于清空记录。

### 支持 Windows、Linux 或网页版吗？

不支持。它要重启的是 DSH 桌面版（Electron），所以在纯网页 / 命令行宿主里会直接回「只能在桌面版里重启」。目前只在 macOS 上验证过。

### 会不会碰我的登录状态？

只做一件事：每次启动，Electron 的 cookie 库里会多留一条 `dsh-auth-*` 记录，插件保留最新那条、删掉更早的（否则请求头越堆越大，服务端会报错）。这是它唯一触碰账号相关文件的地方，可以在「更多设置」里关掉。除此之外不读、不改任何内容。

### 怎么卸载？

把插件停用或移除即可：

```text
plugin_manager: { action: "set_plugin", target: "include:restart-handoff", enabled: false }
```

停用后不再监听、不再重启；`~/.dsh/restart-handoff/` 里的记录可以留着，也可以删掉。

## 安装

前提：**DSH 桌面版**。装完它会自动出现在设置页的「重启交接」里。

从 Release 的 tarball 装（不需要 npm 账号）：

```text
plugin_manager: { action: "install_bundle", target: "/绝对路径/saolence-dsh-restart-handoff-0.2.0.tgz" }
```

或者从 npm 装（发布后）：

```text
plugin_manager: { action: "install_bundle", target: "@saolence/dsh-restart-handoff" }
```

> 改这个包**本身**不会热重载：profile 里指向它的是符号链接，HMR 收不到通知，改完要停用再启用一次（或重启一次）才生效。

## 设置里有什么

设置 →「重启交接」。最上面一行大字说明现在的情况，有事就变成倒计时或「等你忙完」。

三个常用开关：

- **需要重开时自动帮我重启**（默认开）
- **等所有任务都做完再重启**（默认开）
- **重启后自动接着做**（默认开）

「更多设置」里还有三项：允许模型主动申请重启、每轮说完再动手、顺手清理过时的登录记录。

侧边栏账号行上方有一枚圆形按钮：空闲是 `↻`，排队时是暂停符，倒计时显示剩余秒数；点一下可以手动重启或取消。

## 已知边界

- 只重启宿主，不重启你机器上的其他进程。
- 手动重启不续跑——那种时刻你人就在跟前。
- 交接话只在一次重启里有效，超过 10 分钟未投递就作废。
- Web GUI 需要带令牌的地址才能打开，插件不碰这块。

## 开发者

细节都在源码里，这里只留入口：`index.js`（宿主逻辑）、`client.js`（界面）、`lib/state.js`（设置与状态文件）、`test/`（smoke / boot / client-contract 三组测试，`npm test`）。

改界面时有离线预览台，不依赖宿主：

```bash
cp client.js test/preview/client.js
python3 -m http.server 8781 --directory test/preview
# 打开 http://127.0.0.1:8781/preview.html?s=idle
```

参数：`s=idle|countdown|waiting|handoff|empty` 切场景，`theme=dark` 切暗色，`slot=sidebar.footer.action` 预览侧边栏那枚按钮。

## 许可

MIT，见 [LICENSE](LICENSE)。当前版本 0.2.0。