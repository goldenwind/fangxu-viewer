/**
 * ContextMenu: Right-click context menu with common image viewing and editing tools
 */
export class ContextMenu {
  constructor({ controller, onOpenSettings }) {
    this.controller = controller;
    this.onOpenSettings = onOpenSettings;
    this.isOpen = false;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.menuEl = document.createElement('div');
    this.menuEl.className = 'viewer-context-menu';
    this.menuEl.style.display = 'none';

    this.menuEl.innerHTML = `
      <div class="context-menu-item" data-action="prev">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </span>
        <span class="item-text">上一张图片</span>
        <span class="item-shortcut">←</span>
      </div>
      <div class="context-menu-item" data-action="next">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </span>
        <span class="item-text">下一张图片</span>
        <span class="item-shortcut">→</span>
      </div>

      <div class="context-menu-divider"></div>

      <div class="context-menu-item" data-action="fit">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </span>
        <span class="item-text">适应窗口</span>
        <span class="item-shortcut">0</span>
      </div>
      <div class="context-menu-item" data-action="actual">
        <span class="item-icon">
          <span style="font-size: 11px; font-weight: 700;">1:1</span>
        </span>
        <span class="item-text">实际大小 (1:1)</span>
        <span class="item-shortcut">1</span>
      </div>
      <div class="context-menu-item" data-action="zoom-in">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </span>
        <span class="item-text">放大图片</span>
        <span class="item-shortcut">+</span>
      </div>
      <div class="context-menu-item" data-action="zoom-out">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </span>
        <span class="item-text">缩小图片</span>
        <span class="item-shortcut">-</span>
      </div>

      <div class="context-menu-divider"></div>

      <div class="context-menu-item" data-action="rotate-right">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </span>
        <span class="item-text">顺时针旋转 90°</span>
        <span class="item-shortcut">R</span>
      </div>
      <div class="context-menu-item" data-action="rotate-left">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </span>
        <span class="item-text">逆时针旋转 90°</span>
        <span class="item-shortcut">L</span>
      </div>
      <div class="context-menu-item" data-action="flip-h">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="m18 18 4-6-4-6v12Z"/><path d="m6 18-4-6 4-6v12Z"/></svg>
        </span>
        <span class="item-text">水平镜像翻转</span>
        <span class="item-shortcut">H</span>
      </div>

      <div class="context-menu-divider"></div>

      <div class="context-menu-item" data-action="slideshow">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </span>
        <span class="item-text">幻灯片放映</span>
        <span class="item-shortcut">F5</span>
      </div>
      <div class="context-menu-item" data-action="filmstrip">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
        </span>
        <span class="item-text">缩略图胶片栏</span>
        <span class="item-shortcut">T</span>
      </div>
      <div class="context-menu-item" data-action="exif">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </span>
        <span class="item-text">图片信息与 EXIF</span>
        <span class="item-shortcut">I</span>
      </div>

      <div class="context-menu-divider"></div>

      <div class="context-menu-item" data-action="copy">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </span>
        <span class="item-text">复制图片数据</span>
        <span class="item-shortcut">⌘C</span>
      </div>
      <div class="context-menu-item" data-action="save-as">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </span>
        <span class="item-text">图片另存为...</span>
        <span class="item-shortcut">⌘S</span>
      </div>
      <div class="context-menu-item" data-action="reveal">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>
          </svg>
        </span>
        <span class="item-text">${typeof navigator !== 'undefined' && (/Mac|iPhone|iPod|iPad/i.test(navigator.platform) || /Macintosh/i.test(navigator.userAgent)) ? '在访达中显示' : '在资源管理器中显示'}</span>
      </div>
      <div class="context-menu-item item-danger" data-action="trash">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </span>
        <span class="item-text">${typeof navigator !== 'undefined' && (/Mac|iPhone|iPod|iPad/i.test(navigator.platform) || /Macintosh/i.test(navigator.userAgent)) ? '移入废纸篓' : '移入回收站'}</span>
        <span class="item-shortcut">Del</span>
      </div>

      <div class="context-menu-divider"></div>

      <div class="context-menu-item" data-action="settings">
        <span class="item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </span>
        <span class="item-text">偏好设置...</span>
        <span class="item-shortcut">⌘,</span>
      </div>
    `;

    document.body.appendChild(this.menuEl);
  }

  bindEvents() {
    // Right click anywhere on window
    window.addEventListener('contextmenu', (e) => {
      // Don't show custom context menu if inside input, textarea, or settings modal
      if (e.target.closest('input, textarea, select, .settings-card, .viewer-help-card')) {
        return;
      }
      e.preventDefault();
      this.open(e.clientX, e.clientY);
    });

    // Close on click outside
    window.addEventListener('click', (e) => {
      if (this.isOpen && !this.menuEl.contains(e.target)) {
        this.close();
      }
    });

    // Close on Esc
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        this.close();
      }
    });

    // Menu item action dispatcher
    this.menuEl.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item) return;

      const action = item.dataset.action;
      this.close();
      this.handleAction(action);
    });
  }

  handleAction(action) {
    if (!this.controller) return;

    switch (action) {
      case 'prev':
        this.controller.prevImage();
        break;
      case 'next':
        this.controller.nextImage();
        break;
      case 'fit':
        this.controller.fitWindow();
        break;
      case 'actual':
        this.controller.actualSize();
        break;
      case 'zoom-in':
        this.controller.zoomIn();
        break;
      case 'zoom-out':
        this.controller.zoomOut();
        break;
      case 'rotate-right':
        this.controller.rotateRight();
        break;
      case 'rotate-left':
        this.controller.rotateLeft();
        break;
      case 'flip-h':
        this.controller.flipH();
        break;
      case 'slideshow':
        this.controller.toggleSlideshow();
        break;
      case 'filmstrip':
        this.controller.toggleFilmstrip();
        break;
      case 'exif':
        this.controller.toggleExif();
        break;
      case 'copy':
        this.controller.copyToClipboard();
        break;
      case 'save-as':
        this.controller.saveAs();
        break;
      case 'reveal':
        this.controller.revealInFileManager();
        break;
      case 'trash':
        this.controller.deleteCurrentImage();
        break;
      case 'settings':
        if (this.onOpenSettings) this.onOpenSettings();
        break;
    }
  }

  open(clientX, clientY) {
    this.isOpen = true;
    this.menuEl.style.display = 'block';

    const menuW = this.menuEl.offsetWidth || 210;
    const menuH = this.menuEl.offsetHeight || 440;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let posX = clientX;
    let posY = clientY;

    // Prevent overflowing right edge
    if (posX + menuW > winW - 8) {
      posX = Math.max(8, clientX - menuW);
    }

    // Prevent overflowing bottom edge
    if (posY + menuH > winH - 8) {
      posY = Math.max(8, clientY - menuH);
    }

    this.menuEl.style.left = `${posX}px`;
    this.menuEl.style.top = `${posY}px`;
  }

  close() {
    this.isOpen = false;
    this.menuEl.style.display = 'none';
  }
}
