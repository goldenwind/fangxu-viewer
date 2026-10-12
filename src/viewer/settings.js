/**
 * Settings Manager: Handles user preferences and persistence
 */

export const SUPPORTED_FORMATS_METADATA = Object.freeze([
  // 1. 常用网络与照片格式
  { ext: 'jpg', name: 'JPG', desc: 'JPEG 常用照片', category: 'common' },
  { ext: 'jpeg', name: 'JPEG', desc: 'JPEG 标准图像', category: 'common' },
  { ext: 'png', name: 'PNG', desc: 'PNG 便携网络图形', category: 'common' },
  { ext: 'webp', name: 'WebP', desc: 'WebP 高效网页图', category: 'common' },
  { ext: 'gif', name: 'GIF', desc: 'GIF 动态图片', category: 'common' },
  { ext: 'svg', name: 'SVG', desc: 'SVG 矢量图形', category: 'common' },
  { ext: 'bmp', name: 'BMP', desc: 'Windows 位图', category: 'common' },
  { ext: 'avif', name: 'AVIF', desc: 'AVIF 新一代图像', category: 'common' },
  { ext: 'heic', name: 'HEIC', desc: 'Apple 高效相片', category: 'common' },
  { ext: 'heif', name: 'HEIF', desc: '高效率图像文件', category: 'common' },
  { ext: 'apng', name: 'APNG', desc: '动态 PNG 图像', category: 'common' },
  { ext: 'jpe', name: 'JPE', desc: 'JPEG 扩展格式', category: 'common' },
  { ext: 'jfif', name: 'JFIF', desc: 'JPEG 交换格式', category: 'common' },
  { ext: 'dib', name: 'DIB', desc: '设备无关位图', category: 'common' },
  { ext: 'svgz', name: 'SVGZ', desc: '压缩矢量图形', category: 'common' },

  // 2. 专业摄影与图形设计
  { ext: 'tiff', name: 'TIFF', desc: 'TIFF 高保真印刷图', category: 'pro' },
  { ext: 'tif', name: 'TIF', desc: 'TIFF 标签图像', category: 'pro' },
  { ext: 'hdr', name: 'HDR', desc: '高动态范围 Radiance', category: 'pro' },
  { ext: 'exr', name: 'EXR', desc: 'OpenEXR 工业级图像', category: 'pro' },
  { ext: 'tga', name: 'TGA', desc: 'Truevision 纹理图', category: 'pro' },
  { ext: 'dds', name: 'DDS', desc: 'DirectDraw Surface 纹理', category: 'pro' },
  { ext: 'icb', name: 'ICB', desc: 'Targa ICB 图像', category: 'pro' },
  { ext: 'vda', name: 'VDA', desc: 'Targa VDA 图像', category: 'pro' },
  { ext: 'vst', name: 'VST', desc: 'Targa VST 图像', category: 'pro' },

  // 3. 系统与专用格式
  { ext: 'ico', name: 'ICO', desc: 'Windows 应用图标', category: 'system' },
  { ext: 'cur', name: 'CUR', desc: 'Windows 光标文件', category: 'system' },
  { ext: 'qoi', name: 'QOI', desc: 'Quite OK 极速图像', category: 'system' },
  { ext: 'pnm', name: 'PNM', desc: '便携任选映射图', category: 'system' },
  { ext: 'pbm', name: 'PBM', desc: '便携式单色位图', category: 'system' },
  { ext: 'pgm', name: 'PGM', desc: '便携式灰度图像', category: 'system' },
  { ext: 'ppm', name: 'PPM', desc: '便携式彩色像素图', category: 'system' },
  { ext: 'pam', name: 'PAM', desc: '便携式任意映射图', category: 'system' },
  { ext: 'ff', name: 'farbfeld', desc: '无损 16位 RGBA 图像', category: 'system' },
]);

export const ALL_SUPPORTED_EXTENSIONS = Object.freeze(
  SUPPORTED_FORMATS_METADATA.map((f) => f.ext)
);

export const DEFAULT_SETTINGS = Object.freeze({
  wheelBehavior: 'page', // 'page' (默认翻页，⌘+滚轮缩放) | 'zoom'
  loopNavigation: true, // boolean: whether to wrap around folder images
  recursiveScanning: false, // boolean: whether to recursively scan subfolder images
  filmstripMode: 'hover', // 'hover' (auto-show on bottom mouse hover) | 'always' | 'manual'
  showFilmstripByDefault: false, // boolean: legacy compatibility
  doubleClickBehavior: 'toggle-fit', // 'toggle-fit' (默认双击适应窗口与 1:1 实际尺寸切换) | 'toggle-fullscreen'
  openImageScaleMode: 'fit-if-larger', // 'fit-if-larger' (默认 1:1，超出则适应) | 'fit-window' | 'original'
  backgroundTheme: 'dark', // 'dark' | 'checkerboard' | 'black' | 'light'
  slideshowInterval: 3000, // ms: 1500, 3000, 5000, 8000
  associatedExtensions: [...ALL_SUPPORTED_EXTENSIONS], // 默认关联自己能打开的全部图片
});

const STORAGE_KEY = 'fangxu_viewer_settings';

export class SettingsManager {
  constructor(initialOverrides = {}) {
    this.settings = this.load(initialOverrides);
    this.listeners = new Set();
  }

  load(overrides = {}) {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_SETTINGS, ...parsed, ...overrides };
        }
      }
    } catch {
      // Fallback to defaults
    }
    return { ...DEFAULT_SETTINGS, ...overrides };
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.save();
    this.emitChange(key, value);
  }

  update(patch = {}) {
    let changed = false;
    for (const [key, val] of Object.entries(patch)) {
      if (this.settings[key] !== val) {
        this.settings[key] = val;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.emitChange('*', this.settings);
    }
  }

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.emitChange('*', this.settings);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange(key, val) {
    for (const listener of this.listeners) {
      try {
        listener(key, val, this.settings);
      } catch (e) {
        console.error('Settings listener error:', e);
      }
    }
  }
}
