---
title: AI Agent 把自己重启没了：一次 Hermes Gateway 自终止事故复盘
published: 2026-05-25
description: 一次 Hermes Gateway 自终止事故复盘：Agent 在会话中执行停止自身服务的命令，导致执行链路被终止并未能成功自恢复。
cover: /images/covers/hermes-restart-cover.webp
coverInContent: true
tags:
  - AI Agent
  - Hermes
  - Incident Response
  - systemd
  - Reliability
category: Incident Response
comment: true
draft: false
---

> 记录一次真实的线上故障：一个长期运行在服务器上的 AI Agent，在执行“重启自身服务”时，把承载当前任务的进程一起终止，最终没有成功拉起自己。

## 背景

我在一台 Linux 云服务器上部署了 Hermes Agent，并通过 Gateway 接入 QQBot 和 Telegram。它平时会作为常驻助手处理消息，也能在授权后执行一些运维命令。

当天上午，我发现机器人突然不回复消息了。最初的直觉是：

- 服务器可能重启了；
- 进程可能被系统的 OOM Killer 杀掉；
- 也可能是消息平台连接异常。

实际排查后发现，原因比这些更有意思：**Hermes 在一次会话中试图重启自己的 Gateway 服务，结果把执行这条命令的自己也停掉了。**

## 现象

故障发生后，表现为：

- Web Dashboard 仍可见；
- QQBot 和 Telegram 不再回复消息；
- Gateway 的 systemd 用户服务处于 `failed` 状态；
- 服务器本身并未在故障时间点重启。

当时服务状态类似：

```text
hermes-gateway.service: Main process exited, code=exited, status=75/TEMPFAIL
hermes-gateway.service: Failed with result 'exit-code'
```

这里有个容易误判的点：Dashboard 和 Gateway 是两个不同的进程。Dashboard 仍然在线，不代表消息接入服务仍然正常。

## 排查过程

### 1. 先确认服务器是否重启

首先检查系统启动时间和重启记录：

```bash
uptime
who -b
last -x -F
journalctl --list-boots
```

结果显示，服务器最近一次启动发生在前一晚，故障当天上午并没有重新启动。因此可以排除“服务器突然重启导致机器人掉线”。

### 2. 找到 Hermes 的实际托管方式

继续检查进程和服务：

```bash
ps -eo user,pid,ppid,lstart,cmd | grep -Ei "hermes|gateway"
systemctl list-units --type=service --all | grep -Ei "hermes|gateway"
loginctl user-status admin
```

发现 Hermes 并不是由系统级服务托管，而是由 `admin` 用户的 systemd user service 管理：

```text
user@1000.service
├─ hermes-webui.service
└─ hermes-gateway.service
```

其中：

- `hermes-webui.service` 负责 Dashboard，仍然运行；
- `hermes-gateway.service` 负责 QQBot / Telegram 接入，已经退出。

### 3. 从日志还原故障时间线

关键证据来自 Gateway 日志与 systemd journal：

```text
10:31:56  聊天会话批准了一条“stop/restart hermes gateway”的危险命令
10:31:57  Gateway 开始执行重启流程
10:32:36  systemd 向 hermes-gateway.service 发送 SIGTERM
10:34:57  Gateway 等待活动 agent 结束超过 180 秒，开始强制中断
10:34:59  主进程以 status=75/TEMPFAIL 退出，服务进入 failed 状态
```

诊断日志甚至保留了正在执行的命令结构：

```bash
systemctl --user stop hermes-gateway &&
sleep 2 &&
systemctl --user start hermes-gateway &&
sleep 3 &&
hermes gateway status
```

问题就藏在这条看起来很正常的命令里。

## 根因：执行 `stop` 的任务，正运行在被停止的服务里

这是一种典型的自终止死锁。

当 Hermes 通过聊天会话执行上述命令时，执行关系如下：

```text
hermes-gateway.service
└─ 当前正在处理消息的 Agent
   └─ terminal tool
      └─ systemctl --user stop hermes-gateway
```

`systemctl stop` 会等待 Gateway 优雅退出。与此同时，Gateway 为了避免中断正在进行中的任务，会等待当前 Agent 完成。

于是形成闭环：

```text
Gateway 等待 Agent 完成
Agent 等待 systemctl stop 返回
systemctl stop 等待 Gateway 退出
```

三者互相等待，谁也无法继续。

Hermes 配置了 `restart_drain_timeout: 180`，因此它等待了 180 秒。超时后 Gateway 打断仍在运行的 Agent，并结束自身进程。

但是，命令中的后半段：

```bash
systemctl --user start hermes-gateway
```

永远没有机会执行，因为执行这条命令的进程已经随着 Gateway 一起退出了。

## 为什么 `Restart=always` 没有救回来

查看 service unit 后，确实可以看到：

```ini
Restart=always
RestartSec=5
RestartForceExitStatus=75
```

乍看之下，即使 Gateway 退出，systemd 也应该重新拉起服务。

但本次操作是从服务内部发起的显式停止：

```bash
systemctl --user stop hermes-gateway
```

对 systemd 来说，这是管理员明确要求停止服务，而不是服务自身意外崩溃。显式 `stop` 的语义优先于自动重启策略，因此服务最终停在了 `failed/stopped` 状态，没有按预期自动恢复。

## 它不是 OOM 导致的，但服务器确实还有内存风险

排查时还发现了另一个独立问题：服务器只有约 `1.8 GiB` 内存，没有配置 swap，同一天内核多次触发 OOM Killer。

内核日志显示，被杀掉的是 MySQL 容器，而不是 Hermes：

```text
Out of memory: Killed process ... (mysqld)
```

因此结论需要分开看：

- **本次 Hermes 离线的直接原因**：自身会话执行了停止自身 Gateway 的命令；
- **服务器的另一项真实风险**：内存不足导致 MySQL 被反复杀掉，后续可能造成数据服务不可用。

故障排查时，区分“同时存在的问题”和“本次事故的直接根因”非常重要，否则很容易把修复方向带偏。

## 恢复操作

确认根因后，我没有修改其他业务组件，直接从外部 SSH 会话重新启动 Gateway：

```bash
sudo -u admin env XDG_RUNTIME_DIR=/run/user/1000 \
  systemctl --user reset-failed hermes-gateway.service

sudo -u admin env XDG_RUNTIME_DIR=/run/user/1000 \
  systemctl --user start hermes-gateway.service
```

恢复后验证：

```bash
sudo -u admin env XDG_RUNTIME_DIR=/run/user/1000 \
  hermes gateway status
```

日志显示：

```text
qqbot connected
telegram connected
Gateway running with 2 platform(s)
```

Gateway 成功恢复，先前被重启中断的会话也被自动处理。

## 修复：撤销“永久允许重启自身”的危险授权

事故中还有一个关键前置条件：在聊天界面中，相关危险命令曾被选择为“永久允许”。

Hermes 配置中保留了类似条目：

```yaml
command_allowlist:
  - stop/restart hermes gateway (kills running agents)
```

这意味着之后只要 Agent 判断需要重启 Gateway，就可能不再询问用户，直接执行同类危险命令。

因此最先进行的止血措施是删除这一条永久授权：

```yaml
command_allowlist:
  # 删除：
  # - stop/restart hermes gateway (kills running agents)
```

这样做不会影响日常聊天功能，但能阻止 Agent 在没有人工再次确认的情况下重复同类事故。

## 正确的重启方式

Hermes 本身已经实现了适用于 Gateway 的重启通道。问题不在于“不能重启”，而在于“不要让承载当前任务的进程通过裸 shell 命令停止自己”。

### 在聊天入口中

应使用内建命令：

```text
/restart
```

内建重启会先记录恢复信息，再走 Gateway 设计好的退出与拉起路径。

### 在 SSH 维护入口中

应从 Gateway 外部执行 Hermes 提供的命令：

```bash
sudo -u admin env XDG_RUNTIME_DIR=/run/user/1000 \
  HERMES_HOME=/home/admin/.hermes \
  /home/admin/.local/bin/hermes gateway restart
```

该命令会优先向运行中的 Gateway 发送 `SIGUSR1`，让其有机会完成优雅排空，并通过约定的退出码交给 systemd 拉起新进程。

### 不应在正在运行的 Agent 会话中执行

```bash
systemctl --user stop hermes-gateway && systemctl --user start hermes-gateway
```

这正是本次事故的触发方式。

## 可进一步优化的地方

本次只执行了最小止血修复，但从生产可靠性角度，还有几项值得继续处理。

### 1. 收紧高危命令的永久授权

长期运行的 Agent 能接触服务器命令时，“永久允许”必须格外谨慎。尤其应避免长期放行：

```text
停止/重启服务
修改系统配置
sudo 提权执行
执行任意 shell 脚本
```

对具备运维权限的 Agent，危险命令批准机制本身就是安全边界。

### 2. 调整重启等待时间与 systemd 停止窗口

当前 Gateway 的排空等待时间较长，而外层用户服务管理器的停止窗口更短，日志会产生停止超时告警。

一个更合理的配置方向是：

```yaml
agent:
  restart_drain_timeout: 60
```

并让 Gateway service 的 `TimeoutStopSec` 留出额外清理时间。这样即使确实需要重启，也不会在资源紧张的小机器上长时间僵持。

### 3. 解决内存与 swap 问题

虽然 OOM 不是此次 Gateway 离线的根因，但同一台机器已经多次杀掉数据库进程。至少应考虑：

- 增加 swap；
- 限制 Docker 服务内存上限；
- 减少不必要的 worker 数；
- 升级服务器内存规格；
- 对 OOM 与容器重启次数配置监控告警。

### 4. 对远程入口做安全加固

排查日志过程中还能看到大量公网 SSH 密码试探。生产服务器至少应做到：

- 使用密钥登录；
- 禁止密码登录；
- 禁止 root 直接远程密码登录；
- 配置防爆破或访问白名单；
- 审核 Agent 可以使用的 sudo 与 shell 权限。

## 经验总结

这次事故给我的最大提醒是：**当 AI Agent 具备修改自身运行环境的能力时，它就不再只是一个应用程序，也成了一个需要被约束的运维操作者。**

传统服务里，重启通常由外部控制面完成；但 Agent 会根据上下文主动提出并执行操作。当“控制面”和“被控制对象”处于同一个进程树中时，原本简单的 `stop && start` 就可能变成自终止陷阱。

这类系统在上线前，至少应该明确几条原则：

1. 自身服务重启必须走专用控制路径，不能依赖会随服务退出而消失的子进程。
2. 高危运维能力默认应每次确认，不能轻易授予永久权限。
3. 故障调查必须依据日志拆分直接根因与并发风险，避免看到 OOM 就误判所有退出事件。
4. AI Agent 的可靠性设计，需要同时考虑应用生命周期、权限模型和基础设施容量。

AI Agent 能运维服务器确实方便，但给它一把钥匙之后，也必须确保它不会在修门的时候把自己锁在门外。
