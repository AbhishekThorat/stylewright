import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  manifest: {
    name: 'CSS Overrides',
    description:
      'Write per-site CSS overrides. Your styles are pre-loaded per site and applied only when you click Apply — never automatically.',
    // Minimal permissions: activeTab keeps us off the "all your data" warning.
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel', 'unlimitedStorage'],
    // Specific origins are requested on demand, one site at a time.
    optional_host_permissions: ['*://*/*'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'CSS Overrides',
    },
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
  },
});
