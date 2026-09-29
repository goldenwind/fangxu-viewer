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
        <div class="filmstrip-track-wrapper">
          <div class="filmstrip-track"></div>
        </div>
      </div>
    `;

    this.track = this.container.querySelector('.filmstrip-track');
    this.trackWrapper = this.container.querySelector('.filmstrip-track-wrapper');
  }

  bindEvents() {
    // Horizontal wheel scroll on filmstrip
    this.trackWrapper.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0 || e.deltaX !== 0) {
        e.preventDefault();
        const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
        this.trackWrapper.scrollLeft += delta;
      }
    }, { passive: false });

    // Global mouse tracking for bottom hover auto-show
    window.addEventListener('mousemove', (e) => {
      this.handleWindowMouseMove(e);
    });

    // Re-center active item when container width changes
    this.resizeObserver = new ResizeObserver(() => {
      if (this.currentIndex >= 0) {
        this.scrollToIndex(this.currentIndex, false);
      }
    });
    this.resizeObserver.observe(this.trackWrapper);
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

    // In hover mode: trigger when mouse is within bottom 84px of window
    const distFromBottom = window.innerHeight - e.clientY;
    const isOverBottomArea = distFromBottom <= 84 || this.container.contains(e.target);

    if (isOverBottomArea) {
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      if (!this.isVisible) {
        this.show();
      }
    } else if (this.isVisible && !this.isPinned) {
      // Mouse moved away from bottom thumbnail area
      if (distFromBottom > 88 && !this.hoverTimer) {
        this.hoverTimer = setTimeout(() => {
          this.hoverTimer = null;
          if (!this.isPinned && this.getMode() === 'hover') {
            this.hide();
          }
        }, 400);
      }
    }
  }

  setImages(images, currentIndex = 0) {
    this.images = images || [];
    this.currentIndex = currentIndex;
    this.renderThumbnails();

    const mode = this.getMode();
    if (mode === 'always' && this.images.length > 0) {
      this.show();
    }
  }

  scrollToIndex(index, smooth = true) {
    if (!this.track || !this.trackWrapper) return;
    const items = this.track.querySelectorAll('.filmstrip-item');
    const item = items[index];
    if (!item) return;

    const targetLeft = item.offsetLeft + item.offsetWidth / 2 - this.trackWrapper.clientWidth / 2;
    this.trackWrapper.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  setCurrentIndex(index) {
    if (this.currentIndex === index) return;
    this.currentIndex = index;

    const items = this.track.querySelectorAll('.filmstrip-item');
    items.forEach((item, idx) => {
      if (idx === index) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });

    this.scrollToIndex(index, true);
  }

  renderThumbnails() {
    this.track.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.images.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = `filmstrip-item ${idx === this.currentIndex ? 'is-active' : ''}`;
      item.title = `${img.name}\n序号: ${idx + 1} / ${this.images.length}`;

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

      item.appendChild(thumbImg);

      item.addEventListener('click', () => {
        if (this.onSelectImage) {
          this.onSelectImage(idx);
        }
      });

      fragment.appendChild(item);
    });

    this.track.appendChild(fragment);

    setTimeout(() => {
      this.scrollToIndex(this.currentIndex, false);
    }, 40);
  }

  show() {
    this.isVisible = true;
    this.container.classList.add('is-visible');
    setTimeout(() => {
      this.scrollToIndex(this.currentIndex, false);
    }, 50);
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

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
