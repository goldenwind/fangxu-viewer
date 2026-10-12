import test from "node:test";
import assert from "node:assert/strict";
import {
  detectPlatform,
  WINDOWS_MINIMIZE_SVG,
  WINDOWS_MAXIMIZE_SVG,
  WINDOWS_RESTORE_SVG,
  WINDOWS_CLOSE_SVG,
  UIToolbar,
} from "../src/viewer/ui-toolbar.js";

test("detectPlatform detects Windows correctly", () => {
  const winNav1 = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    platform: "Win32",
  };
  assert.equal(detectPlatform(winNav1), "windows");

  const winNav2 = {
    userAgent: "Mozilla/5.0 (Windows NT 11.0; Win64; x64)",
    platform: "Win64",
  };
  assert.equal(detectPlatform(winNav2), "windows");
});

test("detectPlatform detects macOS correctly", () => {
  const macNav = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    platform: "MacIntel",
  };
  assert.equal(detectPlatform(macNav), "macos");
});

function createMockElement(tagName = "div") {
  const el = {
    tagName,
    attributes: new Map(),
    style: {},
    classList: {
      _set: new Set(),
      add(...classes) { classes.forEach((c) => this._set.add(c)); },
      remove(...classes) { classes.forEach((c) => this._set.delete(c)); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) {
        const val = force !== undefined ? !!force : !this.contains(c);
        if (val) this.add(c); else this.remove(c);
        return val;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute(k, v) { this.attributes.set(k, v); },
    getAttribute(k) { return this.attributes.get(k); },
    _innerHTML: "",
    elementsById: new Map(),
    elementsByClass: new Map(),
    get innerHTML() { return this._innerHTML; },
    set innerHTML(html) {
      this._innerHTML = html;
      this.elementsById.clear();
      this.elementsByClass.clear();

      const tagRegex = /<([a-z0-9-]+)([^>]*)>/gi;
      let match;
      while ((match = tagRegex.exec(html)) !== null) {
        const tag = match[1];
        const attrStr = match[2];
        const child = createMockElement(tag);

        const idMatch = attrStr.match(/id="([^"]+)"/i);
        if (idMatch) {
          child.id = idMatch[1];
          this.elementsById.set(child.id, child);
        }

        const titleMatch = attrStr.match(/title="([^"]+)"/i);
        if (titleMatch) {
          child.title = titleMatch[1];
        }

        const classMatch = attrStr.match(/class="([^"]+)"/i);
        if (classMatch) {
          const classes = classMatch[1].split(/\s+/).filter(Boolean);
          classes.forEach((c) => {
            child.classList.add(c);
            if (!this.elementsByClass.has(c)) {
              this.elementsByClass.set(c, []);
            }
            this.elementsByClass.get(c).push(child);
          });
        }
      }
    },
    querySelector(selector) {
      if (selector.startsWith("#")) {
        const id = selector.slice(1);
        return this.elementsById.get(id) || null;
      }
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        const list = this.elementsByClass.get(cls);
        return list && list.length > 0 ? list[0] : null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith(".")) {
        const cls = selector.slice(1);
        return this.elementsByClass.get(cls) || [];
      }
      return [];
    },
  };
  return el;
}

test("Windows mode renders controls on the right with correct buttons and styles", () => {
  const topbarContainer = createMockElement("header");
  const bottomToolbarContainer = createMockElement("footer");
  const sideArrowsContainer = createMockElement("div");

  const toolbar = new UIToolbar({
    topbarContainer,
    bottomToolbarContainer,
    sideArrowsContainer,
    controller: {},
    canvasView: {},
    onOpenSettings: () => {},
    platform: "windows",
  });

  assert.equal(topbarContainer.classList.contains("is-windows"), true);
  assert.equal(topbarContainer.innerHTML.includes("mac-window-controls"), false);
  assert.equal(topbarContainer.innerHTML.includes("windows-window-controls"), true);

  const minIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-min\"");
  const maxIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-max\"");
  const closeIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-close\"");

  assert.ok(minIndex !== -1, "btn-win-min should exist");
  assert.ok(maxIndex !== -1, "btn-win-max should exist");
  assert.ok(closeIndex !== -1, "btn-win-close should exist");
  assert.ok(minIndex < maxIndex, "Minimize button must be before Maximize");
  assert.ok(maxIndex < closeIndex, "Maximize button must be before Close");

  const btnMin = topbarContainer.querySelector("#btn-win-min");
  const btnMax = topbarContainer.querySelector("#btn-win-max");
  const btnClose = topbarContainer.querySelector("#btn-win-close");

  assert.equal(btnMin.title, "最小化");
  assert.equal(btnMax.title, "最大化");
  assert.equal(btnClose.title, "关闭 (Alt+F4)");

  toolbar.setMaximized(true);
  assert.equal(toolbar.isMaximized, true);
  assert.equal(btnMax.title, "还原");
  assert.equal(btnMax.innerHTML, WINDOWS_RESTORE_SVG);
  assert.equal(topbarContainer.classList.contains("is-maximized"), true);

  toolbar.setMaximized(false);
  assert.equal(toolbar.isMaximized, false);
  assert.equal(btnMax.title, "最大化");
  assert.equal(btnMax.innerHTML, WINDOWS_MAXIMIZE_SVG);
  assert.equal(topbarContainer.classList.contains("is-maximized"), false);
});

test("macOS mode renders traffic lights on the left with correct order", () => {
  const topbarContainer = createMockElement("header");
  const bottomToolbarContainer = createMockElement("footer");
  const sideArrowsContainer = createMockElement("div");

  new UIToolbar({
    topbarContainer,
    bottomToolbarContainer,
    sideArrowsContainer,
    controller: {},
    canvasView: {},
    onOpenSettings: () => {},
    platform: "macos",
  });

  assert.equal(topbarContainer.classList.contains("is-windows"), false);
  assert.equal(topbarContainer.innerHTML.includes("mac-window-controls"), true);
  assert.equal(topbarContainer.innerHTML.includes("windows-window-controls"), false);

  const closeIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-close\"");
  const minIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-min\"");
  const maxIndex = topbarContainer.innerHTML.indexOf("id=\"btn-win-max\"");

  assert.ok(closeIndex < minIndex, "Close must come before Minimize on macOS");
  assert.ok(minIndex < maxIndex, "Minimize must come before Maximize on macOS");

  const btnClose = topbarContainer.querySelector("#btn-win-close");
  const btnMin = topbarContainer.querySelector("#btn-win-min");
  assert.equal(btnClose.title, "关闭窗口 (⌘W)");
  assert.equal(btnMin.title, "最小化 (⌘M)");
});
