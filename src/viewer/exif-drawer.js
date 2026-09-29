/**
 * ExifDrawer: Side modal / inspector for Image Attributes and EXIF metadata
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  return d.toLocaleString();
}

export class ExifDrawer {
  constructor({ container, onClose }) {
    this.container = container;
    this.onClose = onClose;
    this.isVisible = false;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-exif-drawer');
    this.container.innerHTML = `
      <div class="exif-panel">
        <div class="exif-header">
          <div class="exif-title">图片详细信息</div>
          <button class="exif-close-btn" title="关闭 (Esc)">×</button>
        </div>
        <div class="exif-body">
          <div class="exif-section">
            <div class="exif-section-title">基本信息</div>
            <div class="exif-grid" id="exif-basic-grid"></div>
          </div>
          <div class="exif-section" id="exif-camera-section">
            <div class="exif-section-title">拍摄设备</div>
            <div class="exif-grid" id="exif-camera-grid"></div>
          </div>
          <div class="exif-section" id="exif-shot-section">
            <div class="exif-section-title">拍摄参数 (EXIF)</div>
            <div class="exif-grid" id="exif-shot-grid"></div>
          </div>
          <div class="exif-empty-hint" id="exif-no-data" style="display: none;">
            该图片未包含 EXIF 拍摄参数
          </div>
        </div>
      </div>
    `;

    this.basicGrid = this.container.querySelector('#exif-basic-grid');
    this.cameraSection = this.container.querySelector('#exif-camera-section');
    this.cameraGrid = this.container.querySelector('#exif-camera-grid');
    this.shotSection = this.container.querySelector('#exif-shot-section');
    this.shotGrid = this.container.querySelector('#exif-shot-grid');
    this.noDataHint = this.container.querySelector('#exif-no-data');
    this.closeBtn = this.container.querySelector('.exif-close-btn');
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', () => {
      this.toggle(false);
    });
  }

  setMetadata(meta) {
    if (!meta) {
      this.basicGrid.innerHTML = '<div class="exif-item-val">无信息</div>';
      return;
    }

    const mp = meta.width && meta.height ? ((meta.width * meta.height) / 1000000).toFixed(1) : null;
    const dimensionsText = meta.width && meta.height ? `${meta.width} × ${meta.height} 像素 (${mp} MP)` : '未知';

    // Basic rows
    const basicRows = [
      { label: '文件名', value: meta.name },
      { label: '格式', value: meta.format || '未知' },
      { label: '尺寸', value: dimensionsText },
      { label: '大小', value: formatBytes(meta.sizeBytes) },
      { label: '修改时间', value: formatDate(meta.modifiedMs) },
      { label: '完整路径', value: meta.path, title: meta.path },
    ];

    this.renderGrid(this.basicGrid, basicRows);

    const exif = meta.exif || {};
    const hasCamera = !!(exif.make || exif.model || exif.lens || exif.software);
    const hasShot = !!(
      exif.dateTime ||
      exif.fNumber ||
      exif.exposureTime ||
      exif.iso ||
      exif.focalLength ||
      exif.exposureBias ||
      exif.flash
    );

    if (hasCamera) {
      this.cameraSection.style.display = 'block';
      const cameraRows = [
        { label: '设备厂商', value: exif.make },
        { label: '相机型号', value: exif.model },
        { label: '镜头型号', value: exif.lens },
        { label: '处理软件', value: exif.software },
      ].filter((r) => !!r.value);
      this.renderGrid(this.cameraGrid, cameraRows);
    } else {
      this.cameraSection.style.display = 'none';
    }

    if (hasShot) {
      this.shotSection.style.display = 'block';
      const shotRows = [
        { label: '拍摄时间', value: exif.dateTime },
        { label: '光圈大小', value: exif.fNumber },
        { label: '曝光时间', value: exif.exposureTime },
        { label: '感光度 (ISO)', value: exif.iso },
        { label: '焦距', value: exif.focalLength },
        { label: '曝光补偿', value: exif.exposureBias },
        { label: '闪光灯', value: exif.flash },
      ].filter((r) => !!r.value);
      this.renderGrid(this.shotGrid, shotRows);
    } else {
      this.shotSection.style.display = 'none';
    }

    if (!hasCamera && !hasShot) {
      this.noDataHint.style.display = 'block';
    } else {
      this.noDataHint.style.display = 'none';
    }
  }

  renderGrid(container, items) {
    container.innerHTML = '';
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'exif-row';

      const label = document.createElement('div');
      label.className = 'exif-label';
      label.textContent = item.label;

      const val = document.createElement('div');
      val.className = 'exif-val';
      val.textContent = item.value || '-';
      if (item.title) val.title = item.title;

      row.appendChild(label);
      row.appendChild(val);
      container.appendChild(row);
    });
  }

  toggle(show = null) {
    this.isVisible = show !== null ? show : !this.isVisible;
    if (this.isVisible) {
      this.container.classList.add('is-visible');
    } else {
      this.container.classList.remove('is-visible');
      if (this.onClose) this.onClose();
    }
    return this.isVisible;
  }
}
