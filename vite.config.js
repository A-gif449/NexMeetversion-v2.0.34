// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   build: {
//     rollupOptions: {
//       output: {
//         manualChunks: {
//           'react-core':    ['react', 'react-dom'],
//           'react-router':  ['react-router-dom'],
//           'firebase':      ['firebase/app', 'firebase/auth', 'firebase/firestore'],
//           'framer-motion': ['framer-motion'],
//           'three':         ['three'],
//           'socket-io':     ['socket.io-client'],
//           'lucide':        ['lucide-react'],
//         }
//       }
//     },
//     chunkSizeWarningLimit: 600,
//   }
// })

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Minify with esbuild (default, fastest)
    minify: 'esbuild',

    // Inline tiny assets to save requests
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase — split each service so unused ones aren't loaded
          if (id.includes('firebase/auth'))      return 'firebase-auth'
          if (id.includes('firebase/firestore')) return 'firebase-firestore'
          if (id.includes('firebase/app'))       return 'firebase-core'
          if (id.includes('node_modules/firebase')) return 'firebase-core'

          // Heavy 3rd-party libs — each in own chunk
          if (id.includes('node_modules/three'))          return 'three'
          if (id.includes('node_modules/framer-motion'))  return 'framer-motion'
          if (id.includes('node_modules/socket.io-client')) return 'socket-io'
          if (id.includes('node_modules/lucide-react'))   return 'lucide'

          // React core — always needed, cache forever
          if (id.includes('node_modules/react-dom'))   return 'react-dom'
          if (id.includes('node_modules/react/'))      return 'react-core'
          if (id.includes('node_modules/react-router')) return 'react-router'

          // Everything else in node_modules → vendor chunk
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },

    chunkSizeWarningLimit: 600,
  },

  // Faster dev server
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})