#!/usr/bin/env node
/**
 * 產生第三方套件授權報告（third-party license report / 簡易 SBOM）。
 *
 *   node scripts/license-report.mjs            # 輸出 Markdown 到 stdout
 *   node scripts/license-report.mjs --json     # 輸出 JSON
 *   node scripts/license-report.mjs --check    # 只做相容性檢查，發現問題時 exit 1
 *
 * 資料來源是已安裝的 node_modules（需先 npm ci），逐一讀取各套件的
 * package.json。只列出 production 相依，devDependencies 不隨發布散布。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const WORKSPACES = ['client', 'server', 'admin']

// 與 Apache-2.0 散布相容的常見授權。不在清單內的一律標為需人工確認，
// 而不是自動放行——授權相容性是法律判斷，不該由字串比對決定。
const KNOWN_COMPATIBLE = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0',
  'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Python-2.0', 'MIT-0',
  // X11 與 MIT 條款相同，是同一份授權的舊稱
  'MIT/X11', 'X11',
  // Zlib 為 OSI 認可的寬鬆授權
  'Zlib',
])
// 需要特別留意的 copyleft／來源開放條款
const NEEDS_REVIEW = new Set([
  'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0',
  'MPL-2.0', 'EPL-2.0', 'SSPL-1.0', 'BUSL-1.1',
])

// 已逐一查證、可接受的例外。key 為 `<name>@<version>`——版本綁定是刻意的：
// 套件升版後必須重新查證，不會被舊的豁免掩蓋。詳見 THIRD-PARTY-LICENSES.md。
const REVIEWED_EXCEPTIONS = new Map([
  ['buffers@0.1.1', '未宣告授權；僅存在於建置期，不隨 admin/dist 或 Docker 映像散布'],
])

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

function normalizeLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license
  if (pkg.license?.type) return pkg.license.type
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ')
  return 'UNKNOWN'
}

// SPDX 運算式拆成個別授權代碼（OR/AND/括號/WITH）
function licenseAtoms(expr) {
  return expr
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+/i)
    .map((part) => part.split(/\s+WITH\s+/i)[0].trim().replace(/^SEE LICENSE.*/i, 'UNKNOWN'))
    .filter(Boolean)
}

function classify(expr) {
  const atoms = licenseAtoms(expr)
  if (!atoms.length || atoms.includes('UNKNOWN')) return 'unknown'
  // OR 運算式只要有一個相容即可視為相容（可擇一採用）
  if (/\sOR\s/i.test(expr) && atoms.some((a) => KNOWN_COMPATIBLE.has(a))) return 'compatible'
  if (atoms.some((a) => NEEDS_REVIEW.has(a))) return 'review'
  if (atoms.every((a) => KNOWN_COMPATIBLE.has(a))) return 'compatible'
  return 'unknown'
}

// 收集所有 production 相依的名稱（含遞移）
function collectProdDeps() {
  const wanted = new Set()
  const queue = []
  for (const ws of WORKSPACES) {
    const pkg = readJson(join(ROOT, ws, 'package.json'))
    if (!pkg) continue
    for (const name of Object.keys(pkg.dependencies ?? {})) queue.push(name)
  }
  while (queue.length) {
    const name = queue.pop()
    if (wanted.has(name)) continue
    const pkg = findPackage(name)
    if (!pkg) continue
    wanted.add(name)
    for (const dep of Object.keys(pkg.json.dependencies ?? {})) queue.push(dep)
  }
  return wanted
}

// 依 node_modules 解析順序找套件（root hoisted 優先，再找各 workspace）
function findPackage(name) {
  const candidates = [
    join(ROOT, 'node_modules', name, 'package.json'),
    ...WORKSPACES.map((ws) => join(ROOT, ws, 'node_modules', name, 'package.json')),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const json = readJson(path)
    if (json) return { json, dir: dirname(path) }
  }
  return null
}

function licenseFileName(dir) {
  try {
    return readdirSync(dir).find((f) => /^(LICEN[CS]E|COPYING)/i.test(f)) ?? null
  } catch { return null }
}

const entries = []
for (const name of [...collectProdDeps()].sort()) {
  const found = findPackage(name)
  if (!found) {
    entries.push({ name, version: null, license: 'UNKNOWN', status: 'unknown', licenseFile: null })
    continue
  }
  const license = normalizeLicense(found.json)
  entries.push({
    name,
    version: found.json.version ?? null,
    license,
    status: classify(license),
    licenseFile: licenseFileName(found.dir),
    repository: typeof found.json.repository === 'string'
      ? found.json.repository
      : found.json.repository?.url ?? null,
  })
}

for (const e of entries) {
  const note = REVIEWED_EXCEPTIONS.get(`${e.name}@${e.version}`)
  if (note && e.status !== 'compatible') {
    e.status = 'reviewed-exception'
    e.note = note
  }
}

const flagged = entries.filter((e) => e.status !== 'compatible' && e.status !== 'reviewed-exception')
const exceptions = entries.filter((e) => e.status === 'reviewed-exception')

if (process.argv.includes('--check')) {
  if (flagged.length) {
    console.error(`發現 ${flagged.length} 個未查證的套件授權：`)
    for (const e of flagged) console.error(`  ${e.name}@${e.version ?? '?'} — ${e.license} (${e.status})`)
    console.error('\n請查證後更新 THIRD-PARTY-LICENSES.md，並視情況加入 REVIEWED_EXCEPTIONS。')
    process.exit(1)
  }
  console.log(`${entries.length} 個 production 相依授權檢查通過`
    + (exceptions.length ? `（含 ${exceptions.length} 個已查證例外）。` : '。'))
  process.exit(0)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    project: 'clocdot',
    projectLicense: 'Apache-2.0',
    productionDependencyCount: entries.length,
    dependencies: entries,
  }, null, 2))
  process.exit(0)
}

const counts = entries.reduce((acc, e) => {
  acc[e.license] = (acc[e.license] ?? 0) + 1
  return acc
}, {})

console.log('# 第三方套件授權報告\n')
console.log(`產生時間：${new Date().toISOString()}`)
console.log(`本專案授權：Apache-2.0`)
console.log(`Production 相依套件數（含遞移）：${entries.length}\n`)
console.log('## 授權分佈\n')
console.log('| 授權 | 套件數 |')
console.log('|---|---:|')
for (const [license, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`| ${license} | ${count} |`)
}
if (exceptions.length) {
  console.log(`\n## 已查證例外\n`)
  console.log('| 套件 | 版本 | 授權 | 查證結論 |')
  console.log('|---|---|---|---|')
  for (const e of exceptions) {
    console.log(`| ${e.name} | ${e.version ?? '?'} | ${e.license} | ${e.note} |`)
  }
}
console.log(`\n## 需人工確認\n`)
if (!flagged.length) {
  console.log('無。其餘 production 相依的授權皆屬已知與 Apache-2.0 散布相容的清單。\n')
} else {
  console.log('| 套件 | 版本 | 授權 | 狀態 |')
  console.log('|---|---|---|---|')
  for (const e of flagged) {
    console.log(`| ${e.name} | ${e.version ?? '?'} | ${e.license} | ${e.status} |`)
  }
  console.log('')
}
console.log('## 完整清單\n')
console.log('| 套件 | 版本 | 授權 | 授權檔 |')
console.log('|---|---|---|---|')
for (const e of entries) {
  console.log(`| ${e.name} | ${e.version ?? '?'} | ${e.license} | ${e.licenseFile ?? '—'} |`)
}
