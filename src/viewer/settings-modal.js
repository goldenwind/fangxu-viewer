/**
 * SettingsModal: Horizontal preferences dialog with left category tabs
 */
export class SettingsModal {
  constructor({ container, settingsManager, onApplySettings }) {
    this.container = container;
    this.settingsManager = settingsManager;
    this.onApplySettings = onApplySettings;
    this.isOpen = false;
    this.activeTab = 'habits';

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-settings-modal-overlay');
    this.container.innerHTML = `
      <div class="settings-card settings-card-horizontal">
        <div class="settings-header">
          <div class="settings-header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>偏好设置</span>
          </div>
          <button class="settings-close-btn" title="关闭 (Esc)">&times;</button>
        </div>

        <div class="settings-horizontal-layout">
          <!-- Left Category Tabs -->
          <div class="settings-sidebar">
            <button class="settings-tab-btn is-active" data-tab="habits">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
              <span>常规习惯</span>
            </button>
            <button class="settings-tab-btn" data-tab="browsing">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/></svg>
              <span>浏览与缩略图</span>
            </button>
            <button class="settings-tab-btn" data-tab="appearance">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20Z"/></svg>
              <span>界面与放映</span>
            </button>
          </div>

          <!-- Right Content Panels -->
          <div class="settings-content-wrapper">
            <!-- 1. 常规习惯 Tab -->
            <div class="settings-tab-pane is-active" id="pane-habits">
              <div class="settings-section">
                <div class="settings-section-title">鼠标滚轮操作</div>
                <div class="settings-radio-group">
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-wheel" value="zoom" />
                    <div class="radio-content">
                      <strong>以鼠标光标为中心缩放</strong>
                      <span>滚动滚轮实时无级放大或缩小图片</span>
                    </div>
                  </label>
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-wheel" value="page" />
                    <div class="radio-content">
                      <strong>翻页浏览同目录图片（推荐）</strong>
                      <span>向下滚动翻至下一张，向上滚动翻至上一张</span>
                    </div>
                  </label>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">鼠标双击动作</div>
                <div class="settings-radio-group">
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-dblclick" value="toggle-fit" />
                    <div class="radio-content">
                      <strong>适应窗口 与 1:1 实际尺寸切换</strong>
                      <span>双击图片在最佳适应比例与原始高像素间快速切换</span>
                    </div>
                  </label>
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-dblclick" value="toggle-fullscreen" />
                    <div class="radio-content">
                      <strong>进入 / 退出全屏看图模式（推荐）</strong>
                      <span>双击窗口在全屏与普通窗口间自由切换</span>
                    </div>
                  </label>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">打开图片初始大小</div>
                <div class="settings-radio-group">
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-scale-mode" value="fit-if-larger" />
                    <div class="radio-content">
                      <strong>默认 1:1，超出窗口则适应（推荐）</strong>
                      <span>小图保持 100% 原始尺寸居中显示，大图自动缩小适应窗口</span>
                    </div>
                  </label>
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-scale-mode" value="fit-window" />
                    <div class="radio-content">
                      <strong>始终适应窗口</strong>
                      <span>大图缩小适应窗口，小图也会拉伸铺满窗口</span>
                    </div>
                  </label>
                  <label class="settings-radio-label">
                    <input type="radio" name="opt-scale-mode" value="original" />
                    <div class="radio-content">
                      <strong>始终 1:1 实际尺寸</strong>
                      <span>无论图片大小，打开时均以 100% 原始大小呈现</span>
                    </div>
                  </label>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">翻页穿透循环</div>
                <label class="settings-checkbox-label">
                  <input type="checkbox" id="opt-loop-nav" />
                  <div class="checkbox-content">
                    <strong>允许首末张循环穿透</strong>
                    <span>开启后，在最后一张继续“下一张”将循环返回第一张，首张“上一张”跳至末张</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- 2. 浏览与缩略图 Tab -->
            <div class="settings-tab-pane" id="pane-browsing">
              <div class="settings-section">
                <div class="settings-section-title">目录检索与递归扫描</div>
                <label class="settings-checkbox-label">
                  <input type="checkbox" id="opt-recursive-scan" />
                  <div class="checkbox-content">
                    <strong>包含子文件夹内的所有图片（递归浏览）</strong>
                    <span>开启后，打开文件夹或图片时将同时检索该目录下全部子文件夹中的图片文件</span>
                  </div>
                </label>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">底部缩略图胶片栏</div>
                <div class="settings-row-field">
                  <span class="field-label">展示时机</span>
                  <select class="settings-select" id="opt-filmstrip-mode">
                    <option value="hover">鼠标移至底部时自动浮现（推荐）</option>
                    <option value="always">打开图片后始终常驻显示</option>
                    <option value="manual">仅手动点击或按快捷键 T 展开/收起</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 3. 界面与放映 Tab -->
            <div class="settings-tab-pane" id="pane-appearance">
              <div class="settings-section">
                <div class="settings-section-title">视口背景风格</div>
                <div class="settings-row-field">
                  <span class="field-label">背景主题</span>
                  <select class="settings-select" id="opt-bg-theme">
                    <option value="dark">沉浸深灰（默认）</option>
                    <option value="checkerboard">透明棋盘格 (Grid)</option>
                    <option value="black">纯黑背景 (Black)</option>
                    <option value="light">极简浅灰 (Light)</option>
                  </select>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">幻灯片放映</div>
                <div class="settings-row-field">
                  <span class="field-label">默认播放间隔</span>
                  <select class="settings-select" id="opt-slideshow-speed">
                    <option value="1500">1.5 秒 / 张</option>
                    <option value="3000">3 秒 / 张（默认）</option>
                    <option value="5000">5 秒 / 张</option>
                    <option value="8000">8 秒 / 张</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-footer">
          <button class="settings-secondary-btn" id="btn-reset-settings">恢复默认</button>
          <button class="settings-primary-btn" id="btn-save-settings">完成</button>
        </div>
      </div>
    `;

    this.closeBtn = this.container.querySelector('.settings-close-btn');
    this.resetBtn = this.container.querySelector('#btn-reset-settings');
    this.saveBtn = this.container.querySelector('#btn-save-settings');

    this.tabButtons = this.container.querySelectorAll('.settings-tab-btn');
    this.tabPanes = this.container.querySelectorAll('.settings-tab-pane');

    this.wheelRadios = this.container.querySelectorAll('input[name="opt-wheel"]');
    this.scaleModeRadios = this.container.querySelectorAll('input[name="opt-scale-mode"]');
    this.loopNavCheck = this.container.querySelector('#opt-loop-nav');
    this.recursiveScanCheck = this.container.querySelector('#opt-recursive-scan');
    this.filmstripModeSelect = this.container.querySelector('#opt-filmstrip-mode');
    this.dblclickRadios = this.container.querySelectorAll('input[name="opt-dblclick"]');
    this.bgThemeSelect = this.container.querySelector('#opt-bg-theme');
    this.slideshowSpeedSelect = this.container.querySelector('#opt-slideshow-speed');
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.saveBtn.addEventListener('click', () => this.close());

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          e.preventDefault();
          e.stopPropagation();
          this.close();
        }
      },
      true
    );

    // Tab switching
    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Reset button
    this.resetBtn.addEventListener('click', () => {
      this.settingsManager.reset();
      this.loadValuesIntoUI();
      if (this.onApplySettings) {
        this.onApplySettings(this.settingsManager.getAll());
      }
    });

    // Bind inputs to real-time update
    this.wheelRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) this.updateSetting('wheelBehavior', r.value);
      });
    });

    this.scaleModeRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) this.updateSetting('openImageScaleMode', r.value);
      });
    });

    this.loopNavCheck.addEventListener('change', () => {
      this.updateSetting('loopNavigation', this.loopNavCheck.checked);
    });

    this.recursiveScanCheck.addEventListener('change', () => {
      this.updateSetting('recursiveScanning', this.recursiveScanCheck.checked);
    });

    this.filmstripModeSelect.addEventListener('change', () => {
      this.updateSetting('filmstripMode', this.filmstripModeSelect.value);
      this.updateSetting('showFilmstripByDefault', this.filmstripModeSelect.value === 'always');
    });

    this.dblclickRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) this.updateSetting('doubleClickBehavior', r.value);
      });
    });

    this.bgThemeSelect.addEventListener('change', () => {
      this.updateSetting('backgroundTheme', this.bgThemeSelect.value);
    });

    this.slideshowSpeedSelect.addEventListener('change', () => {
      this.updateSetting('slideshowInterval', parseInt(this.slideshowSpeedSelect.value, 10));
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    this.tabButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabName);
    });
    this.tabPanes.forEach((pane) => {
      pane.classList.toggle('is-active', pane.id === `pane-${tabName}`);
    });
  }

  updateSetting(key, val) {
    this.settingsManager.set(key, val);
    if (this.onApplySettings) {
      this.onApplySettings(this.settingsManager.getAll());
    }
  }

  loadValuesIntoUI() {
    const s = this.settingsManager.getAll();

    this.wheelRadios.forEach((r) => {
      r.checked = r.value === s.wheelBehavior;
    });

    const scaleMode = s.openImageScaleMode || 'fit-if-larger';
    this.scaleModeRadios.forEach((r) => {
      r.checked = r.value === scaleMode;
    });

    this.loopNavCheck.checked = !!s.loopNavigation;
    this.recursiveScanCheck.checked = !!s.recursiveScanning;

    const currentMode = s.filmstripMode || (s.showFilmstripByDefault ? 'always' : 'hover');
    this.filmstripModeSelect.value = currentMode;

    this.dblclickRadios.forEach((r) => {
      r.checked = r.value === s.doubleClickBehavior;
    });

    this.bgThemeSelect.value = s.backgroundTheme || 'dark';
    this.slideshowSpeedSelect.value = String(s.slideshowInterval || 3000);
  }

  open(initialTab = 'habits') {
    this.loadValuesIntoUI();
    this.switchTab(initialTab);
    this.isOpen = true;
    this.container.classList.add('is-open');
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('is-open');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
