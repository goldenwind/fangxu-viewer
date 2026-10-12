/**
 * ConvertModal: macOS-native styled "Convert Image" modal dialog
 * Directly invokes macOS system image processing (sips / quick action)
 */
export class ConvertModal {
  constructor({ container, onConvert, onRevealInFinder }) {
    this.container = container;
    this.onConvert = onConvert;
    this.onRevealInFinder = onRevealInFinder;

    this.isOpen = false;
    this.currentImage = null;
    this.currentMetadata = null;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-convert-modal-overlay');
    this.container.style.display = 'none';

    this.container.innerHTML = `
      <div class="convert-modal-card" role="dialog" aria-modal="true" aria-labelledby="convert-modal-title">
        <div class="convert-modal-header">
          <div class="convert-modal-header-title">
            <svg class="convert-modal-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M21 21v-5h-5"/>
            </svg>
            <span id="convert-modal-title">转换图像</span>
          </div>
          <button class="convert-modal-close" title="关闭 (Esc)">&times;</button>
        </div>

        <div class="convert-modal-body">
          <div class="convert-file-preview">
            <div class="convert-file-name" id="convert-file-name">-</div>
            <div class="convert-file-meta" id="convert-file-meta">-</div>
          </div>

          <div class="convert-form-row">
            <label class="convert-form-label" for="convert-format-select">格式</label>
            <div class="convert-form-control">
              <select id="convert-format-select" class="convert-select">
                <option value="jpeg" selected>JPEG</option>
                <option value="png">PNG</option>
                <option value="heif">HEIF</option>
              </select>
            </div>
          </div>

          <div class="convert-form-row">
            <label class="convert-form-label" for="convert-size-select">图像大小</label>
            <div class="convert-form-control">
              <select id="convert-size-select" class="convert-select">
                <option value="small">小 (宽/高 640 像素)</option>
                <option value="medium">中 (宽/高 1280 像素)</option>
                <option value="large">大 (宽/高 1920 像素)</option>
                <option value="actual" selected>实际大小</option>
              </select>
            </div>
          </div>

          <div class="convert-form-row convert-form-checkbox-row">
            <div class="convert-form-label"></div>
            <div class="convert-form-control">
              <label class="convert-checkbox-label">
                <input type="checkbox" id="convert-preserve-metadata" checked />
                <span>保留元数据</span>
              </label>
            </div>
          </div>

          <div class="convert-system-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>
            </svg>
            <span>直接调用 macOS 系统级图像处理引擎完成转换</span>
          </div>
        </div>

        <div class="convert-modal-footer">
          <button class="convert-link-btn" id="btn-convert-reveal-finder" title="在访达中定位文件">
            在访达中显示
          </button>
          <div class="convert-modal-actions">
            <button class="convert-btn convert-btn-cancel" id="btn-convert-cancel">取消</button>
            <button class="convert-btn convert-btn-primary" id="btn-convert-submit">转换为 JPEG</button>
          </div>
        </div>
      </div>
    `;

    this.formatSelect = this.container.querySelector('#convert-format-select');
    this.sizeSelect = this.container.querySelector('#convert-size-select');
    this.preserveMetaCheckbox = this.container.querySelector('#convert-preserve-metadata');
    this.submitBtn = this.container.querySelector('#btn-convert-submit');
    this.fileNameEl = this.container.querySelector('#convert-file-name');
    this.fileMetaEl = this.container.querySelector('#convert-file-meta');
  }

  bindEvents() {
    // Close button
    this.container.querySelector('.convert-modal-close').addEventListener('click', () => this.close());
    this.container.querySelector('#btn-convert-cancel').addEventListener('click', () => this.close());

    // Click outside to close
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    // Esc key
    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    // Format select change updates submit button text
    this.formatSelect.addEventListener('change', () => {
      this.updateSubmitButtonText();
    });

    // Reveal in Finder
    this.container.querySelector('#btn-convert-reveal-finder').addEventListener('click', () => {
      if (this.onRevealInFinder) {
        this.onRevealInFinder();
      }
    });

    // Submit
    this.submitBtn.addEventListener('click', async () => {
      await this.handleSubmit();
    });
  }

  updateSubmitButtonText() {
    const val = this.formatSelect.value;
    const formatName = val.toUpperCase();
    this.submitBtn.textContent = `转换为 ${formatName}`;
  }

  open(image, metadata) {
    if (!image) return;
    this.currentImage = image;
    this.currentMetadata = metadata;

    this.fileNameEl.textContent = image.name || '-';
    this.fileNameEl.title = image.path || '';

    let metaParts = [];
    if (metadata && metadata.width && metadata.height) {
      metaParts.push(`${metadata.width} × ${metadata.height}`);
    }
    if (metadata && metadata.format) {
      metaParts.push(metadata.format.toUpperCase());
    }
    if (image.sizeBytes) {
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(image.sizeBytes) / Math.log(k));
      metaParts.push(`${(image.sizeBytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`);
    }
    this.fileMetaEl.textContent = metaParts.join(' · ') || '正在读取图片信息...';

    // Default target format: if original is JPEG, default to PNG, otherwise default to JPEG
    const ext = (image.name || '').split('.').pop().toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') {
      this.formatSelect.value = 'png';
    } else {
      this.formatSelect.value = 'jpeg';
    }
    this.sizeSelect.value = 'actual';
    this.preserveMetaCheckbox.checked = true;
    this.updateSubmitButtonText();

    this.submitBtn.disabled = false;
    this.container.style.display = 'flex';
    this.isOpen = true;
  }

  close() {
    this.container.style.display = 'none';
    this.isOpen = false;
    this.currentImage = null;
    this.currentMetadata = null;
  }

  async handleSubmit() {
    if (!this.currentImage || !this.onConvert) return;

    const targetFormat = this.formatSelect.value;
    const sizePreset = this.sizeSelect.value;
    const preserveMetadata = this.preserveMetaCheckbox.checked;

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = '正在转换...';

    try {
      await this.onConvert({
        sourcePath: this.currentImage.path,
        targetFormat,
        sizePreset,
        preserveMetadata,
      });
      this.close();
    } catch (err) {
      this.submitBtn.disabled = false;
      this.updateSubmitButtonText();
    }
  }
}
