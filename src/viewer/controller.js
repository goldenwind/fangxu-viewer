import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export class ViewerController {
  constructor({
    canvasView,
    filmstrip,
    exifDrawer,
    slideshow,
    settingsManager,
    onStateChange,
    showToast,
    confirmDialog,
    onOpenSettings,
  }) {
    this.canvasView = canvasView;
    this.filmstrip = filmstrip;
    this.exifDrawer = exifDrawer;
    this.slideshow = slideshow;
    this.settingsManager = settingsManager;
    this.onStateChange = onStateChange;
    this.showToast = showToast || console.log;
    this.confirmDialog = confirmDialog;
    this.onOpenSettings = onOpenSettings;

    this.images = [];
    this.currentIndex = -1;
    this.folderPath = '';
    this.currentMetadata = null;
    this.isFullscreen = false;
    this.isLoading = false;

    this.bindKeyboardShortcuts();
  }

  get currentImage() {
    if (this.currentIndex >= 0 && this.currentIndex < this.images.length) {
      return this.images[this.currentIndex];
    }
    return null;
  }

  resolveSrc(filePath) {
    if (!filePath) return '';
    try {
      return convertFileSrc(filePath);
    } catch {
      return filePath;
    }
  }

  async openTarget(filePathOrDir) {
    if (!filePathOrDir) return;
    this.isLoading = true;
    this.notifyState();

    try {
      const recursive = this.settingsManager ? !!this.settingsManager.get('recursiveScanning') : false;
      const scanResult = await invoke('scan_folder_images', { targetPath: filePathOrDir, recursive });
      this.folderPath = scanResult.folderPath;
      this.images = scanResult.images || [];

      if (this.images.length === 0) {
        this.currentIndex = -1;
        this.currentMetadata = null;
        this.canvasView.clear();
        this.filmstrip.setImages([], -1);
        this.showToast('该目录下未找到支持的图片文件');
      } else {
        const targetIndex = scanResult.currentIndex >= 0 ? scanResult.currentIndex : 0;
        this.filmstrip.setImages(this.images, targetIndex);
        await this.jumpToIndex(targetIndex);
      }
    } catch (err) {
      console.error('打开失败:', err);
      this.showToast(`打开失败: ${err}`);
    } finally {
      this.isLoading = false;
      this.notifyState();
    }
  }

  async jumpToIndex(index) {
    if (index < 0 || index >= this.images.length) return;
    this.currentIndex = index;
    const imgItem = this.images[index];

    this.filmstrip.setCurrentIndex(index);
    const src = this.resolveSrc(imgItem.path);

    // Read metadata and EXIF in parallel
    let meta = null;
    try {
      meta = await invoke('read_image_meta', { filePath: imgItem.path });
    } catch (e) {
      console.warn('获取元数据失败:', e);
      meta = {
        path: imgItem.path,
        name: imgItem.name,
        sizeBytes: imgItem.sizeBytes,
        width: 0,
        height: 0,
        format: '',
        modifiedMs: imgItem.modifiedMs,
        exif: null,
      };
    }

    this.currentMetadata = meta;
    this.exifDrawer.setMetadata(meta);
    this.canvasView.setImage(
      src,
      meta.width,
      meta.height,
      () => invoke('read_image_as_data_url', { filePath: imgItem.path })
    );

    this.notifyState();
  }

  prevImage() {
    if (this.images.length <= 1) return;
    const isLoop = this.settingsManager ? this.settingsManager.get('loopNavigation') : true;

    if (!isLoop && this.currentIndex <= 0) {
      this.showToast('已是第一张图片');
      return;
    }

    const nextIdx = (this.currentIndex - 1 + this.images.length) % this.images.length;
    this.jumpToIndex(nextIdx);
  }

  nextImage() {
    if (this.images.length <= 1) return;
    const isLoop = this.settingsManager ? this.settingsManager.get('loopNavigation') : true;

    if (!isLoop && this.currentIndex >= this.images.length - 1) {
      this.showToast('已是最后一张图片');
      return;
    }

    const nextIdx = (this.currentIndex + 1) % this.images.length;
    this.jumpToIndex(nextIdx);
  }

  firstImage() {
    if (this.images.length > 0) {
      this.jumpToIndex(0);
    }
  }

  lastImage() {
    if (this.images.length > 0) {
      this.jumpToIndex(this.images.length - 1);
    }
  }

  async openFileDialog() {
    try {
      const selected = await invoke('open_image_dialog');
      if (selected) {
        await this.openTarget(selected);
      }
    } catch (err) {
      this.showToast(`选择文件出错: ${err}`);
    }
  }

  async saveAs() {
    const current = this.currentImage;
    if (!current) return;
    try {
      const saved = await invoke('save_image_as_dialog', {
        sourcePath: current.path,
        suggestedName: current.name,
      });
      if (saved) {
        this.showToast(`已成功保存为：${saved}`);
      }
    } catch (err) {
      this.showToast(`保存失败: ${err}`);
    }
  }

  async copyToClipboard() {
    const current = this.currentImage;
    if (!current) return;
    try {
      await invoke('copy_image_to_clipboard', { filePath: current.path });
      this.showToast('已复制图片到系统剪贴板');
    } catch (err) {
      console.warn('拷贝图片失败，尝试拷贝路径:', err);
      try {
        await navigator.clipboard.writeText(current.path);
        this.showToast('已复制图片文件路径');
      } catch {
        this.showToast(`复制失败: ${err}`);
      }
    }
  }

  async revealInFileManager() {
    const current = this.currentImage;
    const path = current ? current.path : this.folderPath;
    if (!path) return;
    try {
      await invoke('reveal_in_file_manager', { path });
    } catch (err) {
      this.showToast(`无法在文件管理器中定位: ${err}`);
    }
  }

  async deleteCurrentImage() {
    const current = this.currentImage;
    if (!current) return;

    const confirmed = this.confirmDialog
      ? await this.confirmDialog(`确定要将 "${current.name}" 移入回收站吗？`)
      : window.confirm(`确定要将 "${current.name}" 移入回收站吗？`);

    if (!confirmed) return;

    try {
      await invoke('trash_image_file', { filePath: current.path });
      this.showToast(`已移入回收站: ${current.name}`);

      // Remove from list
      const deletedIdx = this.currentIndex;
      this.images.splice(deletedIdx, 1);

      if (this.images.length === 0) {
        this.currentIndex = -1;
        this.currentMetadata = null;
        this.canvasView.clear();
        this.filmstrip.setImages([], -1);
      } else {
        const nextIdx = deletedIdx >= this.images.length ? this.images.length - 1 : deletedIdx;
        this.filmstrip.setImages(this.images, nextIdx);
        await this.jumpToIndex(nextIdx);
      }
      this.notifyState();
    } catch (err) {
      this.showToast(`删除失败: ${err}`);
    }
  }

  async toggleFullscreen() {
    try {
      const isFull = await invoke('toggle_fullscreen');
      this.isFullscreen = isFull;
      this.notifyState();
    } catch {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        this.isFullscreen = true;
      } else {
        await document.exitFullscreen().catch(() => {});
        this.isFullscreen = false;
      }
      this.notifyState();
    }
  }

  toggleSlideshow() {
    if (this.images.length === 0) return;
    if (this.slideshow.isPlaying) {
      this.slideshow.stop();
    } else {
      this.slideshow.start();
    }
  }

  toggleFilmstrip() {
    return this.filmstrip.toggle(null, true);
  }

  toggleExif() {
    return this.exifDrawer.toggle();
  }

  fitWindow() {
    this.canvasView.fitToWindow(true);
  }

  actualSize() {
    this.canvasView.actualSize(true);
  }

  zoomIn() {
    this.canvasView.zoomIn();
  }

  zoomOut() {
    this.canvasView.zoomOut();
  }

  rotateRight() {
    this.canvasView.rotateRight();
  }

  rotateLeft() {
    this.canvasView.rotateLeft();
  }

  flipH() {
    this.canvasView.flipHorizontal();
  }

  flipV() {
    this.canvasView.flipVertical();
  }

  notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        images: this.images,
        currentIndex: this.currentIndex,
        currentImage: this.currentImage,
        currentMetadata: this.currentMetadata,
        total: this.images.length,
        hasImage: !!this.currentImage,
        isFullscreen: this.isFullscreen,
        isLoading: this.isLoading,
      });
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Esc: Close drawers, exit slideshow, or exit fullscreen
      if (e.key === 'Escape') {
        if (this.slideshow.isPlaying) {
          this.slideshow.stop();
          return;
        }
        if (this.exifDrawer.isVisible) {
          this.exifDrawer.toggle(false);
          return;
        }
        if (this.filmstrip.isVisible) {
          this.filmstrip.toggle(false);
          return;
        }
        if (this.isFullscreen) {
          this.toggleFullscreen();
          return;
        }
        // If zoomed in, reset to fit
        if (!this.canvasView.isFitMode) {
          this.canvasView.fitToWindow(true);
        }
        return;
      }

      // Open settings: Ctrl+, / Cmd+,
      if (ctrlOrCmd && (e.key === ',' || e.key === '，')) {
        e.preventDefault();
        if (this.onOpenSettings) this.onOpenSettings();
        return;
      }

      // Open file: Ctrl+O / Cmd+O
      if (ctrlOrCmd && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        this.openFileDialog();
        return;
      }

      // Save as: Ctrl+S / Cmd+S
      if (ctrlOrCmd && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.saveAs();
        return;
      }

      // Copy image: Ctrl+C / Cmd+C
      if (ctrlOrCmd && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        this.copyToClipboard();
        return;
      }

      // Fullscreen: F11 or Enter
      if (e.key === 'F11' || (e.key === 'Enter' && !e.repeat)) {
        e.preventDefault();
        this.toggleFullscreen();
        return;
      }

      // Slideshow: F5
      if (e.key === 'F5') {
        e.preventDefault();
        this.toggleSlideshow();
        return;
      }

      // Space: Slideshow toggle play/pause or next image
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.slideshow.isPlaying) {
          this.slideshow.togglePlay();
        } else {
          this.nextImage();
        }
        return;
      }

      // Previous image: Left arrow, PageUp, A
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.prevImage();
        return;
      }

      // Next image: Right arrow, PageDown, D
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.nextImage();
        return;
      }

      // Home / End
      if (e.key === 'Home') {
        e.preventDefault();
        this.firstImage();
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        this.lastImage();
        return;
      }

      // Zoom in: Up arrow, +, =
      if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.canvasView.zoomIn();
        return;
      }

      // Zoom out: Down arrow, -
      if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault();
        this.canvasView.zoomOut();
        return;
      }

      // 1:1 Actual size: 1
      if (e.key === '1') {
        e.preventDefault();
        this.canvasView.actualSize(true);
        return;
      }

      // Fit to window: 0
      if (e.key === '0') {
        e.preventDefault();
        this.canvasView.fitToWindow(true);
        return;
      }

      // Rotate left: L
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.canvasView.rotateLeft();
        return;
      }

      // Rotate right: R
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.canvasView.rotateRight();
        return;
      }

      // Flip horizontal: H
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.canvasView.flipHorizontal();
        return;
      }

      // Flip vertical: V
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        this.canvasView.flipVertical();
        return;
      }

      // Filmstrip: T
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.toggleFilmstrip();
        return;
      }

      // EXIF / Image Info: I
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        this.toggleExif();
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === 'Delete' || (e.key === 'Backspace' && ctrlOrCmd)) {
        e.preventDefault();
        this.deleteCurrentImage();
      }
    });
  }
}
