import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'

// Politique de sécurité stricte, ajoutée seulement au build (le serveur de dev a besoin de scripts en ligne).
// connect-src 'self' : le navigateur refusera toute requête vers un autre domaine.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspPlugin = (): Plugin => ({
  name: 'csp-build-only',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ : le workflow fournit BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // enregistré à la main dans src/main.tsx
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Budget',
        short_name: 'Budget',
        description: 'Mon budget personnel, 100 % privé, stocké sur mon iPhone.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F2F4F7',
        theme_color: '#F2F4F7',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
