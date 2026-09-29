import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsManager, DEFAULT_SETTINGS } from '../src/viewer/settings.js';

test('SettingsManager initializes with defaults when localStorage is empty', () => {
  const manager = new SettingsManager();
  assert.equal(manager.get('wheelBehavior'), 'zoom');
  assert.equal(manager.get('loopNavigation'), true);
  assert.equal(manager.get('showFilmstripByDefault'), false);
  assert.equal(manager.get('doubleClickBehavior'), 'toggle-fit');
  assert.equal(manager.get('backgroundTheme'), 'dark');
});

test('SettingsManager updates single setting and emits change', () => {
  const manager = new SettingsManager();
  let changedKey = null;
  let changedVal = null;

  manager.subscribe((key, val) => {
    changedKey = key;
    changedVal = val;
  });

  manager.set('wheelBehavior', 'page');
  assert.equal(manager.get('wheelBehavior'), 'page');
  assert.equal(changedKey, 'wheelBehavior');
  assert.equal(changedVal, 'page');
});

test('SettingsManager update patch applies multiple values', () => {
  const manager = new SettingsManager();
  manager.update({
    loopNavigation: false,
    showFilmstripByDefault: true,
  });

  assert.equal(manager.get('loopNavigation'), false);
  assert.equal(manager.get('showFilmstripByDefault'), true);
  assert.equal(manager.get('wheelBehavior'), 'zoom'); // unchanged
});

test('SettingsManager reset restores all defaults', () => {
  const manager = new SettingsManager();
  manager.set('backgroundTheme', 'light');
  manager.set('loopNavigation', false);

  manager.reset();
  assert.equal(manager.get('backgroundTheme'), DEFAULT_SETTINGS.backgroundTheme);
  assert.equal(manager.get('loopNavigation'), DEFAULT_SETTINGS.loopNavigation);
});
