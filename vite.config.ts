import { defineConfig, loadEnv, type Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import aurelia from '@aurelia/vite-plugin';
// import { translationTypeGeneratorPlugin } from './plugins/TranslationTypeGenerator';

/**
 * https://v2.tauri.app/start/frontend/vite/
 */

export default defineConfig((conf) => {
  const env = loadEnv(conf.mode, process.cwd(), '');
  console.log("vite base : " + env.VITE_BASE);

  return {
    base: env.VITE_BASE,
    // build: {
    //   target: 'es2022',
    // },
    esbuild: {
      target: 'es2022'
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
    resolve: {
      alias: {
        src: "/src",
      },
    },
    // prevent vite from obscuring rust errors
    clearScreen: false,
    server: {
      host: true, // listen to all ips in ipconfig
      open: false, //!process.env.CI,
      // make sure this port matches the devUrl port in tauri.conf.json file
      port: 9002,
      // Tauri expects a fixed port, fail if that port is not available
      strictPort: true,
      watch: {
        // tell vite to ignore watching `src-tauri`
        ignored: ['**/src-tauri/**'],
      },
    },
    // Env variables starting with the item of `envPrefix` will be exposed in tauri's source code through `import.meta.env`.
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    // build: {
    //   // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    //   target:
    //     process.env.TAURI_ENV_PLATFORM == 'windows'
    //       ? 'chrome105'
    //       : 'safari13',
    //   // don't minify for debug builds
    //   minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    //   // produce sourcemaps for debug builds
    //   sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // },
    plugins: [
      // translationTypeGeneratorPlugin(),
      aurelia({
        useDev: true,
      }),
      nodePolyfills(),
    ],
  }
});
