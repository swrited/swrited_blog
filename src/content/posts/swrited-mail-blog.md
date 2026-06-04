---
title: 用 Cloudflare Email Routing + Worker 搭建自己的 WebMail 临时邮箱系统
published: 2026-05-29
description: 记录使用 Cloudflare Email Routing、Email Worker、SendGrid SMTP Relay、Flask 和 Caddy 搭建自己的 WebMail 临时邮箱系统。
cover: /images/covers/swrited-mail-cover.webp
coverInContent: true
tags:
  - Deployment
  - Email
  - Cloudflare
  - SendGrid
  - Python
category: Deployment
comment: true
draft: false
---

最近我用自己的域名 `swrited.top` 搭了一个轻量级邮箱网站：

```text
https://email.swrited.top
```

它可以实现：

- 创建 `@swrited.top` 邮箱
- 接收验证码邮件
- 网页查看收件箱
- 自动提取验证码
- 网页发送邮件
- 任意地址 Catch-all 收信
- 不需要服务器开放公网 25 端口

最终方案是：

```text
Cloudflare Email Routing 收信
Cloudflare Email Worker 转发邮件到后端
SendGrid SMTP Relay 负责发信
Flask + HTML 实现 WebMail 页面
Caddy 负责 HTTPS 反向代理
```

这篇文章记录一下完整搭建过程。

> 说明：文章中所有 API Key、Token、服务器密码等敏感信息均已隐藏或替换。

---

## 一、为什么要这样搭？

最开始的想法很简单：

```text
用自己的服务器监听 25 端口，直接接收 @swrited.top 邮件
```

但实际部署时遇到了一个问题：

很多云服务器厂商会限制 `25` 端口。

我的情况是：

- 本机可以监听 `25`
- 本机投递邮件正常
- DNS/MX 配置也正常
- 但公网连接服务器 `25` 端口超时

这意味着 Gmail、Hotmail 等外部邮件服务器无法把邮件直接投递到我的 ECS。

所以最后换了思路：

```text
不让自己的服务器直接收公网 25 邮件
而是让 Cloudflare 帮我收邮件
再通过 HTTPS 推送到我的后端
```

这样服务器只需要开放 `443`，不需要开放 `25`。

---

## 二、最终架构

整体链路如下：

```text
发件人 Gmail / Hotmail / 其他邮箱
        │
        ▼
Cloudflare Email Routing
        │
        ▼
Cloudflare Email Worker
        │
        ├── 转发到个人 Hotmail
        │
        └── POST 到 https://email.swrited.top/inbound
                    │
                    ▼
              Flask 后端保存邮件
                    │
                    ▼
              WebMail 前端显示
```

发信链路：

```text
WebMail 写邮件
        │
        ▼
Flask /send API
        │
        ▼
SendGrid SMTP Relay :587
        │
        ▼
目标邮箱
```

这个方案的优点：

- 不需要公网开放 `25`
- 可以 Catch-all 收任意 `@swrited.top` 地址
- 邮件能同时进网页收件箱和转发到 Hotmail
- 发信走 SendGrid，避开云服务器出站 25 限制
- 整体比较轻量，不需要搭完整 Postfix/Dovecot 邮件系统

---

## 三、DNS 配置

DNS 托管在 Cloudflare。

### 1. WebMail 站点解析

```text
Type: A
Name: email
Value: 服务器公网 IP
TTL: Auto
```

访问地址：

```text
https://email.swrited.top
```

---

### 2. Cloudflare Email Routing MX

启用 Cloudflare Email Routing 后，需要把域名 MX 改成 Cloudflare 提供的记录。

示例：

```text
MX  @  route1.mx.cloudflare.net
MX  @  route2.mx.cloudflare.net
MX  @  route3.mx.cloudflare.net
```

同时 Cloudflare 会要求添加 SPF/DKIM 相关 TXT 记录，例如：

```text
TXT  @                       v=spf1 include:_spf.mx.cloudflare.net ~all
TXT  cf2024-1._domainkey     v=DKIM1; ...
```

这些记录建议直接用 Cloudflare 页面里的“添加”按钮自动添加，避免手动复制 DKIM 长文本出错。

---

### 3. SendGrid 域名认证

SendGrid 发信也需要做域名认证。

一般会给出几条 CNAME/TXT，例如：

```text
CNAME  emxxxx.example.com          uxxxx.wl.sendgrid.net
CNAME  s1._domainkey.example.com   s1.domainkey.uxxxx.wl.sendgrid.net
CNAME  s2._domainkey.example.com   s2.domainkey.uxxxx.wl.sendgrid.net
TXT    _dmarc.example.com          v=DMARC1; p=none;
```

添加完成后在 SendGrid 后台点击 Verify。

建议：

```text
SendGrid 相关 CNAME 使用 DNS only
```

---

## 四、Cloudflare Email Routing 配置

进入 Cloudflare：

```text
域名 → 电子邮件 → 电子邮件路由
```

### 1. 添加目标地址

先在：

```text
目标地址
```

添加自己的真实邮箱，比如：

```text
yourname@hotmail.com
```

Cloudflare 会发送确认邮件，必须点击确认后才能使用。

---

### 2. 开启 Catch-all

进入：

```text
路由规则
```

找到：

```text
Catch-all 地址
```

开启后，所有地址都会被接收：

```text
anything@example.com
abc123@example.com
hello@example.com
```

最初可以先设置为：

```text
操作：发送到电子邮件
目标：yourname@hotmail.com
```

这样可以先验证 Cloudflare 收信是否正常。

---

## 五、Cloudflare Email Worker

为了让邮件进入我们自己的网页收件箱，需要创建 Email Worker。

入口：

```text
Cloudflare → 电子邮件 → 电子邮件 Workers
```

创建一个 Worker，例如：

```text
swrited-mail-worker
```

示例代码：

```js
export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).text();

    await fetch("https://email.example.com/inbound", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Token": "替换成自己的安全 Token"
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        from: message.from,
        to: [message.to],
        subject: message.headers.get("subject") || "",
        raw: raw,
        text: raw,
        html: ""
      })
    });

    // 可选：同时转发到自己的真实邮箱
    await message.forward("yourname@hotmail.com");
  }
}
```

部署 Worker 后，回到：

```text
电子邮件路由 → 路由规则 → Catch-all
```

把操作从：

```text
发送到电子邮件
```

改成：

```text
发送到 Worker
```

选择刚创建的 Worker。

这样所有 `@example.com` 邮件都会：

1. 进入网页收件箱
2. 同时转发到真实邮箱

---

## 六、后端服务设计

后端使用 Python + Flask。

目录结构：

```text
/opt/yyds-mail/
├── server.py
├── apikey.txt
├── inbound_token.txt
├── sendgrid_key.txt
└── web/
    └── index.html
```

核心功能：

- `/accounts` 创建临时邮箱
- `/messages` 获取邮件列表
- `/messages/<id>` 查看邮件详情
- `/send` 发送邮件
- `/inbound` 接收 Cloudflare Worker 推送的邮件
- `/health` 健康检查

---

## 七、/inbound 接口

Cloudflare Email Worker 会把邮件通过 HTTPS POST 到：

```text
https://email.example.com/inbound
```

后端会验证请求头：

```text
X-Inbound-Token: 自定义安全 Token
```

收到后做几件事：

1. 验证 Token
2. 读取 `raw` 原始邮件
3. 解析 RFC822 邮件内容
4. 提取 Subject、From、To、text/plain、text/html
5. 存入收件箱
6. 前端刷新后显示

需要注意的是：

Cloudflare Worker 传来的通常是完整 raw 邮件，如果不解析，前端看到的可能是一大段 MIME 原文，甚至像空白。

所以后端需要解析：

```python
parsed = email.message_from_string(raw)
```

然后遍历 multipart：

```python
for part in parsed.walk():
    if part.get_content_type() == 'text/plain':
        # 提取文本正文
    elif part.get_content_type() == 'text/html':
        # 提取 HTML 正文
```

---

## 八、Web API 简介

### 创建邮箱

```http
POST /accounts
Content-Type: application/json
```

请求：

```json
{
  "localPart": "test123",
  "domain": "example.com"
}
```

返回：

```json
{
  "address": "test123@example.com",
  "tempToken": "临时访问令牌",
  "accountId": "邮箱 ID"
}
```

---

### 获取邮件列表

```http
GET /messages?address=test123@example.com&limit=20
Authorization: Bearer <tempToken>
```

---

### 获取邮件详情

```http
GET /messages/<message_id>?address=test123@example.com
Authorization: Bearer <tempToken>
```

---

### 发送邮件

```http
POST /send
Authorization: Bearer <tempToken>
Content-Type: application/json
```

请求：

```json
{
  "from": "test123@example.com",
  "to": "someone@example.net",
  "subject": "测试邮件",
  "body": "这是一封测试邮件"
}
```

为了防止滥用，可以加限流，例如：

```text
每个邮箱每小时最多发送 10 封
```

---

## 九、SendGrid 发信

由于云服务器一般会限制出站 25，所以发信用 SendGrid SMTP Relay。

SendGrid SMTP 参数：

```text
Server: smtp.sendgrid.net
Port: 587
Username: apikey
Password: SendGrid API Key
```

Python 示例：

```python
import smtplib
from email.mime.text import MIMEText

msg = MIMEText("邮件正文", _charset="utf-8")
msg["Subject"] = "测试邮件"
msg["From"] = "test@example.com"
msg["To"] = "someone@example.net"

s = smtplib.SMTP("smtp.sendgrid.net", 587, timeout=30)
s.ehlo()
s.starttls()
s.ehlo()
s.login("apikey", SENDGRID_API_KEY)
s.sendmail("test@example.com", ["someone@example.net"], msg.as_string())
s.quit()
```

---

## 十、前端页面

前端是一个单页 HTML。

主要功能：

- 创建邮箱
- 随机邮箱名前缀
- 复制邮箱地址
- 自动刷新收件箱
- 查看邮件内容
- 自动提取 4-8 位验证码
- 写邮件
- 移动端适配

页面结构大概是：

```text
Swrited Mail

[创建邮箱输入框]

Tabs:
- 收件箱
- 写邮件
```

用户流程：

```text
1. 打开 https://email.example.com
2. 输入邮箱前缀，例如 test123
3. 点击创建邮箱
4. 使用 test123@example.com 注册网站
5. 等待验证码邮件进入网页收件箱
6. 点击邮件查看验证码
```

---

## 十一、Caddy 反向代理

Caddy 配置示例：

```text
email.example.com {
    reverse_proxy 127.0.0.1:8000
}
```

如果 Flask 服务运行在 Docker 网络或宿主机网关上，可以根据实际情况调整地址。

重载 Caddy：

```bash
sudo systemctl reload caddy
```

如果 Caddy 在 Docker 容器内：

```bash
sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

---

## 十二、systemd 服务

为了让后端开机自启，可以创建：

```text
/etc/systemd/system/yyds-mail.service
```

内容：

```ini
[Unit]
Description=YYDS Mail Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 -u /opt/yyds-mail/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now yyds-mail
```

查看状态：

```bash
systemctl status yyds-mail --no-pager -l
```

查看日志：

```bash
journalctl -u yyds-mail -n 100 --no-pager
```

---

## 十三、测试方法

### 1. 测试健康检查

```bash
curl https://email.example.com/health
```

---

### 2. 测试创建邮箱

```bash
curl -s -X POST https://email.example.com/accounts \
  -H 'Content-Type: application/json' \
  -d '{"localPart":"webtest"}'
```

---

### 3. 测试 Worker 推送

```bash
curl -s -X POST https://email.example.com/inbound \
  -H 'Content-Type: application/json' \
  -H 'X-Inbound-Token: 替换成自己的 Token' \
  -d '{
    "to":["webtest@example.com"],
    "from":"tester@example.net",
    "subject":"worker inbound test",
    "text":"hello from worker api"
  }'
```

---

### 4. 测试真实收信

从 Hotmail/Gmail 发一封到：

```text
webtest@example.com
```

然后观察后端日志：

```bash
journalctl -u yyds-mail -n 100 --no-pager
```

如果看到类似：

```text
[INBOUND] Worker 推送邮件 → webtest@example.com | test subject
```

说明 Cloudflare Email Worker 已经打通。

---

## 十四、遇到的问题

### 1. 服务器公网 25 不通

表现：

```text
公网检测 25 端口 Connection timed out
```

解决：

```text
不用服务器直接收 25，改用 Cloudflare Email Routing + Email Worker
```

---

### 2. 前端 401

表现：

```text
/messages?... 401 Unauthorized
```

原因：

后端重启后，内存里的邮箱 token 丢失，浏览器还在用旧 token 刷新。

解决：

```text
刷新页面，重新创建同名邮箱
```

更好的方案是后续加数据库持久化。

---

### 3. Worker 邮件进来了但内容看不了

原因：

Cloudflare Worker 推送的是 raw 邮件，前端直接显示会很乱。

解决：

后端解析 raw 邮件，提取 text/plain 和 text/html。

---

### 4. Catch-all 只转发到 Hotmail，不进网页

原因：

Catch-all 操作还是“发送到电子邮件”。

解决：

把 Catch-all 改成：

```text
发送到 Worker
```

然后在 Worker 里：

```js
await message.forward("yourname@hotmail.com");
```

这样既进网页，也转发到 Hotmail。

---

## 十五、当前限制

当前版本仍然比较轻量，有一些限制：

1. 邮件存在内存里，后端重启会清空
2. 页面刷新后 token 可能丢失
3. 没有账号登录系统
4. 没有附件管理
5. HTML 邮件没有做完整安全沙箱
6. 发信依赖 SendGrid 账号状态
7. 防滥用能力比较基础

---

## 十六、后续优化方向

可以继续加：

- SQLite/PostgreSQL 持久化
- 邮箱有效期
- 管理后台
- 用户登录
- IP 限流
- Cloudflare Turnstile 人机验证
- 附件存储
- HTML 邮件沙箱渲染
- 邮件搜索
- SPF/DKIM/DMARC 检测
- SendGrid API Key 轮换

---

## 总结

这套方案的核心是：

```text
Cloudflare 收信，Worker 推送，SendGrid 发信
```

相比自己搭完整邮件服务器，它更轻量，也更适合云服务器 25 端口受限的场景。

最终链路：

```text
别人发邮件 → Cloudflare Email Routing → Email Worker → WebMail 后端 → 网页收件箱
```

发信链路：

```text
网页写邮件 → Flask API → SendGrid SMTP Relay → 对方邮箱
```

对于个人项目、验证码接收、临时邮箱、自动化注册测试，这个方案已经比较实用了。
