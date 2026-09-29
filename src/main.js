import './styles.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { APP_CONFIG } from './config.js';
import { UpdateService } from './update/service.js';
import { UpdateManager } from './update/manager.js';

import { CanvasView } from './viewer/canvas-view.js';
import { Filmstrip } from './viewer/filmstrip.js';
import { ExifDrawer } from './viewer/exif-drawer.js';
import { Slideshow } from './viewer/slideshow.js';
import { ViewerController } from './viewer/controller.js';
import { UIToolbar } from './viewer/ui-toolbar.js';
import { EmptyState } from './viewer/empty-state.js';
import { SettingsManager } from './viewer/settings.js';
import { SettingsModal } from './viewer/settings-modal.js';
import { ContextMenu } from './viewer/context-menu.js';

// DOM elements
const topbarContainer = document.querySelector('#topbar-container');
const canvasContainer = document.querySelector('#canvas-container');
const sideArrowsContainer = document.querySelector('#side-arrows-container');
const bottomToolbarContainer = document.querySelector('#bottom-toolbar-container');
const filmstripContainer = document.querySelector('#filmstrip-container');
const exifDrawerContainer = document.querySelector('#exif-drawer-container');
const slideshowContainer = document.querySelector('#slideshow-container');
const emptyContainer = document.querySelector('#empty-container');
const toastContainer = document.querySelector('#toast-container');
const settingsModalContainer = document.querySelector('#settings-modal-container');

// Toast notification helper
function showToast(message, duration = 2200) {
  if (!toastContainer || !message) return;
  const toast = document.createElement('div');
  toast.className = 'viewer-toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Confirmation modal helper
function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'viewer-help-modal-overlay is-open';
    overlay.innerHTML = `
      <div class="viewer-help-card" style="max-width: 380px;">
        <div class="help-card-header">
          <h3>操作确认</h3>
        </div>
        <div class="help-card-body" style="padding: 22px 20px;">
          <p style="color: var(--text-primary); font-size: 13px; line-height: 1.6;">${message}</p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border-subtle);">
          <button class="top-icon-btn" id="confirm-cancel" style="padding: 7px 14px;">取消</button>
          <button class="empty-primary-btn" id="confirm-ok" style="background: var(--danger); color: white; padding: 7px 16px; font-size: 12px; box-shadow: none;">确定</button>
        </div>
      </div>
    `;
    const cleanup = () => {
      window.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    overlay.querySelector('#confirm-ok').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });
  });
}

// 0. Initialize Settings Manager
const settingsManager = new SettingsManager();

// Forward declarations for cross-referencing
let uiToolbar = null;
let controller = null;
let settingsModal = null;

// 1. Initialize Canvas View
const canvasView = new CanvasView({
  container: canvasContainer,
  settingsManager,
  onTransformChange: (info) => {
    if (uiToolbar) uiToolbar.updateTransform(info);
  },
  onWheelPage: (dir) => {
    if (controller) {
      if (dir > 0) controller.nextImage();
      else controller.prevImage();
    }
  },
  onToggleFullscreen: () => {
    if (controller) controller.toggleFullscreen();
  },
});

// 2. Initialize Filmstrip
const filmstrip = new Filmstrip({
  container: filmstripContainer,
  settingsManager,
  onSelectImage: (index) => {
    if (controller) controller.jumpToIndex(index);
  },
  resolveImageSrc: (path) => {
    return controller ? controller.resolveSrc(path) : path;
  },
});

// 3. Initialize EXIF Drawer
const exifDrawer = new ExifDrawer({
  container: exifDrawerContainer,
  onClose: () => {
    const exifBtn = document.querySelector('#bar-exif');
    if (exifBtn) exifBtn.classList.remove('is-active');
  },
});

// 4. Initialize Slideshow
const slideshow = new Slideshow({
  container: slideshowContainer,
  onNext: () => {
    if (controller) controller.nextImage();
  },
  onPrev: () => {
    if (controller) controller.prevImage();
  },
  onExit: () => {
    // Return to normal view
  },
});

// 5. Initialize Empty State
const emptyState = new EmptyState({
  container: emptyContainer,
  onOpenFile: () => {
    if (controller) controller.openFileDialog();
  },
});

// 6. Initialize Controller
controller = new ViewerController({
  canvasView,
  filmstrip,
  exifDrawer,
  slideshow,
  settingsManager,
  showToast,
  confirmDialog,
  onOpenSettings: () => {
    if (settingsModal) settingsModal.open();
  },
  onStateChange: (state) => {
    if (uiToolbar) uiToolbar.updateState(state);
    if (!state.hasImage) {
      emptyState.show();
    } else {
      emptyState.hide();
    }
  },
});

// 7. Update Manager
const updateManager = new UpdateManager({
  root: document.body,
  service: new UpdateService(APP_CONFIG.updates),
  config: APP_CONFIG.updates,
});
updateManager.initialize();

// 8. Initialize Settings Modal
settingsModal = new SettingsModal({
  container: settingsModalContainer,
  settingsManager,
  currentVersion: '0.1.0',
  onCheckUpdate: () => updateManager.checkNow(true),
  onApplySettings: (allSettings) => {
    canvasView.setTheme(allSettings.backgroundTheme);
    slideshow.setIntervalDuration(allSettings.slideshowInterval);
    if (allSettings.filmstripMode === 'always') {
      filmstrip.show();
    } else if (allSettings.filmstripMode === 'manual') {
      filmstrip.hide();
    }
  },
});

// 9. Initialize UI Toolbar
uiToolbar = new UIToolbar({
  topbarContainer,
  bottomToolbarContainer,
  sideArrowsContainer,
  controller,
  canvasView,
  onOpenSettings: () => {
    if (settingsModal) settingsModal.open();
  },
});

// 9. Initialize Right-Click Context Menu
const contextMenu = new ContextMenu({
  controller,
  onOpenSettings: () => {
    if (settingsModal) settingsModal.open();
  },
});

// Listen to native macOS menu actions
listen('menu-action', (event) => {
  const action = event.payload;
  handleMenuAction(action);
});

function handleMenuAction(action) {
  if (!controller) return;

  switch (action) {
    case 'open':
      controller.openFileDialog();
      break;
    case 'save_as':
    case 'save-as':
      controller.saveAs();
      break;
    case 'reveal':
      controller.revealInFileManager();
      break;
    case 'trash':
      controller.deleteCurrentImage();
      break;
    case 'copy':
      controller.copyToClipboard();
      break;
    case 'prev':
      controller.prevImage();
      break;
    case 'next':
      controller.nextImage();
      break;
    case 'actual_size':
    case 'actual':
      controller.actualSize();
      break;
    case 'fit_window':
    case 'fit':
      controller.fitWindow();
      break;
    case 'zoom_in':
    case 'zoom-in':
      controller.zoomIn();
      break;
    case 'zoom_out':
    case 'zoom-out':
      controller.zoomOut();
      break;
    case 'rotate_left':
    case 'rotate-left':
      controller.rotateLeft();
      break;
    case 'rotate_right':
    case 'rotate-right':
      controller.rotateRight();
      break;
    case 'flip_h':
    case 'flip-h':
      controller.flipH();
      break;
    case 'toggle_filmstrip':
    case 'filmstrip':
      controller.toggleFilmstrip();
      break;
    case 'toggle_exif':
    case 'exif':
      controller.toggleExif();
      break;
    case 'slideshow':
      controller.toggleSlideshow();
      break;
    case 'fullscreen':
      controller.toggleFullscreen();
      break;
    case 'maximize':
      invoke('toggle_maximize_window').catch(() => {});
      break;
    case 'settings':
      if (settingsModal) settingsModal.open();
      break;
    case 'help':
      if (uiToolbar) uiToolbar.showHelpModal();
      break;
    default:
      contextMenu.handleAction(action);
      break;
  }
}

// Lock page-level scroll to ensure the topbar never gets pushed off-screen
window.addEventListener('scroll', () => {
  if (window.scrollX !== 0 || window.scrollY !== 0) {
    window.scrollTo(0, 0);
  }
});

// Apply initial user preferences
canvasView.setTheme(settingsManager.get('backgroundTheme'));
slideshow.setIntervalDuration(settingsManager.get('slideshowInterval'));
const initialFilmstripMode = settingsManager.get('filmstripMode') || (settingsManager.get('showFilmstripByDefault') ? 'always' : 'hover');
if (initialFilmstripMode === 'always') {
  filmstrip.show();
}

// 10. Drag & drop support
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    const file = files[0];
    const targetPath = file.path || file.name;
    if (targetPath) {
      await controller.openTarget(targetPath);
    }
  }
});

// Listen to Tauri 2 native drag drop event
(async () => {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const appWindow = getCurrentWebviewWindow();
    await appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type === 'drop') {
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          await controller.openTarget(paths[0]);
        }
      }
    });
  } catch (err) {
    // Non-tauri fallback
  }
})();

// 10. Check startup arguments (Command line or Open With)
(async () => {
  try {
    const cliTarget = await invoke('get_cli_target');
    if (cliTarget) {
      await controller.openTarget(cliTarget);
      return;
    }
  } catch (e) {
    // Continue with empty state
  }

  // Initial state is empty
  controller.notifyState();
})();
