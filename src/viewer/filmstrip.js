/**
 * Filmstrip: Bottom collapsible thumbnail navigation bar
 */
export class Filmstrip {
  constructor({ container, onSelectImage, resolveImageSrc }) {
    this.container = container;
    this.onSelectImage = onSelectImage;
    this.resolveImageSrc = resolveImageSrc;
    this.images = [];
    this.currentIndex = -1;
    this.isVisible = false;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-filmstrip');
    this.container.innerHTML = `
      <div class="filmstrip-inner">
        <div class="filmstrip-header">
          <span class="filmstrip-title">目录缩略图</span>
          <span class="filmstrip-count">0 张</span>
          <button class="filmstrip-close-btn" title="收起缩略图 (T)">×</button>
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
    this.closeBtn.addEventListener('click', () => {
      this.toggle(false);
    });

    // Horizontal wheel scroll on filmstrip
    this.trackWrapper.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        this.trackWrapper.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  setImages(images, currentIndex = 0) {
    this.images = images || [];
    this.currentIndex = currentIndex;
    this.countEl.textContent = `${this.images.length} 张`;
    this.renderThumbnails();
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
      item.title = `${img.name}\n序号: ${idx + 1} / ${this.images.length}`;

      const thumbImg = document.createElement('img');
      thumbImg.className = 'filmstrip-thumb';
      thumbImg.loading = 'lazy';
      thumbImg.alt = img.name;
      thumbImg.src = this.resolveImageSrc(img.path);

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

  toggle(show = null) {
    this.isVisible = show !== null ? show : !this.isVisible;
    if (this.isVisible) {
      this.container.classList.add('is-visible');
      const active = this.track.querySelector('.filmstrip-item.is-active');
      if (active) {
        setTimeout(() => {
          active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }, 100);
      }
    } else {
      this.container.classList.remove('is-visible');
    }
    return this.isVisible;
  }
}
