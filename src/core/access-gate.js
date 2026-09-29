export class AccessGate {
  constructor({ usage, isMember, onBlocked, onChanged = () => {} }) {
    this.usage = usage;
    this.isMember = isMember;
    this.onBlocked = onBlocked;
    this.onChanged = onChanged;
  }

  async run(operation) {
    if (!this.isMember() && this.usage.remaining <= 0) {
      this.onBlocked();
      return { ok: false, reason: 'quota-exhausted' };
    }
    const value = await operation();
    if (!this.isMember()) this.usage.recordSuccess();
    this.onChanged();
    return { ok: true, value };
  }
}

