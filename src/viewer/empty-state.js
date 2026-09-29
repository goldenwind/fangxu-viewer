/**
 * EmptyState: Welcome screen when no image is opened
 */
export class EmptyState {
  constructor({ container, onOpenFile }) {
    this.container = container;
    this.onOpenFile = onOpenFile;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-empty-state');
    this.container.innerHTML = `
      <div class="empty-card">
        <div class="empty-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <h2 class="empty-title">方序看图</h2>
        <p class="empty-desc">极速、简约的跨平台看图软件。拖拽图片或文件夹到此处，即刻浏览。</p>

        <div class="empty-actions">
          <button class="empty-primary-btn" id="empty-btn-open">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            <span>打开图片...</span>
          </button>
        </div>

        <div class="empty-format-tags">
          <span class="fmt-tag">JPG</span>
          <span class="fmt-tag">PNG</span>
          <span class="fmt-tag">GIF</span>
          <span class="fmt-tag">WEBP</span>
          <span class="fmt-tag">BMP</span>
          <span class="fmt-tag">SVG</span>
          <span class="fmt-tag">ICO</span>
          <span class="fmt-tag">TIFF</span>
          <span class="fmt-tag">AVIF</span>
        </div>

        <div class="empty-tips-grid">
          <div class="tip-cell">
            <kbd>鼠标滚轮</kbd>
            <span>以光标中心平滑缩放</span>
          </div>
          <div class="tip-cell">
            <kbd>鼠标双击</kbd>
            <span>自适应与 1:1 实际尺寸切换</span>
          </div>
          <div class="tip-cell">
            <kbd>← / →</kbd>
            <span>快速切换同文件夹图片</span>
          </div>
          <div class="tip-cell">
            <kbd>F11 / 回车</kbd>
            <span>沉浸式全屏看图模式</span>
          </div>
        </div>
      </div>
    `;

    this.openBtn = this.container.querySelector('#empty-btn-open');
  }

  bindEvents() {
    this.openBtn.addEventListener('click', () => {
      if (this.onOpenFile) this.onOpenFile();
    });
  }

  show() {
    this.container.style.display = 'flex';
  }

  hide() {
    this.container.style.display = 'none';
  }
}
