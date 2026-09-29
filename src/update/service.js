import { invoke } from '@tauri-apps/api/core';

export class UpdateService {
  constructor(config) {
    this.config = config;
  }

  get enabled() {
    return Number(this.config.productId) > 0;
  }

  commandConfig() {
    return {
      productId: Number(this.config.productId),
      baseUrl: this.config.apiBaseUrl,
      channel: this.config.channel || 'stable',
    };
  }

  check(installationId) {
    return invoke('product_update_check', {
      config: this.commandConfig(),
      installationId,
    });
  }

  download(release) {
    return invoke('product_update_download', { release });
  }
}
