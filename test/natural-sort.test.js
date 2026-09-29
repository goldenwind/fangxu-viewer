import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalCompare } from '../src/viewer/natural-sort.js';

test('naturalCompare orders filenames with numeric chunks correctly', () => {
  const list = ['img10.png', 'img1.png', 'img2.png', 'IMG100.png', 'img20.png'];
  list.sort(naturalCompare);
  assert.deepEqual(list, ['img1.png', 'img2.png', 'img10.png', 'img20.png', 'IMG100.png']);
});

test('naturalCompare handles complex names with numbers and letters', () => {
  const list = ['photo-v2-sub1.jpg', 'photo-v1-sub10.jpg', 'photo-v1-sub2.jpg'];
  list.sort(naturalCompare);
  assert.deepEqual(list, ['photo-v1-sub2.jpg', 'photo-v1-sub10.jpg', 'photo-v2-sub1.jpg']);
});
