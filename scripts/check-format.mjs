#!/usr/bin/env node
/**
 * 檢查 git 追蹤中的文字檔是否符合 .editorconfig 的核心規則。
 * 零相依：只用 git 與 node 內建模組。
 *
 *   node scripts/check-format.mjs          # 有問題時 exit 1
 *   node scripts/check-format.mjs --fix    # 就地修正可自動處理的項目
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const FIX = process.argv.includes('--fix')

// 二進位與由工具產生、不該手動格式化的檔案
const SKIP = [
  /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot|pdf|zip|gz)$/i,
  /^package-lock\.json$/,
  /^THIRD-PARTY-LICENSES\.md$/,   // 由 npm run license:report 產生
  /^LICENSE$/,                     // 原文照登，不得改動
]
// 對應 .editorconfig 中放寬的規則
const NO_TRAILING_CHECK = [/\.md$/i, /\.(csv|svg)$/i]
const NO_FINAL_NEWLINE_CHECK = [/\.(csv|svg)$/i]
const TAB_INDENT_OK = [/^Makefile$/, /Caddyfile$/, /\.go$/]

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SKIP.some((re) => re.test(f)))

const problems = []
let fixed = 0

for (const file of files) {
  let raw
  try { raw = readFileSync(file) } catch { continue }
  if (raw.includes(0)) continue // 疑似二進位

  const original = raw.toString('utf8')
  let text = original

  if (text.includes('\r\n')) {
    if (FIX) text = text.replace(/\r\n/g, '\n')
    else problems.push(`${file}: 含 CRLF 換行（.editorconfig 要求 LF）`)
  }

  if (!NO_TRAILING_CHECK.some((re) => re.test(file))) {
    const lines = text.split('\n')
    const bad = lines.reduce((acc, line, i) => (/[ \t]+$/.test(line) ? [...acc, i + 1] : acc), [])
    if (bad.length) {
      if (FIX) text = lines.map((l) => l.replace(/[ \t]+$/, '')).join('\n')
      else problems.push(`${file}: 第 ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ' …' : ''} 行有行尾空白`)
    }
  }

  if (!NO_FINAL_NEWLINE_CHECK.some((re) => re.test(file)) && text.length && !text.endsWith('\n')) {
    if (FIX) text += '\n'
    else problems.push(`${file}: 檔案結尾缺少換行`)
  }

  if (!TAB_INDENT_OK.some((re) => re.test(file))) {
    const tabLines = text.split('\n').reduce(
      (acc, line, i) => (/^\t/.test(line) ? [...acc, i + 1] : acc), [],
    )
    // 縮排用 tab 無法安全自動修正（不知道原意的縮排寬度），一律只回報
    if (tabLines.length) {
      problems.push(`${file}: 第 ${tabLines.slice(0, 5).join(', ')}${tabLines.length > 5 ? ' …' : ''} 行以 tab 縮排（.editorconfig 要求空白）`)
    }
  }

  if (FIX && text !== original) {
    writeFileSync(file, text, 'utf8')
    fixed += 1
  }
}

if (FIX) {
  console.log(`已修正 ${fixed} 個檔案。`)
  process.exit(0)
}

if (problems.length) {
  console.error(`格式檢查未通過（${problems.length} 項）：\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n可執行 \`npm run format:fix\` 自動修正換行與行尾空白。`)
  process.exit(1)
}

console.log(`格式檢查通過（${files.length} 個檔案）。`)
