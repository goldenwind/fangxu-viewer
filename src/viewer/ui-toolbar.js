/**
 * UIToolbar: Manages 2345-style Topbar, Floating Bottom Toolbar, and Side Navigation Arrows
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export class UIToolbar {
  constructor({
    topbarContainer,
    bottomToolbarContainer,
    sideArrowsContainer,
    controller,
    canvasView,
    onOpenSettings,
  }) {
    this.topbarContainer = topbarContainer;
    this.bottomToolbarContainer = bottomToolbarContainer;
    this.sideArrowsContainer = sideArrowsContainer;
    this.controller = controller;
    this.canvasView = canvasView;
    this.onOpenSettings = onOpenSettings;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    // 1. Topbar
    this.topbarContainer.classList.add('viewer-topbar');
    this.topbarContainer.setAttribute('data-tauri-drag-region', 'true');
    this.topbarContainer.innerHTML = `
      <div class="topbar-left" data-tauri-drag-region="true">
        <div class="app-brand" data-tauri-drag-region="true">
          <svg class="app-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
          <span class="app-name">方序看图</span>
        </div>
        <div class="file-name-badge" id="top-filename" title="当前文件名">-</div>
      </div>

      <div class="topbar-center" data-tauri-drag-region="true">
        <div class="meta-tag" id="top-dimensions" title="分辨率" style="display:none;"></div>
        <div class="meta-tag" id="top-filesize" title="文件大小" style="display:none;"></div>
        <div class="meta-tag" id="top-index-counter" title="当前张数 / 总张数" style="display:none;"></div>
        <div class="meta-tag meta-zoom-tag" id="top-zoom" title="当前缩放比">适应窗口</div>
      </div>

      <div class="topbar-right">
        <button class="top-icon-btn" id="btn-top-open" title="打开图片 (Ctrl/Cmd + O)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          <span>打开</span>
        </button>
        <button class="top-icon-btn" id="btn-top-reveal" title="在访达/资源管理器中定位" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span>定位</span>
        </button>
        <button class="top-icon-btn" id="btn-top-copy" title="复制图片到剪贴板 (Ctrl/Cmd + C)" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>复制</span>
        </button>
        <button class="top-icon-btn" id="btn-top-saveas" title="另存为... (Ctrl/Cmd + S)" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>另存为</span>
        </button>
        <button class="top-icon-btn" id="btn-top-help" title="查看快捷键与帮助">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          <span>帮助</span>
        </button>
        <button class="top-icon-btn" id="btn-top-settings" title="偏好设置 (Ctrl/Cmd + ,)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>设置</span>
        </button>
      </div>
    `;

    // 2. Bottom Floating Toolbar (Classic 2345 Design)
    this.bottomToolbarContainer.classList.add('viewer-bottom-toolbar');
    this.bottomToolbarContainer.innerHTML = `
      <div class="bottom-bar-pill">
        <button class="toolbar-btn" id="bar-prev" title="上一张 (← / PageUp / A)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button class="toolbar-btn" id="bar-next" title="下一张 (→ / PageDown / D)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn" id="bar-zoom-out" title="缩小 (- / 滚轮向下)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>

        <div class="toolbar-zoom-label" id="bar-zoom-label" title="点击重置为适应窗口 (0)">
          100%
        </div>

        <button class="toolbar-btn" id="bar-zoom-in" title="放大 (+ / 滚轮向上)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>

        <button class="toolbar-btn" id="bar-actual-size" title="实际大小 1:1 (按数字 1)">
          <span class="btn-text-badge">1:1</span>
        </button>

        <button class="toolbar-btn is-active" id="bar-fit-window" title="适应窗口 (按数字 0)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn" id="bar-rotate-left" title="逆时针旋转 90° (L)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button class="toolbar-btn" id="bar-rotate-right" title="顺时针旋转 90° (R)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        </button>
        <button class="toolbar-btn" id="bar-flip-h" title="水平翻转 (H)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="m18 18 4-6-4-6v12Z"/><path d="m6 18-4-6 4-6v12Z"/></svg>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn" id="bar-slideshow" title="幻灯片放映 (F5 / 空格)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>

        <button class="toolbar-btn" id="bar-filmstrip" title="缩略图胶片栏 (T)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
        </button>

        <button class="toolbar-btn" id="bar-exif" title="图片信息 / EXIF (I)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </button>

        <button class="toolbar-btn toolbar-btn-danger" id="bar-trash" title="移入回收站 (Delete)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x1="10" y1="11" y2="17"/><line x2="14" x1="14" y1="11" y2="17"/></svg>
        </button>

        <button class="toolbar-btn" id="bar-fullscreen" title="全屏查看 (F11 / Enter)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    `;

    // 3. Side hover arrows
    this.sideArrowsContainer.classList.add('viewer-side-arrows');
    this.sideArrowsContainer.innerHTML = `
      <div class="side-arrow side-arrow-left" id="arrow-prev" title="上一张 (←)">
        <div class="arrow-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>
        </div>
      </div>
      <div class="side-arrow side-arrow-right" id="arrow-next" title="下一张 (→)">
        <div class="arrow-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    `;

    // Elements
    this.topFilename = this.topbarContainer.querySelector('#top-filename');
    this.topDimensions = this.topbarContainer.querySelector('#top-dimensions');
    this.topFilesize = this.topbarContainer.querySelector('#top-filesize');
    this.topIndexCounter = this.topbarContainer.querySelector('#top-index-counter');
    this.topZoom = this.topbarContainer.querySelector('#top-zoom');

    this.btnTopOpen = this.topbarContainer.querySelector('#btn-top-open');
    this.btnTopReveal = this.topbarContainer.querySelector('#btn-top-reveal');
    this.btnTopCopy = this.topbarContainer.querySelector('#btn-top-copy');
    this.btnTopSaveas = this.topbarContainer.querySelector('#btn-top-saveas');
    this.btnTopHelp = this.topbarContainer.querySelector('#btn-top-help');
    this.btnTopSettings = this.topbarContainer.querySelector('#btn-top-settings');

    this.barZoomLabel = this.bottomToolbarContainer.querySelector('#bar-zoom-label');
    this.barFitWindow = this.bottomToolbarContainer.querySelector('#bar-fit-window');
    this.barActualSize = this.bottomToolbarContainer.querySelector('#bar-actual-size');
    this.barFilmstrip = this.bottomToolbarContainer.querySelector('#bar-filmstrip');
    this.barExif = this.bottomToolbarContainer.querySelector('#bar-exif');
  }

  bindEvents() {
    // Topbar buttons
    this.btnTopOpen.addEventListener('click', () => this.controller.openFileDialog());
    this.btnTopReveal.addEventListener('click', () => this.controller.revealInFileManager());
    this.btnTopCopy.addEventListener('click', () => this.controller.copyToClipboard());
    this.btnTopSaveas.addEventListener('click', () => this.controller.saveAs());
    this.btnTopSettings.addEventListener('click', () => {
      if (this.onOpenSettings) this.onOpenSettings();
    });

    // Help modal trigger
    this.btnTopHelp.addEventListener('click', () => this.showHelpModal());

    // Bottombar navigation
    this.bottomToolbarContainer.querySelector('#bar-prev').addEventListener('click', () => this.controller.prevImage());
    this.bottomToolbarContainer.querySelector('#bar-next').addEventListener('click', () => this.controller.nextImage());

    // Zoom controls
    this.bottomToolbarContainer.querySelector('#bar-zoom-out').addEventListener('click', () => this.canvasView.zoomOut());
    this.bottomToolbarContainer.querySelector('#bar-zoom-in').addEventListener('click', () => this.canvasView.zoomIn());
    this.barZoomLabel.addEventListener('click', () => this.canvasView.fitToWindow(true));
    this.barFitWindow.addEventListener('click', () => this.canvasView.fitToWindow(true));
    this.barActualSize.addEventListener('click', () => this.canvasView.actualSize(true));

    // Transformations
    this.bottomToolbarContainer.querySelector('#bar-rotate-left').addEventListener('click', () => this.canvasView.rotateLeft());
    this.bottomToolbarContainer.querySelector('#bar-rotate-right').addEventListener('click', () => this.canvasView.rotateRight());
    this.bottomToolbarContainer.querySelector('#bar-flip-h').addEventListener('click', () => this.canvasView.flipHorizontal());

    // Tools
    this.bottomToolbarContainer.querySelector('#bar-slideshow').addEventListener('click', () => this.controller.toggleSlideshow());
    this.barFilmstrip.addEventListener('click', () => {
      const isVisible = this.controller.toggleFilmstrip();
      this.barFilmstrip.classList.toggle('is-active', isVisible);
    });
    this.barExif.addEventListener('click', () => {
      const isVisible = this.controller.toggleExif();
      this.barExif.classList.toggle('is-active', isVisible);
    });
    this.bottomToolbarContainer.querySelector('#bar-trash').addEventListener('click', () => this.controller.deleteCurrentImage());
    this.bottomToolbarContainer.querySelector('#bar-fullscreen').addEventListener('click', () => this.controller.toggleFullscreen());

    // Side arrows
    this.sideArrowsContainer.querySelector('#arrow-prev').addEventListener('click', () => this.controller.prevImage());
    this.sideArrowsContainer.querySelector('#arrow-next').addEventListener('click', () => this.controller.nextImage());
  }

  updateState(state) {
    const { currentImage, currentIndex, total, currentMetadata } = state;

    if (!currentImage) {
      this.topFilename.textContent = '方序看图 - 简约极速看图工具';
      this.topDimensions.style.display = 'none';
      this.topFilesize.style.display = 'none';
      this.topIndexCounter.style.display = 'none';
      this.btnTopReveal.style.display = 'none';
      this.btnTopCopy.style.display = 'none';
      this.btnTopSaveas.style.display = 'none';
      this.bottomToolbarContainer.style.display = 'none';
      this.sideArrowsContainer.style.display = 'none';
      return;
    }

    this.bottomToolbarContainer.style.display = 'flex';
    this.sideArrowsContainer.style.display = total > 1 ? 'block' : 'none';

    this.topFilename.textContent = currentImage.name;
    this.topFilename.title = currentImage.path;

    if (currentMetadata && currentMetadata.width && currentMetadata.height) {
      this.topDimensions.textContent = `${currentMetadata.width} × ${currentMetadata.height}`;
      this.topDimensions.style.display = 'inline-flex';
    } else {
      this.topDimensions.style.display = 'none';
    }

    if (currentImage.sizeBytes) {
      this.topFilesize.textContent = formatBytes(currentImage.sizeBytes);
      this.topFilesize.style.display = 'inline-flex';
    } else {
      this.topFilesize.style.display = 'none';
    }

    if (total > 0) {
      this.topIndexCounter.textContent = `${currentIndex + 1} / ${total}`;
      this.topIndexCounter.style.display = 'inline-flex';
    } else {
      this.topIndexCounter.style.display = 'none';
    }

    this.btnTopReveal.style.display = 'inline-flex';
    this.btnTopCopy.style.display = 'inline-flex';
    this.btnTopSaveas.style.display = 'inline-flex';
  }

  updateTransform(info) {
    const { isFitMode, percent } = info;
    const label = isFitMode ? `适应 (${percent}%)` : `${percent}%`;

    this.topZoom.textContent = label;
    this.barZoomLabel.textContent = `${percent}%`;

    if (isFitMode) {
      this.barFitWindow.classList.add('is-active');
      this.barActualSize.classList.remove('is-active');
    } else if (percent === 100) {
      this.barFitWindow.classList.remove('is-active');
      this.barActualSize.classList.add('is-active');
    } else {
      this.barFitWindow.classList.remove('is-active');
      this.barActualSize.classList.remove('is-active');
    }
  }

  showHelpModal() {
    let modal = document.querySelector('#viewer-help-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'viewer-help-modal';
      modal.className = 'viewer-help-modal-overlay';
      modal.innerHTML = `
        <div class="viewer-help-card">
          <div class="help-card-header">
            <h3>快捷键指南 (参考 2345 看图)</h3>
            <button class="help-close-btn">&times;</button>
          </div>
          <div class="help-card-body">
            <div class="shortcut-group">
              <h4>图片翻页与浏览</h4>
              <div class="shortcut-row"><kbd>←</kbd> / <kbd>PageUp</kbd> / <kbd>A</kbd><span>上一张图片</span></div>
              <div class="shortcut-row"><kbd>→</kbd> / <kbd>PageDown</kbd> / <kbd>D</kbd><span>下一张图片</span></div>
              <div class="shortcut-row"><kbd>Home</kbd> / <kbd>End</kbd><span>跳转到第一张 / 最后一张</span></div>
              <div class="shortcut-row"><kbd>空格</kbd><span>下一张 / 幻灯片暂停播放</span></div>
            </div>
            <div class="shortcut-group">
              <h4>缩放与视角</h4>
              <div class="shortcut-row"><kbd>鼠标滚轮</kbd><span>以光标位置为中心缩放</span></div>
              <div class="shortcut-row"><kbd>鼠标拖拽</kbd><span>放大后平移查看细节</span></div>
              <div class="shortcut-row"><kbd>鼠标双击</kbd><span>适应窗口 与 1:1 实际大小切换</span></div>
              <div class="shortcut-row"><kbd>↑</kbd> / <kbd>+</kbd><span>放大图片</span></div>
              <div class="shortcut-row"><kbd>↓</kbd> / <kbd>-</kbd><span>缩小图片</span></div>
              <div class="shortcut-row"><kbd>1</kbd> / <kbd>0</kbd><span>实际尺寸 (1:1) / 适应窗口</span></div>
            </div>
            <div class="shortcut-group">
              <h4>旋转与变换</h4>
              <div class="shortcut-row"><kbd>L</kbd> / <kbd>R</kbd><span>逆时针 / 顺时针旋转 90°</span></div>
              <div class="shortcut-row"><kbd>H</kbd> / <kbd>V</kbd><span>水平镜像 / 垂直翻转</span></div>
            </div>
            <div class="shortcut-group">
              <h4>常用功能</h4>
              <div class="shortcut-row"><kbd>F11</kbd> / <kbd>Enter</kbd><span>全屏看图模式</span></div>
              <div class="shortcut-row"><kbd>F5</kbd><span>开启全屏幻灯片放映</span></div>
              <div class="shortcut-row"><kbd>T</kbd><span>展开/折叠底部缩略图胶片栏</span></div>
              <div class="shortcut-row"><kbd>I</kbd><span>查看图片详细属性与 EXIF 参数</span></div>
              <div class="shortcut-row"><kbd>Delete</kbd><span>将当前图片移入系统回收站</span></div>
              <div class="shortcut-row"><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>C</kbd><span>复制图片至剪贴板</span></div>
              <div class="shortcut-row"><kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>,</kbd><span>打开偏好设置</span></div>
              <div class="shortcut-row"><kbd>Esc</kbd><span>退出全屏 / 关闭弹窗</span></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const close = () => modal.classList.remove('is-open');
      modal.querySelector('.help-close-btn').addEventListener('click', close);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });
    }

    modal.classList.add('is-open');
  }
}
