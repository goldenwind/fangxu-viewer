/**
 * Slideshow: Fullscreen presentation with auto-playing timer and mini controller
 */
export class Slideshow {
  constructor({ container, onNext, onPrev, onExit }) {
    this.container = container;
    this.onNext = onNext;
    this.onPrev = onPrev;
    this.onExit = onExit;

    this.isPlaying = false;
    this.intervalMs = 3000;
    this.timer = null;

    this.setupDOM();
    this.bindEvents();
  }

  setupDOM() {
    this.container.classList.add('viewer-slideshow-overlay');
    this.container.innerHTML = `
      <div class="slideshow-controller">
        <button class="slideshow-btn" id="slideshow-prev" title="上一张 (←)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button class="slideshow-btn is-play" id="slideshow-playpause" title="暂停/播放 (空格)">
          <span class="icon-pause">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </span>
          <span class="icon-play" style="display:none;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
          </span>
        </button>
        <button class="slideshow-btn" id="slideshow-next" title="下一张 (→)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <div class="slideshow-separator"></div>
        <select class="slideshow-speed-select" id="slideshow-speed" title="播放间隔">
          <option value="1500">1.5 秒</option>
          <option value="3000" selected>3 秒</option>
          <option value="5000">5 秒</option>
          <option value="8000">8 秒</option>
        </select>
        <div class="slideshow-separator"></div>
        <button class="slideshow-btn" id="slideshow-exit" title="退出幻灯片 (Esc)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    `;

    this.prevBtn = this.container.querySelector('#slideshow-prev');
    this.playPauseBtn = this.container.querySelector('#slideshow-playpause');
    this.iconPause = this.container.querySelector('.icon-pause');
    this.iconPlay = this.container.querySelector('.icon-play');
    this.nextBtn = this.container.querySelector('#slideshow-next');
    this.speedSelect = this.container.querySelector('#slideshow-speed');
    this.exitBtn = this.container.querySelector('#slideshow-exit');
    this.controllerElem = this.container.querySelector('.slideshow-controller');
    this.isHoveringController = false;
    this.controllerIdleTimer = null;
  }

  bindEvents() {
    this.prevBtn.addEventListener('click', () => {
      this.resetTimer();
      if (this.onPrev) this.onPrev();
    });

    this.nextBtn.addEventListener('click', () => {
      this.resetTimer();
      if (this.onNext) this.onNext();
    });

    this.playPauseBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    this.speedSelect.addEventListener('change', (e) => {
      this.intervalMs = parseInt(e.target.value, 10) || 3000;
      this.resetTimer();
    });

    this.exitBtn.addEventListener('click', () => {
      this.stop();
    });

    this.controllerElem?.addEventListener('mouseenter', () => {
      this.isHoveringController = true;
      this.showController();
      if (this.controllerIdleTimer) clearTimeout(this.controllerIdleTimer);
    });

    this.controllerElem?.addEventListener('mouseleave', () => {
      this.isHoveringController = false;
      this.startControllerIdleTimer();
    });

    window.addEventListener('mousemove', () => {
      if (this.isPlaying) {
        this.showController();
        this.startControllerIdleTimer();
      }
    });
  }

  startControllerIdleTimer() {
    if (this.controllerIdleTimer) clearTimeout(this.controllerIdleTimer);
    this.controllerIdleTimer = setTimeout(() => {
      if (this.isPlaying && !this.isHoveringController) {
        this.controllerElem?.classList.add('is-idle');
      }
    }, 2500);
  }

  showController() {
    this.controllerElem?.classList.remove('is-idle');
  }

  setIntervalDuration(ms) {
    if (ms) {
      this.intervalMs = ms;
      if (this.speedSelect) {
        this.speedSelect.value = String(ms);
      }
      if (this.isPlaying) {
        this.resetTimer();
      }
    }
  }

  start() {
    this.isPlaying = true;
    this.container.classList.add('is-active');
    this.showController();
    this.updatePlayState();
    this.resetTimer();
    this.startControllerIdleTimer();
  }

  stop() {
    this.isPlaying = false;
    this.clearTimer();
    if (this.controllerIdleTimer) {
      clearTimeout(this.controllerIdleTimer);
      this.controllerIdleTimer = null;
    }
    this.showController();
    this.container.classList.remove('is-active');
    if (this.onExit) this.onExit();
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    this.updatePlayState();
    if (this.isPlaying) {
      this.resetTimer();
    } else {
      this.clearTimer();
    }
  }

  updatePlayState() {
    if (this.isPlaying) {
      this.iconPause.style.display = 'inline-flex';
      this.iconPlay.style.display = 'none';
      this.playPauseBtn.title = '暂停 (空格)';
    } else {
      this.iconPause.style.display = 'none';
      this.iconPlay.style.display = 'inline-flex';
      this.playPauseBtn.title = '继续播放 (空格)';
    }
  }

  resetTimer() {
    this.clearTimer();
    if (this.isPlaying) {
      this.timer = setInterval(() => {
        if (this.onNext) this.onNext();
      }, this.intervalMs);
    }
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
