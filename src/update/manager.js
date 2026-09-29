import { listen } from '@tauri-apps/api/event';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import {
  formatBytes,
  getInstallationId,
  isSkippedVersion,
  skipVersion,
  updateErrorMessage,
} from './helpers.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

export class UpdateManager {
  constructor({ root, service, config }) {
    this.root = root;
    this.service = service;
    this.config = config;
    this.release = null;
    this.downloading = false;
  }

  async initialize() {
    if (!this.service.enabled) return;
    try {
      const release = await this.service.check(getInstallationId());
      if (!release.updateAvailable || (!release.forceUpdate && isSkippedVersion(release.latestVersion))) return;
      this.release = release;
      this.render();
    } catch (error) {
      // Upgrade checks must never make an otherwise usable app fail to start.
      console.warn('Product update check failed:', updateErrorMessage(error));
    }
  }

  render(message = '') {
    const release = this.release;
    if (!release) return;
    const forceCopy = release.forceUpdate
      ? '<strong class="update-required">此版本必须升级后才能继续使用。</strong>'
      : '<span>你可以稍后升级；跳过后仅在发布新版本时再次提示。</span>';
    const size = formatBytes(release.fileSize);
    this.root.innerHTML = `
      <div class="update-backdrop" role="presentation">
        <section class="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
          <span class="eyebrow">PRODUCT UPDATE · ${escapeHtml(release.channel).toUpperCase()}</span>
          <h2 id="update-title">${escapeHtml(release.title || `发现新版本 ${release.latestVersion}`)}</h2>
          <p class="update-version">当前 ${escapeHtml(release.currentVersion)} → 最新 ${escapeHtml(release.latestVersion)}${size ? ` · ${size}` : ''}</p>
          <div class="update-notes">${escapeHtml(release.releaseNotes || '包含功能改进与问题修复。').replace(/\n/g, '<br>')}</div>
          <p class="update-policy">${forceCopy}</p>
          <div class="update-progress" data-update-progress ${message ? '' : 'hidden'}>
            <div><i data-update-progress-bar></i></div><span data-update-message>${escapeHtml(message)}</span>
          </div>
          <div class="update-actions">
            ${release.downloadUrl ? '<button class="primary-button" data-download-update>后台下载安装包</button>' : ''}
            ${release.pageUrl ? '<button class="outline-button" data-open-update-page>打开产品下载页</button>' : ''}
            ${release.forceUpdate ? '' : '<button class="text-button" data-skip-update>跳过此版本</button>'}
          </div>
        </section>
      </div>`;
    this.bind();
  }

  bind() {
    this.root.querySelector('[data-skip-update]')?.addEventListener('click', () => {
      skipVersion(this.release.latestVersion);
      this.root.innerHTML = '';
      this.release = null;
    });
    this.root.querySelector('[data-open-update-page]')?.addEventListener('click', async () => {
      try {
        await openUrl(this.release.pageUrl);
      } catch (error) {
        this.showMessage(updateErrorMessage(error));
      }
    });
    this.root.querySelector('[data-download-update]')?.addEventListener('click', () => this.download());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.release && !this.release.forceUpdate) {
        this.root.innerHTML = '';
        this.release = null;
      }
    });
  }

  showMessage(message, percent) {
    const progress = this.root.querySelector('[data-update-progress]');
    const label = this.root.querySelector('[data-update-message]');
    const bar = this.root.querySelector('[data-update-progress-bar]');
    if (!progress || !label || !bar) return;
    progress.hidden = false;
    label.textContent = message;
    if (Number.isFinite(percent)) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }

  async download() {
    if (this.downloading) return;
    this.downloading = true;
    const button = this.root.querySelector('[data-download-update]');
    if (button) button.disabled = true;
    this.showMessage('正在准备下载…', 0);
    let unlisten = () => {};
    try {
      unlisten = await listen('product-update-download-progress', ({ payload }) => {
        const percent = payload.total > 0 ? (payload.downloaded / payload.total) * 100 : undefined;
        this.showMessage(payload.total > 0 ? `正在下载 ${Math.round(percent)}%` : `已下载 ${formatBytes(payload.downloaded)}`, percent);
      });
      const result = await this.service.download(this.release);
      this.showMessage('下载完成，已在文件管理器中定位安装包。请退出应用后安装新版本。', 100);
      await revealItemInDir(result.path);
    } catch (error) {
      this.showMessage(`下载失败：${updateErrorMessage(error)}`);
      if (button) button.disabled = false;
    } finally {
      unlisten();
      this.downloading = false;
    }
  }
}
