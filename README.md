<p align="center"><img src="icon.svg" width="84" alt="dsh-restart-handoff"></p>

<h1 align="center">dsh-restart-handoff</h1>

<p align="center"><strong>DeepSeek Harness 桌面版与 <code>dsh web</code> 宿主的自动重启插件：改动必须重启才生效时，它替你重启，再把「为什么重启、接下来做什么」接回原来的会话——重启多少次，任务都不会断线。</strong></p>

<p align="center"><strong>简体中文</strong> · <a href="README.en.md">English</a></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/badge/license-MIT-2f6f4f?style=flat-square"></a>
  <img alt="仅 macOS" src="https://img.shields.io/badge/platform-macOS-4b6fff?style=flat-square">
  <img alt="DSH 桌面版与 dsh web" src="https://img.shields.io/badge/host-DSH%20Desktop%20%C2%B7%20dsh%20web-7da1de?style=flat-square">
  <a href="https://github.com/Saolence/dsh-restart-handoff/releases/latest"><img alt="最新版本" src="https://img.shields.io/github/v/release/Saolence/dsh-restart-handoff?style=flat-square"></a>
  <a href="https://github.com/Saolence/dsh-restart-handoff/stargazers"><img alt="Star 数" src="https://img.shields.io/github/stars/Saolence/dsh-restart-handoff?style=flat-square"></a>
</p>

> 普通的「重启」只是关掉再打开：你正在做的事全没了，得从头解释一遍自己在哪一步。
> 这个插件补上缺的那一半——**为什么重启、重启后第一步做什么**，跟着进程一起活下来。

## 一句话

改完插件、装完工具，DSH（DeepSeek Harness）常会说一句「需要重启才生效」。手动重启意味着：关掉窗口、重新打开、自己回想刚才做到哪，再把需求重打一遍。

这个插件把这段空档填上：重启前把交接话写到磁盘，重开之后它作为新会话的第一条消息出现，模型照着往下做。**一个任务要重启五次，就续五次，中间不断线。**

它不改造你的模型，也不联网——只在本机读写几个状态文件。

## 优势

**无限续接。** 每次重启都带一句「做到哪了、下一步做什么」过去，模型接着干而不是从头问。改一个插件要重启三次、改 harness 要重启十次，对话仍然是一条线。

**重启后模型知道前面发生了什么。** 交接话由模型自己在上下文最新鲜的时候写：为什么重启、这一轮做到哪、重启后第一步、哪些别重做。不是通用安慰话。

**改插件、改 Harness 的时候最明显。** 这两类改动几乎必然要求重启，而重启正是最容易丢上下文的时候——正是它存在的理由。

**不用你记，也不用你转述。** 没人再需要「我们刚才做到哪了」这句话；你回来时它已经在那儿了。

**重启本身不添乱。** 不打断正在回答的那一轮，等你所有窗口空下来，冷却 60 秒，拒绝时会说清还差几秒。

## 你会用到它的四个时刻

**一、让 Agent 改插件代码**

改完，宿主回一句 `application: "restart-required"`。插件自己重启，几秒后你回到同一个会话，第一条消息就是交接话。

**二、你自己知道这一改得重启**

跟模型说一句「改完重启一下」。它调一次工具，顺手把交接话写掉，然后重启。

**三、你在改 DeepSeek Harness 自己**

改内置工具、改宿主代码、跑测试时反复重启——每一次都带着上一次的进度回来，不必重新描述需求。

**四、你现在就想要新版**

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

## 它不会添乱的几个地方

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

### 一个任务里连着重启好几次，上下文会断吗？

不会。每重启一次就续一次：交接话跟着进程活下去，模型重开后先读它，再接着做。链条长了会变薄（每次只带得动一段摘要），但不会断成两截。

### 它会不会自己反复重启？

不会。两次重启之间强制隔 60 秒（`cooldownMs`），这期间任何来源的请求都会被挡下并说明还要等几秒。自动触发被挡下不会丢，冷却结束后自己重试一次。

### 我只要重启，不要它自动接着说？

设置里关掉「重启后自动接着做」。这时它只重启，不投递交接话，你回来说话就好。

### 交接话的样式能自己定吗？

能。设置页最下面就是模板编辑器，改一个字，右边预览立刻重排。模型只负责填内容（起因、做到哪、下一步、别重做，外加会话号与重启时刻），排版全按你的模板走。模板留空就恢复内置排版。

### 需要联网吗？数据存在哪？

完全不联网，没有任何外发请求。状态都在这几个本机文件里：`~/.dsh/restart-handoff/settings.json`（设置）、`pending.json`（待投递的交接话）、`history.jsonl`（事件）、`~/.dsh/restart-handoff.log`（日志）。删掉这个目录等于清空记录。

### 支持 Windows、Linux 或网页版吗？

两种宿主都支持：DSH 桌面版（Electron App）和 `dsh web` 这样的命令行宿主。真正不支持的是没有窗口可回的一次性进程——headless 脚本、测试桩，它们拿到的是「只能在桌面版或 dsh web 里使用」。macOS 上两种都验证过；Linux 上的 `dsh web` 没验过。

### 会不会碰我的登录状态？

只做一件事：每次启动，Electron 的 cookie 库里会多留一条 `dsh-auth-*` 记录，插件保留最新那条、删掉更早的（否则请求头越堆越大，服务端会报错）。这是它唯一触碰账号相关文件的地方，可以在「更多设置」里关掉。除此之外不读、不改任何内容。

### 怎么卸载？

```bash
dsh plugin --profile desktop remove @saolence/dsh-restart-handoff   # 桌面版
dsh plugin --profile web remove @saolence/dsh-restart-handoff       # dsh web
```

卸掉后不再监听、不再重启；`~/.dsh/restart-handoff/` 里的记录可以留着，也可以删掉。

## 安装

前提：**DSH 桌面版**（跑 `dsh web` 的装到 `web` profile，见下一节）。装完它会出现在设置页的「重启交接」里。

```bash
dsh plugin --profile desktop add @saolence/dsh-restart-handoff
```

> profile 要对上你用的宿主：桌面 App 用 `desktop`，`dsh web` 用 `web`。装错了插件不生效。
>
> 改这个包**本身**不会热重载：profile 里指向它的是符号链接，HMR 收不到通知，改完要停用再启用一次（或重启一次）才生效。

## 也支持 dsh web

桌面版之外，`dsh web` 这类命令行宿主也能用：

```bash
dsh plugin --profile web add @saolence/dsh-restart-handoff
```

用法一样，但重开的对象是那个 Node 进程，所以有三点不同：

- **浏览器会新开一个标签**。`dsh web` 每次启动都会生成新的访问令牌，原来那个标签必然失效，插件会在新进程打印出地址后自动把它打开——旧标签关掉就行。
- **必须是从终端里启动的**。插件记下自己的命令行，退出后用同样的参数重放；交给 systemd、pm2 这类进程管理器管的，建议关掉自动重启，让管理器自己拉起来更稳。
- **`--no-open` 时不弹浏览器**，新地址记在 `~/.dsh/restart-handoff/cli-host.log` 里。

固定 `--port` 会更好（少一个变量），但不是必须：地址是抓出来的，端口变了也照样打开。

## 设置里有什么

设置 →「重启交接」。最上面一行大字说明现在的情况，有事就变成倒计时或「等你忙完」。

三个常用开关：

- **需要重开时自动帮我重启**（默认开）
- **等所有任务都做完再重启**（默认开）
- **重启后自动接着做**（默认开）

「更多设置」里还有三项：允许模型主动申请重启、每轮说完再动手、顺手清理过时的登录记录。

侧边栏账号行上方有一枚只有图标的小按钮：空闲是 `↻`，排队时是暂停符，倒计时在图标外圈走一圈进度；点一下可以手动重启或取消。

## 已知边界

- 只重启宿主，不重启你机器上的其他进程。
- 手动重启不续跑——那种时刻你人就在跟前。
- 交接话只在一次重启里有效，超过 10 分钟未投递就作废。
- `dsh web` 每次启动都换一个带令牌的地址，旧标签必然失效：插件会替你打开新标签，但它管不了你原来那个。

## 开发者

细节都在源码里，这里只留入口：`index.js`（宿主逻辑）、`client.js`（界面）、`lib/state.js`（设置与状态文件）、`test/`（smoke / boot / client-contract / cli-relaunch 四组测试，`npm test`）。

改界面时有离线预览台，不依赖宿主：

```bash
cp client.js test/preview/client.js
python3 -m http.server 8781 --directory test/preview
# 打开 http://127.0.0.1:8781/preview.html?s=idle
```

参数：`s=idle|countdown|waiting|handoff|empty` 切场景，`theme=dark` 切暗色，`slot=sidebar.footer.action` 预览侧边栏那枚按钮。

## 许可

MIT，见 [LICENSE](LICENSE)。当前版本 0.2.1。