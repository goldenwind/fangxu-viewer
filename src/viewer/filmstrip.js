import { invoke } from '@tauri-apps/api/core';

/**
 * Filmstrip: Bottom collapsible thumbnail navigation bar with intelligent hover auto-show & quick jump
 */
export class Filmstrip {
  constructor({ container, onSelectImage, resolveImageSrc, settingsManager }) {
    this.container = container;
    this.onSelectImage = onSelectImage;
    this.resolveImageSrc = resolveImageSrc;
    this.settingsManager = settingsManager;

    this.images = [];
    this.currentIndex = -1;
    this.isVisible = false;
    this.isPinned = false; // manually opened via T key or toolbar button
    this.hoverTimer = null;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-filmstrip');
    this.container.innerHTML = `
      <div class="filmstrip-inner">
        <div class="filmstrip-header">
          <div class="filmstrip-header-left">
            <span class="filmstrip-title">目录缩略图</span>
            <span class="filmstrip-count">0 张</span>
          </div>
          <div class="filmstrip-header-right">
            <span class="filmstrip-hint">点击快速切换</span>
            <button class="filmstrip-close-btn" title="收起缩略图 (T)">×</button>
          </div>
        </div>
        <div class="filmstrip-track-wrapper">
          <div class="filmstrip-track"></div>
        </div>
      </div>
    `;

    this.track = this.container.querySelector('.filmstrip-track');
    this.trackWrapper = this.container.querySelector('.filmstrip-track-wrapper');
    this.countEl = this.container.querySelector('.filmstrip-count');
    this.closeBtn = this.container.querySelector('.filmstrip-close-btn');
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isPinned = false;
      this.toggle(false);
    });

    // Horizontal wheel scroll on filmstrip
    this.trackWrapper.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.trackWrapper.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    // Global mouse tracking for bottom hover auto-show
    window.addEventListener('mousemove', (e) => {
      this.handleWindowMouseMove(e);
    });
  }

  getMode() {
    if (!this.settingsManager) return 'hover';
    return this.settingsManager.get('filmstripMode') || 'hover';
  }

  handleWindowMouseMove(e) {
    if (this.images.length === 0) return;
    const mode = this.getMode();

    if (mode === 'always') {
      if (!this.isVisible) this.show();
      return;
    }

    if (mode !== 'hover') {
      return;
    }

    // In hover mode: trigger when mouse is within bottom 80px of window
    const distFromBottom = window.innerHeight - e.clientY;
    const isOverBottomArea = distFromBottom <= 80 || this.container.contains(e.target);

    if (isOverBottomArea) {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      if (!this.isVisible) {
        this.show();
      }
    } else if (this.isVisible && !this.isPinned) {
      // Mouse moved away from bottom area
      if (distFromBottom > 140 && !this.hoverTimer) {
        this.hoverTimer = setTimeout(() => {
          this.hoverTimer = null;
          if (!this.isPinned && this.getMode() === 'hover') {
            this.hide();
          }
        }, 550);
      }
    }
  }

  setImages(images, currentIndex = 0) {
    this.images = images || [];
    this.currentIndex = currentIndex;
    this.countEl.textContent = `${this.images.length} 张`;
    this.renderThumbnails();

    const mode = this.getMode();
    if (mode === 'always' && this.images.length > 0) {
      this.show();
    }
  }

  setCurrentIndex(index) {
    if (this.currentIndex === index) return;
    this.currentIndex = index;

    const items = this.track.querySelectorAll('.filmstrip-item');
    items.forEach((item, idx) => {
      if (idx === index) {
        item.classList.add('is-active');
        item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        item.classList.remove('is-active');
      }
    });
  }

  renderThumbnails() {
    this.track.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.images.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = `filmstrip-item ${idx === this.currentIndex ? 'is-active' : ''}`;
      item.title = `${img.name}\n序号: ${idx + 1} / ${this.images.length}\n点击快速查看`;

      const thumbImg = document.createElement('img');
      thumbImg.className = 'filmstrip-thumb';
      thumbImg.loading = 'lazy';
      thumbImg.alt = img.name;
      thumbImg.src = this.resolveImageSrc(img.path);

      // Robust fallback if convertFileSrc fails
      thumbImg.onerror = async () => {
        try {
          const fallbackData = await invoke('read_image_as_data_url', { filePath: img.path });
          thumbImg.src = fallbackData;
        } catch {
          // ignore
        }
      };

      const label = document.createElement('div');
      label.className = 'filmstrip-name';
      label.textContent = img.name;

      item.appendChild(thumbImg);
      item.appendChild(label);

      item.addEventListener('click', () => {
        if (this.onSelectImage) {
          this.onSelectImage(idx);
        }
      });

      fragment.appendChild(item);
    });

    this.track.appendChild(fragment);

    // Scroll active item into view
    setTimeout(() => {
      const active = this.track.querySelector('.filmstrip-item.is-active');
      if (active) {
        active.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      }
    }, 50);
  }

  show() {
    this.isVisible = true;
    this.container.classList.add('is-visible');
    const active = this.track.querySelector('.filmstrip-item.is-active');
    if (active) {
      setTimeout(() => {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }

  hide() {
    this.isVisible = false;
    this.container.classList.remove('is-visible');
  }

  toggle(force = null, isManual = false) {
    if (isManual) {
      this.isPinned = force !== null ? force : !this.isVisible;
    }
    const nextState = force !== null ? force : !this.isVisible;
    if (nextState) {
      this.show();
    } else {
      this.hide();
    }
    return this.isVisible;
  }
}
