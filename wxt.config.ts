import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  manifest: ({ mode }) => ({
    name: 'Stylewright',
    // Chrome Web Store caps the manifest description at 132 chars.
    description:
      'Write per-site CSS to restyle any website. Injected only when you click Apply. 100% local — no account, no network, no tracking.',
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
      default_title: 'Stylewright',
    },
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    // Hard guarantee that the extension makes no network requests: `connect-src
    // 'none'` blocks fetch/XHR/WebSocket/beacon from our pages, and `script-src
    // 'self'` blocks any remote or inline code. Production-only so the dev
    // server's HMR websocket keeps working in `npm run dev`.
    ...(mode === 'production'
      ? {
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
          },
        }
      : {}),
  }),
});
