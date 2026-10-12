import { invoke } from '@tauri-apps/api/core';

/**
 * UIToolbar: Manages Topbar, Floating Bottom Toolbar, and Side Navigation Arrows
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function detectPlatform(customNav) {
  const nav = customNav !== undefined ? customNav : (typeof navigator !== 'undefined' ? navigator : null);
  if (nav) {
    const ua = nav.userAgent || '';
    const platform = nav.platform || '';
    if (/Mac|iPhone|iPod|iPad/i.test(platform) || /Macintosh/i.test(ua)) {
      return 'macos';
    }
    if (/Win/i.test(platform) || /Windows/i.test(ua)) {
      return 'windows';
    }
  }
  return 'windows';
}

export const WINDOWS_MINIMIZE_SVG = `
<svg class="win-caption-icon" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
  <rect x="0" y="5" width="10" height="1"/>
</svg>
`.trim();

export const WINDOWS_MAXIMIZE_SVG = `
<svg class="win-caption-icon" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
  <path fill-rule="evenodd" d="M0 0v10h10V0H0zm1 1h8v8H1V1z"/>
</svg>
`.trim();

export const WINDOWS_RESTORE_SVG = `
<svg class="win-caption-icon" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
  <path d="M2 0v2h1V1h6v6h-1v1h2V0H2z"/>
  <path fill-rule="evenodd" d="M0 2v8h8V2H0zm1 1h6v6H1V3z"/>
</svg>
`.trim();

export const WINDOWS_CLOSE_SVG = `
<svg class="win-caption-icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.1">
  <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5"/>
</svg>
`.trim();

export class UIToolbar {
  constructor({
    topbarContainer,
    bottomToolbarContainer,
    sideArrowsContainer,
    controller,
    canvasView,
    onOpenSettings,
    platform = detectPlatform(),
    isMaximized = false,
  }) {
    this.topbarContainer = topbarContainer;
    this.bottomToolbarContainer = bottomToolbarContainer;
    this.sideArrowsContainer = sideArrowsContainer;
    this.controller = controller;
    this.canvasView = canvasView;
    this.onOpenSettings = onOpenSettings;
    this.platform = platform;
    this.isMaximized = isMaximized;

    this.idleTimer = null;
    this.isHoveringToolbar = false;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    const isMac = this.platform === 'macos';
    const revealTitle = isMac ? '在访达中显示' : '在文件资源管理器中显示';
    const revealText = isMac ? '访达' : '定位';

    // 1. Topbar
    this.topbarContainer.classList.add('viewer-topbar');
    if (!isMac) {
      this.topbarContainer.classList.add('is-windows');
    }
    this.topbarContainer.setAttribute('data-tauri-drag-region', 'true');
    this.topbarContainer.innerHTML = `
      <div class="topbar-left" data-tauri-drag-region="true">
        ${isMac ? `
        <div class="custom-window-controls mac-window-controls" data-tauri-drag-region="false">
          <button class="win-btn win-close" id="btn-win-close" title="关闭窗口 (⌘W)">
            <svg class="win-btn-icon" width="12" height="12" viewBox="0 0 85.4 85.4" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M22.5 57.8L57.8 22.5C59.2 21.1 61.4 21.1 62.8 22.5L62.9 22.6C64.3 24 64.3 26.2 62.9 27.6L27.6 62.9C26.2 64.3 24 64.3 22.6 62.9L22.5 62.8C21.2 61.4 21.2 59.2 22.5 57.8Z" fill="currentColor"/>
              <path fill-rule="evenodd" clip-rule="evenodd" d="M27.6 22.5L62.9 57.8C64.3 59.2 64.3 61.4 62.9 62.8L62.8 62.9C61.4 64.3 59.2 64.3 57.8 62.9L22.5 27.6C21.1 26.2 21.1 24 22.5 22.6L22.6 22.5C24 21.2 26.2 21.2 27.6 22.5Z" fill="currentColor"/>
            </svg>
          </button>
          <button class="win-btn win-min" id="btn-win-min" title="最小化 (⌘M)">
            <svg class="win-btn-icon" width="12" height="12" viewBox="0 0 85.4 85.4" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M17.8 39.1H67.7C69.6 39.1 71.2 40.7 71.2 42.6V42.7C71.2 44.6 69.6 46.2 67.7 46.2H17.8C15.9 46.2 14.3 44.6 14.3 42.7V42.6C14.3 40.7 15.8 39.1 17.8 39.1Z" fill="currentColor"/>
            </svg>
          </button>
          <button class="win-btn win-max" id="btn-win-max" title="最大化 / 还原">
            <svg class="win-btn-icon" width="12" height="12" viewBox="0 0 85.4 85.4" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M54.2 20.8H27.5C23.9 20.8 21 23.7 21 27.3V54L54.2 20.8ZM31 64.5H57.8C61.4 64.5 64.3 61.6 64.3 58V31.2L31 64.5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        ` : ''}

        <div class="app-brand" data-tauri-drag-region="true">
          <svg class="app-logo" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
        <div class="meta-tag meta-zoom-tag" id="top-zoom" title="当前缩放比" style="display:none;"></div>
      </div>

      <div class="topbar-right">
        <button class="top-icon-btn" id="btn-top-open" title="打开图片 (Ctrl/Cmd + O)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          <span>打开</span>
        </button>
        <button class="top-icon-btn" id="btn-top-reveal" title="${revealTitle}" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>${revealText}</span>
        </button>
        <button class="top-icon-btn" id="btn-top-copy" title="复制图片到剪贴板 (Ctrl/Cmd + C)" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>复制</span>
        </button>
        <button class="top-icon-btn" id="btn-top-saveas" title="另存为... (Ctrl/Cmd + S)" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>另存为</span>
        </button>
        ${isMac ? `
        <button class="top-icon-btn" id="btn-top-convert" title="转换图像 (macOS 快速操作)" style="display:none;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M21 21v-5h-5"/>
          </svg>
          <span>转换</span>
        </button>
        ` : ''}
        <button class="top-icon-btn" id="btn-top-settings" title="偏好设置 (Ctrl/Cmd + ,)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>设置</span>
        </button>
      </div>

      ${!isMac ? `
      <div class="windows-window-controls" data-tauri-drag-region="false">
        <button class="win-caption-btn win-caption-min" id="btn-win-min" title="最小化">
          ${WINDOWS_MINIMIZE_SVG}
        </button>
        <button class="win-caption-btn win-caption-max" id="btn-win-max" title="${this.isMaximized ? '还原' : '最大化'}">
          ${this.isMaximized ? WINDOWS_RESTORE_SVG : WINDOWS_MAXIMIZE_SVG}
        </button>
        <button class="win-caption-btn win-caption-close" id="btn-win-close" title="关闭 (Alt+F4)">
          ${WINDOWS_CLOSE_SVG}
        </button>
      </div>
      ` : ''}
    `;

    // 2. Bottom Floating Toolbar
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>

        ${isMac ? `
        <button class="toolbar-btn" id="bar-convert" title="转换图像 (macOS 快速操作)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M21 21v-5h-5"/>
          </svg>
        </button>
        ` : ''}

        <button class="toolbar-btn toolbar-btn-danger" id="bar-trash" title="移入回收站 (Delete)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
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
    this.btnTopConvert = this.topbarContainer.querySelector('#btn-top-convert');
    this.btnTopHelp = this.topbarContainer.querySelector('#btn-top-help');
    this.btnTopSettings = this.topbarContainer.querySelector('#btn-top-settings');

    this.barZoomLabel = this.bottomToolbarContainer.querySelector('#bar-zoom-label');
    this.barFitWindow = this.bottomToolbarContainer.querySelector('#bar-fit-window');
    this.barActualSize = this.bottomToolbarContainer.querySelector('#bar-actual-size');
    this.barFilmstrip = this.bottomToolbarContainer.querySelector('#bar-filmstrip');
    this.barExif = this.bottomToolbarContainer.querySelector('#bar-exif');
  }

  bindEvents() {
    // Custom Window Control Buttons
    const btnWinClose = this.topbarContainer.querySelector('#btn-win-close');
    const btnWinMin = this.topbarContainer.querySelector('#btn-win-min');
    const btnWinMax = this.topbarContainer.querySelector('#btn-win-max');

    const winControls = this.topbarContainer.querySelector('.custom-window-controls');
    if (winControls) {
      winControls.addEventListener('mouseenter', () => winControls.classList.add('is-hovered'));
      winControls.addEventListener('mouseleave', () => winControls.classList.remove('is-hovered'));
    }

    if (btnWinClose) {
      btnWinClose.addEventListener('click', (e) => {
        e.stopPropagation();
        invoke('close_window').catch(() => window.close());
      });
    }
    if (btnWinMin) {
      btnWinMin.addEventListener('click', (e) => {
        e.stopPropagation();
        invoke('minimize_window').catch(() => {});
      });
    }
    if (btnWinMax) {
      btnWinMax.addEventListener('click', (e) => {
        e.stopPropagation();
        invoke('toggle_maximize_window').then((res) => {
          if (typeof res === 'boolean') {
            this.setMaximized(res);
          }
        }).catch(() => {});
      });
    }

    // Double click topbar drag region to maximize/restore
    const handleTopbarDblClick = (e) => {
      if (e.target.closest('button, .file-name-badge, .meta-tag, .viewer-help-card')) return;
      invoke('toggle_maximize_window').then((res) => {
        if (typeof res === 'boolean') {
          this.setMaximized(res);
        }
      }).catch(() => {});
    };

    this.topbarContainer.addEventListener('mousedown', (e) => {
      if (e.detail === 2) {
        handleTopbarDblClick(e);
      }
    });
    this.topbarContainer.addEventListener('dblclick', handleTopbarDblClick);

    // Auto-hide toolbar on idle
    this.bottomToolbarContainer.addEventListener('mouseenter', () => {
      this.isHoveringToolbar = true;
      this.showToolbar();
    });
    this.bottomToolbarContainer.addEventListener('mouseleave', () => {
      this.isHoveringToolbar = false;
      this.startIdleTimer();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', () => {
        this.showToolbar();
        this.startIdleTimer();
      });
    }

    // Topbar buttons
    this.btnTopOpen.addEventListener('click', () => this.controller.openFileDialog());
    this.btnTopReveal.addEventListener('click', () => this.controller.revealInFileManager());
    this.btnTopCopy.addEventListener('click', () => this.controller.copyToClipboard());
    this.btnTopSaveas.addEventListener('click', () => this.controller.saveAs());
    if (this.btnTopConvert) {
      this.btnTopConvert.addEventListener('click', () => this.controller.openConvertModal());
    }
    this.btnTopSettings.addEventListener('click', () => {
      if (this.onOpenSettings) this.onOpenSettings();
    });

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
    const barConvert = this.bottomToolbarContainer.querySelector('#bar-convert');
    if (barConvert) {
      barConvert.addEventListener('click', () => this.controller.openConvertModal());
    }
    this.bottomToolbarContainer.querySelector('#bar-trash').addEventListener('click', () => this.controller.deleteCurrentImage());
    this.bottomToolbarContainer.querySelector('#bar-fullscreen').addEventListener('click', () => this.controller.toggleFullscreen());

    // Side arrows
    this.sideArrowsContainer.querySelector('#arrow-prev').addEventListener('click', () => this.controller.prevImage());
    this.sideArrowsContainer.querySelector('#arrow-next').addEventListener('click', () => this.controller.nextImage());
  }

  showToolbar() {
    if (this.isSlideshow) return;
    this.bottomToolbarContainer.classList.remove('is-idle');
  }

  hideToolbar() {
    if (!this.isHoveringToolbar) {
      this.bottomToolbarContainer.classList.add('is-idle');
    }
  }

  startIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      this.hideToolbar();
    }, 3000);
  }

  setMaximized(isMax) {
    this.isMaximized = !!isMax;
    const btnWinMax = this.topbarContainer.querySelector('#btn-win-max');
    if (this.platform !== 'macos' && btnWinMax) {
      if (this.isMaximized) {
        btnWinMax.title = '还原';
        btnWinMax.innerHTML = WINDOWS_RESTORE_SVG;
      } else {
        btnWinMax.title = '最大化';
        btnWinMax.innerHTML = WINDOWS_MAXIMIZE_SVG;
      }
    }
    if (this.isMaximized) {
      this.topbarContainer.classList.add('is-maximized');
      if (typeof document !== 'undefined') {
        document.querySelector('#app')?.classList.add('is-maximized');
      }
    } else {
      this.topbarContainer.classList.remove('is-maximized');
      if (typeof document !== 'undefined') {
        document.querySelector('#app')?.classList.remove('is-maximized');
      }
    }
  }

  updateState(state) {
    const { currentImage, currentIndex, total, currentMetadata, isFullscreen, isSlideshow } = state;
    this.isSlideshow = !!isSlideshow;

    const appRoot = document.querySelector('.viewer-app-root');
    if (appRoot) {
      appRoot.classList.toggle('is-fullscreen', !!isFullscreen);
      appRoot.classList.toggle('is-slideshow', !!isSlideshow);
    }

    if (!currentImage) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.topFilename.textContent = '方序看图 - 简约极速看图工具';
      this.topDimensions.style.display = 'none';
      this.topFilesize.style.display = 'none';
      this.topIndexCounter.style.display = 'none';
      this.topZoom.style.display = 'none';
      this.btnTopReveal.style.display = 'none';
      this.btnTopCopy.style.display = 'none';
      this.btnTopSaveas.style.display = 'none';
      if (this.btnTopConvert) this.btnTopConvert.style.display = 'none';
      this.bottomToolbarContainer.style.display = 'none';
      this.sideArrowsContainer.style.display = 'none';
      return;
    }

    this.topZoom.style.display = 'inline-flex';
    this.bottomToolbarContainer.style.display = 'flex';
    if (this.isSlideshow) {
      this.hideToolbar();
    } else {
      this.showToolbar();
      this.startIdleTimer();
    }
    this.sideArrowsContainer.style.display = total > 1 && !this.isSlideshow ? 'block' : 'none';

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
    if (this.btnTopConvert) this.btnTopConvert.style.display = 'inline-flex';
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
            <h3>快捷键指南</h3>
            <button class="help-close-btn">&times;</button>
          </div>
          <div class="help-card-body">
            <div class="shortcut-group">
              <h4>图片翻页与浏览</h4>
              <div class="shortcut-row"><kbd>鼠标滚轮</kbd><span>上一张 / 下一张图片</span></div>
              <div class="shortcut-row"><kbd>←</kbd> / <kbd>PageUp</kbd> / <kbd>A</kbd><span>上一张图片</span></div>
              <div class="shortcut-row"><kbd>→</kbd> / <kbd>PageDown</kbd> / <kbd>D</kbd><span>下一张图片</span></div>
              <div class="shortcut-row"><kbd>Home</kbd> / <kbd>End</kbd><span>跳转到第一张 / 最后一张</span></div>
              <div class="shortcut-row"><kbd>空格</kbd><span>下一张 / 幻灯片暂停播放</span></div>
            </div>
            <div class="shortcut-group">
              <h4>缩放与视角</h4>
              <div class="shortcut-row"><kbd>⌘ / Ctrl + 滚轮</kbd><span>以光标位置为中心缩放</span></div>
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

      window.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        },
        true
      );
    }

    modal.classList.add('is-open');
  }
}
