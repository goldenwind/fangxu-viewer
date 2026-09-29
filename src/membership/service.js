import { invoke } from '@tauri-apps/api/core';

export class MembershipError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'MembershipError';
    this.status = status;
  }

  get unauthorized() {
    return this.status === 401;
  }
}

function normalizeError(error) {
  if (error instanceof MembershipError) return error;
  if (typeof error === 'string') {
    try {
      return normalizeError(JSON.parse(error));
    } catch {
      return new MembershipError(error);
    }
  }
  if (error && typeof error === 'object') {
    return new MembershipError(error.message || '会员请求失败。', error.status ?? null);
  }
  return new MembershipError('会员请求失败。');
}

export class MembershipService {
  constructor(config) {
    this.config = {
      productId: config.productId,
      baseUrl: config.apiBaseUrl,
    };
    this.credentialService = config.credentialService;
  }

  get configured() {
    return this.config.productId > 0;
  }

  async call(command, args = {}) {
    try {
      return await invoke(command, args);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  challenge() {
    return this.call('membership_challenge', { config: this.config });
  }

  loginStatus(tokenId) {
    return this.call('membership_login_status', { config: this.config, tokenId });
  }

  validate(account) {
    return this.call('membership_validate_account', { config: this.config, account });
  }

  plans() {
    return this.call('membership_plans', { config: this.config });
  }

  status(account) {
    return this.call('membership_status', { config: this.config, account });
  }

  redeemCode(account, code) {
    return this.call('membership_redeem_code', { config: this.config, account, code });
  }

  createOrder(account, productCode) {
    return this.call('membership_create_order', { config: this.config, account, productCode });
  }

  order(account, orderNo) {
    return this.call('membership_order', { config: this.config, account, orderNo });
  }

  loadAccount() {
    return this.call('load_membership_account', { service: this.credentialService });
  }

  saveAccount(account) {
    return this.call('save_membership_account', { service: this.credentialService, account });
  }

  clearAccount() {
    return this.call('clear_membership_account', { service: this.credentialService });
  }
}
