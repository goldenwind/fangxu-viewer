# 产品升级客户端集成

升级模块是独立能力：`src/update` 负责启动检查、提示与交互，`src-tauri/src/update.rs` 负责读取真实应用版本、识别平台/架构、联网和下载校验。未配置产品 ID 时模块完全关闭。

## 配置

```dotenv
VITE_UPDATE_PRODUCT_ID=服务端产品ID
VITE_UPDATE_API_BASE=https://api.ip21.cn
VITE_UPDATE_CHANNEL=stable
```

若省略 `VITE_UPDATE_PRODUCT_ID`，会复用会员产品 ID；若省略 `VITE_UPDATE_API_BASE`，默认使用 `https://api.ip21.cn`，与会员 API 地址无关。应用当前版本来自 `src-tauri/tauri.conf.json`，发布新安装包时必须同步更新。

## 行为

- 应用启动后调用 `GET https://api.ip21.cn/api/products/:product_id/releases/latest`。
- 可选升级可跳过；同一版本不再提示，服务端出现更高版本时重新提示。
- 强制升级显示不可关闭的顶层遮罩，应用功能在升级前不可操作。
- 有安装包直链时可后台下载并显示进度；有 SHA-256 时 Rust 端会强制校验。
- 有产品页地址时可调用系统浏览器打开下载页。
- 下载完成后只在文件管理器中定位安装包，不静默执行安装程序。
- 检查接口暂时不可用不会阻止应用启动，避免升级服务故障导致正常版本不可用。

## 复用

复制到新产品后通常只需配置产品 ID、API 地址和渠道。若 UI 框架不同，可保留 `UpdateService` 与 Rust 命令，只替换 `UpdateManager`。服务端返回数据使用通用字段，不依赖 Tauri，也可供 Electron 或原生客户端消费。

## 发布建议

1. 上传安装包并记录字节数和 SHA-256。
2. 先创建停用状态的记录，核对版本、平台、架构和 URL。
3. 以可选升级和较小灰度比例启用，完成真实机器验证。
4. 逐步提升灰度比例；只有确需阻断旧版时才设置强制升级或最低可用版本。
5. 强制升级记录必须具备可工作的安装包直链或产品下载页，并保持 100% 灰度。
