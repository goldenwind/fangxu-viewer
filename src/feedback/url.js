export function createFeedbackUrl({ baseUrl, productId, apiToken }) {
  if (!Number.isSafeInteger(productId) || productId <= 0 || !apiToken) {
    throw new Error('反馈页缺少产品或登录信息。');
  }
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) {
    throw new Error('反馈页必须使用 HTTPS。');
  }
  const url = new URL(`/products/${productId}/feedback`, base);
  url.hash = new URLSearchParams({ api_token: apiToken }).toString();
  return url.toString();
}
