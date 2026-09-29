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
