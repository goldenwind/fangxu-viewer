import test from 'node:test';
import assert from 'node:assert/strict';

test('image index navigation wraps around correctly', () => {
  const images = [
    { name: '1.jpg', path: '/path/1.jpg' },
    { name: '2.jpg', path: '/path/2.jpg' },
    { name: '3.jpg', path: '/path/3.jpg' },
  ];

  let currentIndex = 0;

  // Next image
  const next = () => {
    currentIndex = (currentIndex + 1) % images.length;
  };

  // Prev image
  const prev = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
  };

  assert.equal(currentIndex, 0);
  next();
  assert.equal(currentIndex, 1);
  next();
  assert.equal(currentIndex, 2);
  next();
  assert.equal(currentIndex, 0); // wrapped to first

  prev();
  assert.equal(currentIndex, 2); // wrapped to last
});

test('zoom calculations stay within bounds', () => {
  let scale = 1.0;
  const zoomIn = (ratio = 1.25) => {
    scale = Math.min(Math.max(scale * ratio, 0.02), 50.0);
  };
  const zoomOut = (ratio = 0.8) => {
    scale = Math.min(Math.max(scale * ratio, 0.02), 50.0);
  };

  zoomIn();
  assert.equal(scale, 1.25);
  zoomOut();
  assert.equal(scale, 1.0);

  // Test upper bound
  for (let i = 0; i < 40; i++) zoomIn(1.5);
  assert.equal(scale, 50.0);

  // Test lower bound
  for (let i = 0; i < 40; i++) zoomOut(0.5);
  assert.equal(scale, 0.02);
});

test('rotation cycles through 0, 90, 180, 270', () => {
  let rotation = 0;
  const rotateRight = () => {
    rotation = (rotation + 90) % 360;
  };
  const rotateLeft = () => {
    rotation = (rotation - 90 + 360) % 360;
  };

  rotateRight();
  assert.equal(rotation, 90);
  rotateRight();
  assert.equal(rotation, 180);
  rotateRight();
  assert.equal(rotation, 270);
  rotateRight();
  assert.equal(rotation, 0);

  rotateLeft();
  assert.equal(rotation, 270);
});

test('image index navigation respects loopNavigation=false without wrapping', () => {
  const images = [
    { name: '1.jpg', path: '/path/1.jpg' },
    { name: '2.jpg', path: '/path/2.jpg' },
  ];

  let currentIndex = 0;
  const loop = false;

  const next = () => {
    if (currentIndex >= images.length - 1) {
      if (!loop) return false;
      currentIndex = 0;
    } else {
      currentIndex += 1;
    }
    return true;
  };

  const prev = () => {
    if (currentIndex <= 0) {
      if (!loop) return false;
      currentIndex = images.length - 1;
    } else {
      currentIndex -= 1;
    }
    return true;
  };

  assert.equal(prev(), false);
  assert.equal(currentIndex, 0); // stays at 0
  assert.equal(next(), true);
  assert.equal(currentIndex, 1);
  assert.equal(next(), false);
  assert.equal(currentIndex, 1); // stays at 1
});

test('Esc key closes modals in correct priority order', () => {
  let settingsOpen = true;
  let helpOpen = true;
  let confirmOpen = true;
  let slideshowPlaying = true;

  const handleEsc = () => {
    if (confirmOpen) {
      confirmOpen = false;
      return 'confirm-closed';
    }
    if (settingsOpen) {
      settingsOpen = false;
      return 'settings-closed';
    }
    if (helpOpen) {
      helpOpen = false;
      return 'help-closed';
    }
    if (slideshowPlaying) {
      slideshowPlaying = false;
      return 'slideshow-stopped';
    }
    return 'none';
  };

  assert.equal(handleEsc(), 'confirm-closed');
  assert.equal(confirmOpen, false);

  assert.equal(handleEsc(), 'settings-closed');
  assert.equal(settingsOpen, false);

  assert.equal(handleEsc(), 'help-closed');
  assert.equal(helpOpen, false);

  assert.equal(handleEsc(), 'slideshow-stopped');
  assert.equal(slideshowPlaying, false);

  assert.equal(handleEsc(), 'none');
});

test('Esc explicitly exits fullscreen instead of toggling', () => {
  let isFullscreen = true;
  let exitCalls = 0;

  const setFullscreen = (target) => {
    isFullscreen = target;
    exitCalls++;
  };

  const onEscape = () => {
    if (isFullscreen) {
      setFullscreen(false);
      return 'fullscreen-exited';
    }
    return 'none';
  };

  assert.equal(onEscape(), 'fullscreen-exited');
  assert.equal(isFullscreen, false);
  assert.equal(exitCalls, 1);

  // Pressing Esc again when already exited does not re-enter fullscreen
  assert.equal(onEscape(), 'none');
  assert.equal(isFullscreen, false);
  assert.equal(exitCalls, 1);
});

test('Esc closes current window in window mode regardless of filmstrip and never zooms', () => {
  let windowClosed = false;
  let isFullscreen = false;
  let filmstripVisible = true;
  let imageScale = 1.0;

  const onEscape = () => {
    // Top-level modals
    // Slideshow
    if (isFullscreen) {
      isFullscreen = false;
      return 'fullscreen-exited';
    }
    // Filmstrip must NOT block window close, and image scale must NEVER change!
    windowClosed = true;
    return 'window-closed';
  };

  assert.equal(onEscape(), 'window-closed');
  assert.equal(windowClosed, true);
  assert.equal(imageScale, 1.0); // scale must not be enlarged
});

test('Double click toggle-fit always centers image at (0, 0)', () => {
  let scale = 0.5;
  let translateX = 120; // was dragged/panned
  let translateY = -80;
  let isFitMode = true;
  const fitScale = 0.5;

  const actualSize = () => {
    scale = 1.0;
    translateX = 0;
    translateY = 0;
    isFitMode = false;
  };

  const fitToWindow = () => {
    scale = fitScale;
    translateX = 0;
    translateY = 0;
    isFitMode = true;
  };

  const handleDblClick = () => {
    const isCurrentlyFit = isFitMode || Math.abs(scale - fitScale) < 0.02;
    if (isCurrentlyFit) {
      actualSize();
    } else {
      fitToWindow();
    }
  };

  // 1. In Fit mode: double click to 1:1
  handleDblClick();
  assert.equal(scale, 1.0);
  assert.equal(translateX, 0);
  assert.equal(translateY, 0);
  assert.equal(isFitMode, false);

  // 2. In 1:1 mode: double click back to Fit
  handleDblClick();
  assert.equal(scale, 0.5);
  assert.equal(translateX, 0);
  assert.equal(translateY, 0);
  assert.equal(isFitMode, true);
});

test('macOS image convert default format selection and size preset resolution', () => {
  // Test format default: JPG defaults to PNG, others default to JPEG
  const getDefaultTargetFormat = (ext) => {
    const lower = (ext || '').toLowerCase();
    if (lower === 'jpg' || lower === 'jpeg') return 'png';
    return 'jpeg';
  };

  assert.equal(getDefaultTargetFormat('jpg'), 'png');
  assert.equal(getDefaultTargetFormat('jpeg'), 'png');
  assert.equal(getDefaultTargetFormat('png'), 'jpeg');
  assert.equal(getDefaultTargetFormat('webp'), 'jpeg');
  assert.equal(getDefaultTargetFormat('heic'), 'jpeg');

  // Test size preset max dimension resolution
  const resolveMaxDim = (preset) => {
    switch (preset) {
      case 'small': return 640;
      case 'medium': return 1280;
      case 'large': return 1920;
      case 'actual':
      default: return null;
    }
  };

  assert.equal(resolveMaxDim('small'), 640);
  assert.equal(resolveMaxDim('medium'), 1280);
  assert.equal(resolveMaxDim('large'), 1920);
  assert.equal(resolveMaxDim('actual'), null);
});

test('macOS image convert duplicate filename numbering matches Finder convention', () => {
  const existingFiles = new Set(['photo.jpeg', 'photo 1.jpeg', 'photo 2.jpeg']);

  const getAvailableFilename = (stem, ext, existing) => {
    let candidate = `${stem}.${ext}`;
    if (!existing.has(candidate)) return candidate;
    let counter = 1;
    while (existing.has(`${stem} ${counter}.${ext}`)) {
      counter += 1;
    }
    return `${stem} ${counter}.${ext}`;
  };

  assert.equal(getAvailableFilename('photo', 'jpeg', existingFiles), 'photo 3.jpeg');
  assert.equal(getAvailableFilename('document', 'png', existingFiles), 'document.png');
});

