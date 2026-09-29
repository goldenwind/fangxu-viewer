export class UsageTracker {
  constructor({ limit, storage = localStorage, now = () => new Date(), key = 'fangxu.free-usage' }) {
    this.limit = Math.max(0, Number(limit) || 0);
    this.storage = storage;
    this.now = now;
    this.key = key;
  }

  get month() {
    const now = this.now();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  get used() {
    try {
      const saved = JSON.parse(this.storage.getItem(this.key) || '{}');
      return saved.month === this.month ? Math.max(0, Number(saved.count) || 0) : 0;
    } catch {
      return 0;
    }
  }

  get remaining() {
    return Math.max(0, this.limit - this.used);
  }

  recordSuccess() {
    this.storage.setItem(this.key, JSON.stringify({ month: this.month, count: this.used + 1 }));
  }
}

