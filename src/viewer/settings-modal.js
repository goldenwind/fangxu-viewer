/**
 * SettingsModal: Preferences dialog for configuring mouse wheel, wrap navigation, thumbnails, and themes
 */
export class SettingsModal {
  constructor({ container, settingsManager, onApplySettings }) {
    this.container = container;
    this.settingsManager = settingsManager;
    this.onApplySettings = onApplySettings;
    this.isOpen = false;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-settings-modal-overlay');
    this.container.innerHTML = `
      <div class="settings-card">
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

        <div class="settings-body">
          <!-- 1. 鼠标滚轮设置 -->
          <div class="settings-section">
            <div class="settings-section-title">鼠标滚轮习惯</div>
            <div class="settings-radio-group">
              <label class="settings-radio-label">
                <input type="radio" name="opt-wheel" value="zoom" />
                <div class="radio-content">
                  <strong>以鼠标光标为中心缩放（推荐）</strong>
                  <span>滚动滚轮实时无级放大或缩小图片</span>
                </div>
              </label>
              <label class="settings-radio-label">
                <input type="radio" name="opt-wheel" value="page" />
                <div class="radio-content">
                  <strong>翻页浏览同目录图片</strong>
                  <span>向下滚动翻至下一张，向上滚动翻至上一张</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 2. 翻页穿透设置 -->
          <div class="settings-section">
            <div class="settings-section-title">翻页与浏览模式</div>
            <label class="settings-checkbox-label">
              <input type="checkbox" id="opt-loop-nav" />
              <div class="checkbox-content">
                <strong>允许首末张循环穿透</strong>
                <span>开启后，在最后一张继续“下一张”将循环返回第一张，首张“上一张”跳至末张</span>
              </div>
            </label>
          </div>

          <!-- 3. 缩略图栏设置 -->
          <div class="settings-section">
            <div class="settings-section-title">缩略图导航栏</div>
            <label class="settings-checkbox-label">
              <input type="checkbox" id="opt-filmstrip-default" />
              <div class="checkbox-content">
                <strong>打开图片时默认显示底部缩略图胶片栏</strong>
                <span>关闭后默认仅展示沉浸式大图，可随时按快捷键 T 展开或收起</span>
              </div>
            </label>
          </div>

          <!-- 4. 双击图片交互 -->
          <div class="settings-section">
            <div class="settings-section-title">鼠标双击图片</div>
            <div class="settings-radio-group">
              <label class="settings-radio-label">
                <input type="radio" name="opt-dblclick" value="toggle-fit" />
                <div class="radio-content">
                  <strong>适应窗口 与 1:1 实际尺寸切换（推荐）</strong>
                  <span>双击图片在最佳适应比例与原始高像素间快速切换</span>
                </div>
              </label>
              <label class="settings-radio-label">
                <input type="radio" name="opt-dblclick" value="toggle-fullscreen" />
                <div class="radio-content">
                  <strong>进入 / 退出全屏看图模式</strong>
                  <span>双击窗口在全屏与普通窗口间自由切换</span>
                </div>
              </label>
            </div>
          </div>

          <!-- 5. 界面主题与幻灯片 -->
          <div class="settings-section">
            <div class="settings-section-title">界面与放映</div>
            <div class="settings-row-field">
              <span class="field-label">视口背景风格</span>
              <select class="settings-select" id="opt-bg-theme">
                <option value="dark">沉浸深灰（默认）</option>
                <option value="checkerboard">透明棋盘格 (Grid)</option>
                <option value="black">纯黑背景 (Black)</option>
                <option value="light">极简浅灰 (Light)</option>
              </select>
            </div>
            <div class="settings-row-field" style="margin-top: 10px;">
              <span class="field-label">幻灯片放映默认间隔</span>
              <select class="settings-select" id="opt-slideshow-speed">
                <option value="1500">1.5 秒 / 张</option>
                <option value="3000">3 秒 / 张（默认）</option>
                <option value="5000">5 秒 / 张</option>
                <option value="8000">8 秒 / 张</option>
              </select>
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

    this.wheelRadios = this.container.querySelectorAll('input[name="opt-wheel"]');
    this.loopNavCheck = this.container.querySelector('#opt-loop-nav');
    this.filmstripDefaultCheck = this.container.querySelector('#opt-filmstrip-default');
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

    this.loopNavCheck.addEventListener('change', () => {
      this.updateSetting('loopNavigation', this.loopNavCheck.checked);
    });

    this.filmstripDefaultCheck.addEventListener('change', () => {
      this.updateSetting('showFilmstripByDefault', this.filmstripDefaultCheck.checked);
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

    this.loopNavCheck.checked = !!s.loopNavigation;
    this.filmstripDefaultCheck.checked = !!s.showFilmstripByDefault;

    this.dblclickRadios.forEach((r) => {
      r.checked = r.value === s.doubleClickBehavior;
    });

    this.bgThemeSelect.value = s.backgroundTheme || 'dark';
    this.slideshowSpeedSelect.value = String(s.slideshowInterval || 3000);
  }

  open() {
    this.loadValuesIntoUI();
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
