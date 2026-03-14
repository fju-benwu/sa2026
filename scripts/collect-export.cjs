const fs = require('fs')
const path = require('path')

const root = process.cwd()
const nextServerDir = path.join(root, '.next', 'server')
const outDir = path.join(root, 'out')

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    ensureDir(dest)
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    copyFile(src, dest)
  }
}

// Copy static assets to out/_next/static
const staticSrc = path.join(root, '.next', 'static')
const staticDest = path.join(outDir, '_next', 'static')
copyRecursive(staticSrc, staticDest)

// Copy server app HTML files
const appHtmlDir = path.join(nextServerDir, 'app')
if (fs.existsSync(appHtmlDir)) {
  for (const f of fs.readdirSync(appHtmlDir)) {
    if (f.endsWith('.html')) {
      const src = path.join(appHtmlDir, f)
      const name = f === 'index.html' ? 'index.html' : path.join(f.replace(/\.html$/, ''), 'index.html')
      copyFile(src, path.join(outDir, name))
    }
  }
}

// Copy pages HTML (404, 500)
const pagesHtmlDir = path.join(nextServerDir, 'pages')
if (fs.existsSync(pagesHtmlDir)) {
  for (const f of fs.readdirSync(pagesHtmlDir)) {
    if (f.endsWith('.html')) {
      copyFile(path.join(pagesHtmlDir, f), path.join(outDir, f))
    }
  }
}

// Add .nojekyll to ensure GitHub Pages serves files starting with _
fs.writeFileSync(path.join(outDir, '.nojekyll'), '')

// FIX PATHS FOR GITHUB PAGES /sa2026 SUBPATH
const basePath = '/sa2026'
let filesUpdated = 0

function updateAllPaths(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    
    if (entry.isDirectory()) {
      updateAllPaths(fullPath)
    } else if (entry.isFile()) {
      try {
        // Read file (assume utf8)
        let content = fs.readFileSync(fullPath, 'utf8')
        let updated = false
        
        // Replace all /_next/ with /sa2026/_next/
        if (content.includes('/_next/')) {
          content = content.replace(/\/_next\//g, '/sa2026/_next/')
          updated = true
        }
        
        // Replace href="/test-list with href="/sa2026/test-list
        if (content.includes('href="/test-list')) {
          content = content.replace(/href="\/test-list/g, 'href="/sa2026/test-list')
          updated = true
        }
        
        if (updated) {
          fs.writeFileSync(fullPath, content, 'utf8')
          filesUpdated++
        }
      } catch (err) {
        // Skip binary files
      }
    }
  }
}

updateAllPaths(outDir)
console.log(`Updated ${filesUpdated} files with /sa2026 prefix for GitHub Pages`)
console.log('Export collected into:', outDir)
