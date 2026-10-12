# 客户端检查更新

“偏好设置”的“关于与更新”中的“检查更新”手动调用 `gf_api` 的公开产品升级接口，无需登录：

```http
GET https://api.ip21.cn/api/products/12/releases/latest?current_version=0.1.0&channel=stable&platform=macos&arch=aarch64&installation_id=随机UUID
```

产品 ID `12` 与产品反馈保持一致。协议依据 `gf_api/docs/product_upgrade_api.md`。

- 当前版本来自原生客户端包信息，平台和架构来自编译目标。服务端会将 macOS 的 `macos`、Windows 的 `windows`、Linux 的 `linux` 以及常见架构别名归一化。
- 随机安装 UUID 首次检查时创建，保存在系统应用配置目录的 `installation-id` 文件中，供灰度发布稳定分桶使用。不发送硬件或隐私标识。
- 原生 Rust 请求连接超时为 5 秒，总超时为 15 秒，限制响应为 256 KiB。服务异常、网络失败和无效响应均显示失败，可再次检查。
- 无更新时显示“当前已是最新版本”；有更新时显示版本号、发布标题、纯文本更新说明与下载按钮。`force_update` 会显示需要升级的提示。
- 下载按钮通过系统浏览器打开服务端的 HTTPS `download_url`；无有效下载地址时使用 HTTPS `page_url`。安装由用户手动完成。
- 支持在 macOS 菜单栏“帮助”->“检查更新...”直接调起关于设置面板。
