const productId = Number.parseInt(import.meta.env.VITE_MEMBERSHIP_PRODUCT_ID || '0', 10);
const updateProductId = Number.parseInt(
  import.meta.env.VITE_UPDATE_PRODUCT_ID || import.meta.env.VITE_MEMBERSHIP_PRODUCT_ID || '0',
  10,
);

export const APP_CONFIG = Object.freeze({
  brand: {
    name: '方序',
    productName: '方序看图',
    tagline: '极速、简约、流畅的跨平台看图体验。',
  },
  membership: {
    productId: Number.isFinite(productId) ? productId : 0,
    apiBaseUrl: (import.meta.env.VITE_MEMBERSHIP_API_BASE || 'https://x.ip21.cn').replace(/\/$/, ''),
    credentialService: 'com.fangxu.viewer.membership',
    freeUsesPerMonth: 30,
    meteredActionName: '高级图片导出与查看',
    memberBenefit: '尊享极速看图与无限制高级功能',
    publicAccountName: '一灯AI',
    publicAccountQrUrl: 'https://cdn.ip21.cn/img/common/wechat-pub.png',
  },
  updates: {
    productId: Number.isFinite(updateProductId) ? updateProductId : 0,
    apiBaseUrl: (
      import.meta.env.VITE_UPDATE_API_BASE
      || 'https://api.ip21.cn'
    ).replace(/\/$/, ''),
    channel: import.meta.env.VITE_UPDATE_CHANNEL || 'stable',
  },
  feedback: {
    apiBaseUrl: (import.meta.env.VITE_FEEDBACK_API_BASE || 'https://api.ip21.cn').replace(/\/$/, ''),
  },
});
