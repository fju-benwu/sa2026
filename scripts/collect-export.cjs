const fs = require('fs')
const path = require('path')

const root = process.cwd()
const nextServerDir = path.join(root, '.next', 'server')
const outDir = path.join(root, 'out')
const basePath = '/sa2026'

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

// Replace paths in HTML files to use basePath for GitHub Pages deployment
function fixPathsInHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  // Replace /_next/ with basePath/_next/ in all paths
  const fixed = content.replace(/\/_next\//g, basePath + '/_next/')
  // Also replace /test-list href for router links
  const fixed2 = fixed.replace(/href="\/test-list/g, `href="${basePath}/test-list`)
  if (fixed2 !== content) {
    fs.writeFileSync(filePath, fixed2)
  }
}

// Walk through all HTML files in out/ and fix paths
function walkAndFixPaths(dir) {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir)
  for (const entry of entries) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      walkAndFixPaths(fullPath)
    } else if (entry.endsWith('.html')) {
      fixPathsInHtml(fullPath)
    }
  }
}

walkAndFixPaths(outDir)

console.log('Export collected into:', outDir)
