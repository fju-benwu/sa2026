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

// Replace paths in HTML files to ensure /sa2026 prefix for GitHub Pages
const basePath = '/sa2026'

function fixPathsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    const original = content
    
    // Replace all /_next/ with /sa2026/_next/
    content = content.replace(/\/_next\//g, basePath + '/_next/')
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8')
    }
  } catch (err) {
    // silently skip non-text files
  }
}

function walkAndReplace(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkAndReplace(fullPath)
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
      fixPathsInFile(fullPath)
    }
  }
}

walkAndReplace(outDir)

console.log('Export collected into:', outDir)
