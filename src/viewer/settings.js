/**
 * Settings Manager: Handles user preferences and persistence
 */

export const DEFAULT_SETTINGS = Object.freeze({
  wheelBehavior: 'zoom', // 'zoom' | 'page'
  loopNavigation: true, // boolean: whether to wrap around folder images
  showFilmstripByDefault: false, // boolean: whether to show bottom thumbnail strip by default
  doubleClickBehavior: 'toggle-fit', // 'toggle-fit' | 'toggle-fullscreen'
  backgroundTheme: 'dark', // 'dark' | 'checkerboard' | 'black' | 'light'
  slideshowInterval: 3000, // ms: 1500, 3000, 5000, 8000
});

const STORAGE_KEY = 'fangxu_viewer_settings';

export class SettingsManager {
  constructor(initialOverrides = {}) {
    this.settings = this.load(initialOverrides);
    this.listeners = new Set();
  }

  load(overrides = {}) {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_SETTINGS, ...parsed, ...overrides };
        }
      }
    } catch {
      // Fallback to defaults
    }
    return { ...DEFAULT_SETTINGS, ...overrides };
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : DEFAULT_SETTINGS[key];
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    if (this.settings[key] === value) return;
    this.settings[key] = value;
    this.save();
    this.emitChange(key, value);
  }

  update(patch = {}) {
    let changed = false;
    for (const [key, val] of Object.entries(patch)) {
      if (this.settings[key] !== val) {
        this.settings[key] = val;
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.emitChange('*', this.settings);
    }
  }

  reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.save();
    this.emitChange('*', this.settings);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitChange(key, val) {
    for (const listener of this.listeners) {
      try {
        listener(key, val, this.settings);
      } catch (e) {
        console.error('Settings listener error:', e);
      }
    }
  }
}
