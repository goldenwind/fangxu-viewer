import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/viewer/settings.js';

test('SettingsManager initializes with defaults when localStorage is empty', () => {
  const manager = new SettingsManager();
  assert.equal(manager.get('wheelBehavior'), 'page');
  assert.equal(manager.get('loopNavigation'), true);
  assert.equal(manager.get('recursiveScanning'), false);
  assert.equal(manager.get('filmstripMode'), 'hover');
  assert.equal(manager.get('showFilmstripByDefault'), false);
  assert.equal(manager.get('doubleClickBehavior'), 'toggle-fit');
  assert.equal(manager.get('openImageScaleMode'), 'fit-if-larger');
  assert.equal(manager.get('backgroundTheme'), 'dark');
  const exts = manager.get('associatedExtensions');
  assert.ok(Array.isArray(exts));
  assert.ok(exts.includes('jpg'));
  assert.ok(exts.includes('png'));
  assert.ok(exts.includes('webp'));
  assert.ok(exts.includes('gif'));
  assert.ok(exts.includes('svg'));
  assert.equal(exts.length, DEFAULT_SETTINGS.associatedExtensions.length);
});

test('SettingsManager updates single setting and emits change', () => {
  const manager = new SettingsManager();
  let changedKey = null;
  let changedVal = null;

  manager.subscribe((key, val) => {
    changedKey = key;
    changedVal = val;
  });

  manager.set('wheelBehavior', 'zoom');
  assert.equal(manager.get('wheelBehavior'), 'zoom');
  assert.equal(changedKey, 'wheelBehavior');
  assert.equal(changedVal, 'zoom');
});

test('SettingsManager update patch applies multiple values', () => {
  const manager = new SettingsManager();
  manager.update({
    loopNavigation: false,
    showFilmstripByDefault: true,
  });

  assert.equal(manager.get('loopNavigation'), false);
  assert.equal(manager.get('showFilmstripByDefault'), true);
  assert.equal(manager.get('wheelBehavior'), 'page'); // unchanged
});

test('SettingsManager reset restores all defaults', () => {
  const manager = new SettingsManager();
  manager.set('backgroundTheme', 'light');
  manager.set('loopNavigation', false);
  manager.set('associatedExtensions', ['jpg']);

  manager.reset();
  assert.equal(manager.get('backgroundTheme'), DEFAULT_SETTINGS.backgroundTheme);
  assert.equal(manager.get('loopNavigation'), DEFAULT_SETTINGS.loopNavigation);
  assert.deepEqual(manager.get('associatedExtensions'), DEFAULT_SETTINGS.associatedExtensions);
});
