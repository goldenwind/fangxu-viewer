# 通用会员与购买流程

## 运行时流程

```text
选择套餐 ──未登录──> 获取五位登录码 ──公众号验证──> 保存账号
   │                                                   │
   └────────────────已登录─────────────────────────────┤
                                                       v
创建订单 ──> 展示支付宝二维码 ──每 3 秒查询──> 支付成功
                                                       │
                                                       v
                                      最多 5 次重试刷新会员权益
```

账号启动恢复时先从系统安全凭据读取，再调用服务端验证。验证成功后刷新权益；验证返回 401 时清除本地账号。最近三天内确认过的有效会员权益可用于短时断网降级，但缓存必须匹配用户 ID，且本身未过期。

激活码流程与购买共用登录和最终权益刷新。兑换接口成功后仍核对 `product_id`，避免把其他产品的激活结果误报为当前产品会员。

## API 契约

服务端响应统一为：

```json
{"status": 200, "message": "ok", "data": {}}
```

客户端使用以下接口：

| 方法 | 路径 | 鉴权 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/users/verify-code` | 无 | 获取 `token_id` 和五位 `code` |
| GET | `/api/users/login-status?token_id=…` | 无 | 查询微信登录结果 |
| GET | `/api/users/{user_id}?api_token=…` | 查询参数 | 恢复账号时重新验证 |
| GET | `/api/products/{id}/membership/plans` | 无 | 获取可售套餐 |
| GET | `/api/products/{id}/membership/status` | Bearer | 获取当前产品权益 |
| POST | `/api/products/{id}/membership/orders` | Bearer | 以 `product_code` 创建订单 |
| GET | `/api/products/{id}/membership/orders/{order_no}` | Bearer | 查询订单支付状态 |
| POST | `/api/membership/activation-codes/redeem` | Bearer | 以 `code` 兑换激活码 |

创建订单返回的 `actual_amount` 是客户端展示的实付金额。付款二维码优先读取 `payment.qr_code_image`（Base64 或 data URL），其次展示 `payment.qr_code`。套餐名称、售价、原价、推荐标签和描述都来自服务端，客户端不硬编码价格。

## 免费额度

`UsageTracker` 按本机自然月保存成功次数。`AccessGate` 的语义是：

- 会员直接执行，不计次；
- 非会员有余额时执行，成功后计一次；
- 核心操作抛出异常时不计次；
- 余额为零时不执行并打开会员中心。

如果新产品存在批处理，应在产品层明确“一次”的定义，并让 `operation` 只在整个事务达到成功条件时返回。

## 发布前核验

1. 服务端 `plans` 返回正确产品的全部套餐；
2. macOS、Windows、Linux 分别验证安全凭据读写；
3. 真实账号走通登录、创建订单、扫码支付、订单查询和权益刷新；
4. 验证激活码的有效、无效、已使用、其他产品四种情况；
5. 验证未登录、Token 失效、断网、二维码缺失、订单关闭和权益同步延迟；
6. 核对隐私说明、退款规则、有效期文案以及“非自动续费”声明。

