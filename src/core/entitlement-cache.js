const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export class EntitlementCache {
  constructor({ storage = localStorage, now = () => new Date(), key = 'fangxu.entitlement-cache' } = {}) {
    this.storage = storage;
    this.now = now;
    this.key = key;
  }

  save(account, status) {
    this.storage.setItem(this.key, JSON.stringify({
      userId: account.userId,
      checkedAt: this.now().toISOString(),
      status,
    }));
  }

  load(account) {
    if (!account) return null;
    try {
      const cached = JSON.parse(this.storage.getItem(this.key) || '{}');
      const checkedAt = new Date(cached.checkedAt);
      const age = this.now().getTime() - checkedAt.getTime();
      if (cached.userId !== account.userId || !cached.status?.is_vip || age < 0 || age > MAX_AGE_MS) return null;
      if (cached.status.expired_at) {
        const expiry = new Date(cached.status.expired_at);
        if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < this.now().getTime()) return null;
      }
      return cached.status;
    } catch {
      return null;
    }
  }

  clear() {
    this.storage.removeItem(this.key);
  }
}

