import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { SUPPORTED_FORMATS_METADATA, ALL_SUPPORTED_EXTENSIONS } from './settings.js';

/**
 * SettingsModal: Horizontal preferences dialog with left category tabs
 */
export class SettingsModal {
  constructor({ container, settingsManager, onApplySettings, onCheckUpdate, currentVersion = '0.1.2', showToast }) {
    this.container = container;
    this.settingsManager = settingsManager;
    this.onApplySettings = onApplySettings;
    this.onCheckUpdate = onCheckUpdate;
    this.currentVersion = currentVersion;
    this.showToast = showToast || null;
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
            <button class="settings-tab-btn" data-tab="associations">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>文件关联</span>
            </button>
            <button class="settings-tab-btn" data-tab="about">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <span>关于与更新</span>
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
                      <strong>适应窗口 与 1:1 实际尺寸切换（推荐）</strong>
                      <span>双击图片在最佳适应比例与原始高像素间快速居中缩放</span>
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

            <!-- 4. 文件关联 Tab -->
            <div class="settings-tab-pane" id="pane-associations">
              <div class="associations-intro-card">
                <div class="associations-intro-title">图片格式关联</div>
                <div class="associations-intro-desc">
                  设置双击或在系统文件管理器中打开时默认使用方序看图打开的图片类型。支持的格式默认全选关联。
                </div>
              </div>

              <div class="associations-toolbar">
                <div class="associations-batch-btns">
                  <button type="button" class="settings-secondary-btn" id="btn-assoc-select-all">全选</button>
                  <button type="button" class="settings-secondary-btn" id="btn-assoc-deselect-all">全不选</button>
                  <button type="button" class="settings-secondary-btn" id="btn-assoc-restore">恢复默认</button>
                </div>
                <button type="button" class="settings-primary-btn" id="btn-assoc-apply">应用关联设置</button>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">常用网络与照片格式</div>
                <div class="associations-grid" id="assoc-grid-common"></div>
              </div>

              <div class="settings-section" style="margin-top: 14px;">
                <div class="settings-section-title">专业摄影与图形设计</div>
                <div class="associations-grid" id="assoc-grid-pro"></div>
              </div>

              <div class="settings-section" style="margin-top: 14px;">
                <div class="settings-section-title">系统与专用格式</div>
                <div class="associations-grid" id="assoc-grid-system"></div>
              </div>
            </div>

            <!-- 5. 关于与更新 Tab -->
            <div class="settings-tab-pane" id="pane-about">
              <div class="settings-about-hero">
                <div class="about-app-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
                <div class="about-app-info">
                  <div class="about-title-row">
                    <h3 class="about-app-title">方序看图</h3>
                    <span class="about-version-badge">v${this.currentVersion}</span>
                  </div>
                  <p class="about-app-desc">极速、简约、流畅的跨平台看图体验</p>
                </div>
              </div>

              <div class="settings-section" style="margin-top: 18px;">
                <div class="settings-section-title">版本更新</div>
                <div class="settings-update-card">
                  <div class="update-info-block">
                    <div class="update-status-title" id="about-update-status">当前版本：v${this.currentVersion}</div>
                    <div class="update-status-desc" id="about-update-desc">手动检查是否有适用于此电脑的新版本</div>
                  </div>
                  <button class="settings-check-update-btn" id="btn-check-update" type="button">检查更新</button>
                </div>
                <div id="about-update-details" style="display: none; margin-top: 10px; padding: 12px; background: var(--bg-surface-elevated, #27272a); border-radius: 8px;">
                  <div id="about-update-title" style="font-weight: 600; font-size: 13px; margin-bottom: 6px;"></div>
                  <div id="about-update-notes" style="font-size: 12px; color: var(--text-secondary, #a1a1aa); white-space: pre-wrap; margin-bottom: 10px;"></div>
                  <button class="settings-primary-btn" id="btn-download-update" type="button" style="padding: 6px 14px; font-size: 12px;">下载新版本 ↗</button>
                </div>
              </div>

              <div class="settings-section" style="margin-top: 18px;">
                <div class="settings-section-title">反馈与支持</div>
                <div class="settings-update-card">
                  <div class="update-info-block">
                    <div class="update-status-title">产品反馈</div>
                    <div class="update-status-desc">遇到问题、操作疑惑或功能建议？欢迎提交反馈，我们持续倾听与改进</div>
                  </div>
                  <button class="settings-secondary-btn" id="btn-open-feedback" type="button" style="padding: 7px 16px;">提交反馈</button>
                </div>
              </div>

              <div class="settings-section" style="margin-top: 18px;">
                <div class="settings-section-title">开源与支持</div>
                <div class="about-links-group">
                  <div class="about-link-row">
                    <span class="link-label">GitHub 仓库</span>
                    <a href="https://github.com/goldenwind/fangxu-viewer" class="about-link" target="_blank">github.com/goldenwind/fangxu-viewer</a>
                  </div>
                  <div class="about-link-row">
                    <span class="link-label">最新发布页</span>
                    <a href="https://github.com/goldenwind/fangxu-viewer/releases" class="about-link" target="_blank">查看 Releases</a>
                  </div>
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

    this.renderFormatGrids();
  }

  renderFormatGrids() {
    const commonContainer = this.container.querySelector('#assoc-grid-common');
    const proContainer = this.container.querySelector('#assoc-grid-pro');
    const systemContainer = this.container.querySelector('#assoc-grid-system');
    if (!commonContainer || !proContainer || !systemContainer) return;

    const currentExts = new Set(this.settingsManager.get('associatedExtensions') || ALL_SUPPORTED_EXTENSIONS);

    const renderCard = (f) => {
      const isChecked = currentExts.has(f.ext);
      return `
        <label class="format-pill-card ${isChecked ? 'is-checked' : ''}" data-ext="${f.ext}">
          <input type="checkbox" class="format-checkbox" value="${f.ext}" ${isChecked ? 'checked' : ''} />
          <div class="format-pill-content">
            <div class="format-pill-header">
              <span class="format-badge">.${f.ext}</span>
              <span class="format-name">${f.name}</span>
            </div>
            <div class="format-desc">${f.desc}</div>
          </div>
        </label>
      `;
    };

    commonContainer.innerHTML = SUPPORTED_FORMATS_METADATA.filter((f) => f.category === 'common').map(renderCard).join('');
    proContainer.innerHTML = SUPPORTED_FORMATS_METADATA.filter((f) => f.category === 'pro').map(renderCard).join('');
    systemContainer.innerHTML = SUPPORTED_FORMATS_METADATA.filter((f) => f.category === 'system').map(renderCard).join('');
  }

  syncAssociatedExtensionsFromUI() {
    const checked = Array.from(this.container.querySelectorAll('.format-checkbox:checked')).map(
      (cb) => cb.value
    );
    this.updateSetting('associatedExtensions', checked);
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

    // Format associations events
    const assocPane = this.container.querySelector('#pane-associations');
    if (assocPane) {
      assocPane.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('format-checkbox')) {
          const card = e.target.closest('.format-pill-card');
          if (card) {
            card.classList.toggle('is-checked', e.target.checked);
          }
          this.syncAssociatedExtensionsFromUI();
        }
      });
    }

    const btnSelectAll = this.container.querySelector('#btn-assoc-select-all');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        this.container.querySelectorAll('.format-pill-card').forEach((card) => {
          const cb = card.querySelector('.format-checkbox');
          if (cb) cb.checked = true;
          card.classList.add('is-checked');
        });
        this.syncAssociatedExtensionsFromUI();
      });
    }

    const btnDeselectAll = this.container.querySelector('#btn-assoc-deselect-all');
    if (btnDeselectAll) {
      btnDeselectAll.addEventListener('click', () => {
        this.container.querySelectorAll('.format-pill-card').forEach((card) => {
          const cb = card.querySelector('.format-checkbox');
          if (cb) cb.checked = false;
          card.classList.remove('is-checked');
        });
        this.syncAssociatedExtensionsFromUI();
      });
    }

    const btnRestoreAssoc = this.container.querySelector('#btn-assoc-restore');
    if (btnRestoreAssoc) {
      btnRestoreAssoc.addEventListener('click', () => {
        const defaultSet = new Set(ALL_SUPPORTED_EXTENSIONS);
        this.container.querySelectorAll('.format-pill-card').forEach((card) => {
          const cb = card.querySelector('.format-checkbox');
          if (cb) {
            const isChecked = defaultSet.has(cb.value);
            cb.checked = isChecked;
            card.classList.toggle('is-checked', isChecked);
          }
        });
        this.syncAssociatedExtensionsFromUI();
      });
    }

    const btnApplyAssoc = this.container.querySelector('#btn-assoc-apply');
    if (btnApplyAssoc) {
      btnApplyAssoc.addEventListener('click', async () => {
        const checkedExts = Array.from(this.container.querySelectorAll('.format-checkbox:checked')).map(
          (cb) => cb.value
        );
        btnApplyAssoc.disabled = true;
        const originalText = btnApplyAssoc.textContent;
        btnApplyAssoc.textContent = '应用中...';
        try {
          const count = await invoke('apply_file_associations', { extensions: checkedExts });
          if (this.showToast) {
            this.showToast(`已成功关联 ${count} 种图片格式`);
          }
          btnApplyAssoc.textContent = `已关联 (${count})`;
          setTimeout(() => {
            btnApplyAssoc.textContent = originalText;
            btnApplyAssoc.disabled = false;
          }, 1500);
        } catch (err) {
          console.error('Failed to apply file associations:', err);
          if (this.showToast) {
            this.showToast(`关联失败: ${err}`);
          }
          btnApplyAssoc.textContent = originalText;
          btnApplyAssoc.disabled = false;
        }
      });
    }

    // Feedback Button
    const feedbackBtn = this.container.querySelector('#btn-open-feedback');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', async () => {
        try {
          await invoke('open_product_feedback', { language: 'zh' });
        } catch (err) {
          console.error('Failed to open feedback:', err);
          if (this.showToast) {
            this.showToast(`打开产品反馈失败: ${err}`);
          }
        }
      });
    }

    // Check Update and Download Buttons
    const checkBtn = this.container.querySelector('#btn-check-update');
    const downloadBtn = this.container.querySelector('#btn-download-update');
    const statusTitle = this.container.querySelector('#about-update-status');
    const statusDesc = this.container.querySelector('#about-update-desc');
    const updateDetails = this.container.querySelector('#about-update-details');
    const updateTitle = this.container.querySelector('#about-update-title');
    const updateNotes = this.container.querySelector('#about-update-notes');

    if (checkBtn) {
      checkBtn.addEventListener('click', async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = '检查中...';
        if (statusTitle) statusTitle.textContent = '正在检查更新...';
        if (statusDesc) statusDesc.textContent = '连接更新服务器中，请稍候';
        if (updateDetails) updateDetails.style.display = 'none';

        try {
          const result = await invoke('check_product_update');
          if (result && result.update_available) {
            const latestVer = (result.latest_version || '').replace(/^[vV]/, '');
            if (statusTitle) statusTitle.textContent = `发现新版本：v${latestVer}`;
            if (statusDesc) statusDesc.textContent = result.force_update ? '当前版本需要升级，请下载并安装' : '有新版本可用，点击下方按钮下载';
            if (updateTitle) {
              updateTitle.textContent = result.title || `版本 v${latestVer}`;
              updateTitle.style.display = result.title ? 'block' : 'none';
            }
            if (updateNotes) {
              updateNotes.textContent = result.release_notes || '';
              updateNotes.style.display = result.release_notes ? 'block' : 'none';
            }
            if (updateDetails) updateDetails.style.display = 'block';
            checkBtn.textContent = '再次检查';
          } else {
            if (statusTitle) statusTitle.textContent = `当前已是最新版本 (v${this.currentVersion})`;
            if (statusDesc) statusDesc.textContent = '当前已安装最新版本，暂无新版本发布';
            checkBtn.textContent = '已是最新';
          }
        } catch (err) {
          if (statusTitle) statusTitle.textContent = '检查更新未完成';
          if (statusDesc) statusDesc.textContent = String(err);
          checkBtn.textContent = '重试';
        } finally {
          checkBtn.disabled = false;
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        downloadBtn.disabled = true;
        try {
          await invoke('open_product_update');
        } catch (err) {
          if (this.showToast) {
            this.showToast(`打开更新下载地址失败: ${err}`);
          }
        } finally {
          downloadBtn.disabled = false;
        }
      });
    }

    // External links handler
    this.container.querySelectorAll('.about-link').forEach((link) => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await openUrl(link.href);
        } catch {
          window.open(link.href, '_blank');
        }
      });
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

    // Sync associations UI
    const currentExts = new Set(s.associatedExtensions || ALL_SUPPORTED_EXTENSIONS);
    this.container.querySelectorAll('.format-pill-card').forEach((card) => {
      const cb = card.querySelector('.format-checkbox');
      if (cb) {
        const isChecked = currentExts.has(cb.value);
        cb.checked = isChecked;
        card.classList.toggle('is-checked', isChecked);
      }
    });
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
