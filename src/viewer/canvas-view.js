/**
 * CanvasView: High-performance pan & zoom image viewport with 2345-style interaction
 */
export class CanvasView {
  constructor({ container, onTransformChange, onDoubleClick }) {
    this.container = container;
    this.onTransformChange = onTransformChange;
    this.onDoubleClick = onDoubleClick;

    this.scale = 1.0;
    this.fitScale = 1.0;
    this.translateX = 0;
    this.translateY = 0;
    this.rotation = 0; // 0, 90, 180, 270
    this.flipH = false;
    this.flipV = false;
    this.isFitMode = true;

    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.hasImage = false;

    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialTranslateX = 0;
    this.initialTranslateY = 0;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-canvas-container');
    this.container.innerHTML = `
      <div class="viewer-viewport">
        <div class="viewer-image-wrapper">
          <img class="viewer-image" alt="viewing" draggable="false" />
        </div>
      </div>
    `;

    this.viewport = this.container.querySelector('.viewer-viewport');
    this.wrapper = this.container.querySelector('.viewer-image-wrapper');
    this.img = this.container.querySelector('.viewer-image');
  }

  bindEvents() {
    // Wheel zoom
    this.viewport.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Pointer events for dragging
    this.viewport.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    window.addEventListener('pointerup', () => this.handlePointerUp());
    window.addEventListener('pointercancel', () => this.handlePointerUp());

    // Double click to toggle Fit <-> 1:1
    this.viewport.addEventListener('dblclick', (e) => this.handleDblClick(e));

    // Resize observer to update fit scale when window resizes
    this.resizeObserver = new ResizeObserver(() => {
      if (this.hasImage && this.isFitMode) {
        this.fitToWindow(false);
      }
    });
    this.resizeObserver.observe(this.container);
  }

  setImage(src, naturalWidth = 0, naturalHeight = 0) {
    this.hasImage = true;
    this.rotation = 0;
    this.flipH = false;
    this.flipV = false;
    this.img.src = src;

    // Once loaded or when natural sizes are known
    const onLoad = () => {
      this.naturalWidth = naturalWidth || this.img.naturalWidth || 800;
      this.naturalHeight = naturalHeight || this.img.naturalHeight || 600;
      this.fitToWindow(false);
    };

    if (this.img.complete && this.img.naturalWidth) {
      onLoad();
    } else {
      this.img.onload = onLoad;
    }
  }

  clear() {
    this.hasImage = false;
    this.img.src = '';
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.scale = 1.0;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform();
  }

  getRotatedDimensions() {
    const isSwapped = this.rotation % 180 !== 0;
    const w = isSwapped ? this.naturalHeight : this.naturalWidth;
    const h = isSwapped ? this.naturalWidth : this.naturalHeight;
    return { width: w || 800, height: h || 600 };
  }

  calculateFitScale() {
    const { width: imgW, height: imgH } = this.getRotatedDimensions();
    const containerW = this.viewport.clientWidth || 800;
    const containerH = this.viewport.clientHeight || 600;

    // Provide a small margin (e.g. 16px) for sleek visual padding
    const padding = 20;
    const availW = Math.max(100, containerW - padding * 2);
    const availH = Math.max(100, containerH - padding * 2);

    const scaleW = availW / imgW;
    const scaleH = availH / imgH;
    return Math.min(scaleW, scaleH);
  }

  fitToWindow(smooth = false) {
    if (!this.hasImage) return;
    this.fitScale = this.calculateFitScale();
    this.scale = this.fitScale;
    this.translateX = 0;
    this.translateY = 0;
    this.isFitMode = true;
    this.applyTransform(smooth);
  }

  actualSize(smooth = true) {
    if (!this.hasImage) return;
    this.scale = 1.0;
    this.translateX = 0;
    this.translateY = 0;
    this.isFitMode = false;
    this.applyTransform(smooth);
  }

  zoomBy(ratio, focalPoint = null) {
    if (!this.hasImage) return;
    const oldScale = this.scale;
    let newScale = oldScale * ratio;
    // Bound zoom between 2% and 5000%
    newScale = Math.min(Math.max(newScale, 0.02), 50.0);

    if (newScale === oldScale) return;

    this.isFitMode = false;

    if (focalPoint) {
      // Zoom centered on focal point (cursor)
      const rect = this.viewport.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Mouse pos relative to viewport center
      const mouseRelCenterX = focalPoint.x - centerX;
      const mouseRelCenterY = focalPoint.y - centerY;

      // Pinned point calculation
      this.translateX = mouseRelCenterX - (mouseRelCenterX - this.translateX) * (newScale / oldScale);
      this.translateY = mouseRelCenterY - (mouseRelCenterY - this.translateY) * (newScale / oldScale);
    }

    this.scale = newScale;
    this.applyTransform(false);
  }

  zoomIn() {
    this.zoomBy(1.25);
  }

  zoomOut() {
    this.zoomBy(0.8);
  }

  rotateLeft() {
    this.rotation = (this.rotation - 90 + 360) % 360;
    if (this.isFitMode) {
      this.fitToWindow(true);
    } else {
      this.applyTransform(true);
    }
  }

  rotateRight() {
    this.rotation = (this.rotation + 90) % 360;
    if (this.isFitMode) {
      this.fitToWindow(true);
    } else {
      this.applyTransform(true);
    }
  }

  flipHorizontal() {
    this.flipH = !this.flipH;
    this.applyTransform(true);
  }

  flipVertical() {
    this.flipV = !this.flipV;
    this.applyTransform(true);
  }

  handleWheel(e) {
    if (!this.hasImage) return;
    e.preventDefault();

    // Standard 2345 mouse wheel: zoom centered on cursor
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.869;
    this.zoomBy(zoomFactor, { x: e.clientX, y: e.clientY });
  }

  handlePointerDown(e) {
    if (!this.hasImage || e.button !== 0) return;
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.initialTranslateX = this.translateX;
    this.initialTranslateY = this.translateY;
    this.viewport.classList.add('is-dragging');
  }

  handlePointerMove(e) {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    this.translateX = this.initialTranslateX + deltaX;
    this.translateY = this.initialTranslateY + deltaY;
    this.isFitMode = false;
    this.applyTransform(false);
  }

  handlePointerUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.viewport.classList.remove('is-dragging');
  }

  handleDblClick(e) {
    if (!this.hasImage) return;
    e.preventDefault();
    if (this.onDoubleClick) {
      this.onDoubleClick();
      return;
    }

    // Default 2345 behavior: toggle between Fit mode and 1:1 Actual Size
    if (this.isFitMode || Math.abs(this.scale - this.fitScale) < 0.05) {
      // Zoom to 1:1 focused on cursor
      const focalPoint = { x: e.clientX, y: e.clientY };
      const oldScale = this.scale;
      this.scale = 1.0;
      this.isFitMode = false;

      const rect = this.viewport.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseRelCenterX = focalPoint.x - centerX;
      const mouseRelCenterY = focalPoint.y - centerY;

      this.translateX = mouseRelCenterX - (mouseRelCenterX - this.translateX) * (1.0 / oldScale);
      this.translateY = mouseRelCenterY - (mouseRelCenterY - this.translateY) * (1.0 / oldScale);
      this.applyTransform(true);
    } else {
      this.fitToWindow(true);
    }
  }

  applyTransform(smooth = false) {
    if (smooth) {
      this.wrapper.style.transition = 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)';
    } else {
      this.wrapper.style.transition = 'none';
    }

    const scaleX = this.flipH ? -this.scale : this.scale;
    const scaleY = this.flipV ? -this.scale : this.scale;

    this.wrapper.style.transform = `
      translate(${this.translateX}px, ${this.translateY}px)
      rotate(${this.rotation}deg)
      scale(${scaleX}, ${scaleY})
    `;

    if (this.onTransformChange) {
      this.onTransformChange({
        scale: this.scale,
        fitScale: this.fitScale,
        isFitMode: this.isFitMode,
        rotation: this.rotation,
        flipH: this.flipH,
        flipV: this.flipV,
        percent: Math.round(this.scale * 100),
      });
    }
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
