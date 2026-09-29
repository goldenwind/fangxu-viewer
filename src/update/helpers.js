const INSTALLATION_KEY = 'fangxu-update-installation-id';
const SKIPPED_VERSION_KEY = 'fangxu-update-skipped-version';

export function getInstallationId(storage = localStorage, cryptoApi = crypto) {
  let value = storage.getItem(INSTALLATION_KEY);
  if (value) return value;
  value = typeof cryptoApi.randomUUID === 'function'
    ? cryptoApi.randomUUID()
    : `install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(INSTALLATION_KEY, value);
  return value;
}

export function isSkippedVersion(version, storage = localStorage) {
  return Boolean(version) && storage.getItem(SKIPPED_VERSION_KEY) === version;
}

export function skipVersion(version, storage = localStorage) {
  if (version) storage.setItem(SKIPPED_VERSION_KEY, version);
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / (1024 ** unit);
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

export function updateErrorMessage(error) {
  if (typeof error === 'string') return error;
  return error?.message || '升级服务暂时不可用，请稍后重试。';
}
