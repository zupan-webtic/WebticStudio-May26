import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:             resolve(__dirname, 'index.html'),
        about:            resolve(__dirname, 'about.html'),
        work:             resolve(__dirname, 'work.html'),
        privacy:          resolve(__dirname, 'privacy.html'),
        terms:            resolve(__dirname, 'terms.html'),
        contact:          resolve(__dirname, 'contact/index.html'),
        workEvolt:        resolve(__dirname, 'work/evolt/index.html'),
        workNaka:         resolve(__dirname, 'work/naka/index.html'),
        programsRefresh:  resolve(__dirname, 'programs/refresh/index.html'),
        programsReframe:  resolve(__dirname, 'programs/reframe/index.html'),
        programsCreation: resolve(__dirname, 'programs/creation/index.html'),
        programsSprint:   resolve(__dirname, 'programs/sprint/index.html'),
      }
    }
  }
})
