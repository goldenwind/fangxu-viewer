use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::State;

const CREDENTIAL_ACCOUNT: &str = "account";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MembershipConfig {
    product_id: u64,
    base_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    user_id: u64,
    username: String,
    api_token: String,
}

#[derive(Debug, Serialize)]
pub struct MembershipError {
    message: String,
    status: Option<u16>,
}

impl MembershipError {
    fn new(message: impl Into<String>) -> Self {
        Self { message: message.into(), status: None }
    }

    fn response(message: impl Into<String>, status: Option<u16>) -> Self {
        Self { message: message.into(), status }
    }
}

#[derive(Deserialize)]
struct Envelope {
    status: u16,
    message: Option<String>,
    data: Option<Value>,
}

pub struct MembershipClient(Client);

impl Default for MembershipClient {
    fn default() -> Self {
        Self(Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("membership HTTP client should build"))
    }
}

impl MembershipConfig {
    fn base(&self) -> Result<Url, MembershipError> {
        let mut url = Url::parse(&self.base_url)
            .map_err(|_| MembershipError::new("会员服务地址无效。"))?;
        let local_http = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
        if url.scheme() != "https" && !(cfg!(debug_assertions) && url.scheme() == "http" && local_http) {
            return Err(MembershipError::new("会员服务必须使用 HTTPS。"));
        }
        url.set_query(None);
        url.set_fragment(None);
        if !url.path().ends_with('/') {
            let path = format!("{}/", url.path());
            url.set_path(&path);
        }
        Ok(url)
    }

    fn api_url(&self, segments: &[&str]) -> Result<Url, MembershipError> {
        let mut url = self.base()?;
        url.path_segments_mut()
            .map_err(|_| MembershipError::new("会员服务地址无效。"))?
            .extend(segments.iter().copied());
        Ok(url)
    }

    fn product_url(&self, suffix: &[&str]) -> Result<Url, MembershipError> {
        if self.product_id == 0 {
            return Err(MembershipError::new("会员产品尚未配置。"));
        }
        let product_id = self.product_id.to_string();
        let mut parts = vec!["api", "products", product_id.as_str()];
        parts.extend_from_slice(suffix);
        self.api_url(&parts)
    }
}

impl MembershipClient {
    async fn request(
        &self,
        method: Method,
        url: Url,
        token: Option<&str>,
        body: Option<Value>,
    ) -> Result<Value, MembershipError> {
        let mut request = self.0.request(method, url).header("Accept", "application/json");
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await
            .map_err(|_| MembershipError::new("无法连接会员服务，请稍后重试。"))?;
        let http_status = response.status().as_u16();
        let envelope: Envelope = response.json().await
            .map_err(|_| MembershipError::response("会员服务返回了无法识别的数据。", Some(http_status)))?;
        if envelope.status != 200 {
            return Err(MembershipError::response(
                envelope.message.unwrap_or_else(|| "会员请求失败。".into()),
                Some(envelope.status),
            ));
        }
        envelope.data.ok_or_else(|| MembershipError::response("会员服务返回了无法识别的数据。", Some(envelope.status)))
    }
}

fn parse_account(value: &Value) -> Result<Account, MembershipError> {
    serde_json::from_value(value.clone())
        .map_err(|_| MembershipError::new("登录服务返回的账号数据不完整。"))
}

fn validate_credential_service(service: &str) -> Result<(), MembershipError> {
    if service.trim().is_empty() || service.len() > 180 || service.chars().any(char::is_control) {
        return Err(MembershipError::new("安全凭据服务名称无效。"));
    }
    Ok(())
}

#[tauri::command]
pub async fn membership_challenge(
    client: State<'_, MembershipClient>, config: MembershipConfig,
) -> Result<Value, MembershipError> {
    let url = config.api_url(&["api", "users", "verify-code"])?;
    client.request(Method::GET, url, None, None).await
}

#[tauri::command]
pub async fn membership_login_status(
    client: State<'_, MembershipClient>, config: MembershipConfig, token_id: String,
) -> Result<Value, MembershipError> {
    let mut url = config.api_url(&["api", "users", "login-status"])?;
    url.query_pairs_mut().append_pair("token_id", &token_id);
    client.request(Method::GET, url, None, None).await
}

#[tauri::command]
pub async fn membership_validate_account(
    client: State<'_, MembershipClient>, config: MembershipConfig, account: Account,
) -> Result<Account, MembershipError> {
    let user_id = account.user_id.to_string();
    let mut url = config.api_url(&["api", "users", &user_id])?;
    url.query_pairs_mut().append_pair("api_token", &account.api_token);
    let data = client.request(Method::GET, url, None, None).await?;
    parse_account(data.get("user").ok_or_else(|| MembershipError::new("登录服务返回的账号数据不完整。"))?)
}

#[tauri::command]
pub async fn membership_plans(
    client: State<'_, MembershipClient>, config: MembershipConfig,
) -> Result<Value, MembershipError> {
    let url = config.product_url(&["membership", "plans"])?;
    client.request(Method::GET, url, None, None).await
}

#[tauri::command]
pub async fn membership_status(
    client: State<'_, MembershipClient>, config: MembershipConfig, account: Account,
) -> Result<Value, MembershipError> {
    let url = config.product_url(&["membership", "status"])?;
    client.request(Method::GET, url, Some(&account.api_token), None).await
}

#[tauri::command]
pub async fn membership_redeem_code(
    client: State<'_, MembershipClient>, config: MembershipConfig, account: Account, code: String,
) -> Result<Value, MembershipError> {
    if config.product_id == 0 {
        return Err(MembershipError::new("会员产品尚未配置。"));
    }
    let url = config.api_url(&["api", "membership", "activation-codes", "redeem"])?;
    client.request(Method::POST, url, Some(&account.api_token), Some(json!({ "code": code }))).await
}

#[tauri::command]
pub async fn membership_create_order(
    client: State<'_, MembershipClient>, config: MembershipConfig, account: Account, product_code: String,
) -> Result<Value, MembershipError> {
    let url = config.product_url(&["membership", "orders"])?;
    client.request(Method::POST, url, Some(&account.api_token), Some(json!({ "product_code": product_code }))).await
}

#[tauri::command]
pub async fn membership_order(
    client: State<'_, MembershipClient>, config: MembershipConfig, account: Account, order_no: String,
) -> Result<Value, MembershipError> {
    let url = config.product_url(&["membership", "orders", &order_no])?;
    client.request(Method::GET, url, Some(&account.api_token), None).await
}

#[tauri::command]
pub fn load_membership_account(service: String) -> Result<Option<Account>, MembershipError> {
    validate_credential_service(&service)?;
    let entry = keyring::Entry::new(&service, CREDENTIAL_ACCOUNT)
        .map_err(|_| MembershipError::new("无法访问系统安全凭据。"))?;
    match entry.get_password() {
        Ok(secret) => serde_json::from_str(&secret).map(Some)
            .map_err(|_| MembershipError::new("本地登录凭据已损坏，请重新登录。")),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(MembershipError::new("无法读取系统安全凭据。")),
    }
}

#[tauri::command]
pub fn save_membership_account(service: String, account: Account) -> Result<(), MembershipError> {
    validate_credential_service(&service)?;
    let secret = serde_json::to_string(&account)
        .map_err(|_| MembershipError::new("无法保存登录凭据。"))?;
    keyring::Entry::new(&service, CREDENTIAL_ACCOUNT)
        .and_then(|entry| entry.set_password(&secret))
        .map_err(|_| MembershipError::new("无法写入系统安全凭据。"))
}

#[tauri::command]
pub fn clear_membership_account(service: String) -> Result<(), MembershipError> {
    validate_credential_service(&service)?;
    let entry = keyring::Entry::new(&service, CREDENTIAL_ACCOUNT)
        .map_err(|_| MembershipError::new("无法访问系统安全凭据。"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(MembershipError::new("无法删除系统安全凭据。")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_urls_are_scoped_and_path_values_are_encoded() {
        let config = MembershipConfig { product_id: 42, base_url: "https://membership.example".into() };
        let url = config.product_url(&["membership", "orders", "ORDER / 1"]).unwrap();
        assert_eq!(url.as_str(), "https://membership.example/api/products/42/membership/orders/ORDER%20%2F%201");
    }

    #[test]
    fn unconfigured_product_is_rejected() {
        let config = MembershipConfig { product_id: 0, base_url: "https://membership.example".into() };
        assert_eq!(config.product_url(&["membership", "plans"]).unwrap_err().message, "会员产品尚未配置。");
    }

    #[test]
    fn production_endpoint_requires_https() {
        let config = MembershipConfig { product_id: 1, base_url: "http://membership.example".into() };
        assert!(config.base().is_err());
    }
}

