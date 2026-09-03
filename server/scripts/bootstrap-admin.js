import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import readline from 'node:readline'
import { bootstrapAdmin, MIN_PASSWORD_LENGTH } from '../src/services/bootstrapAdmin.js'

// 一次 raw-mode session 問完所有提示。分成兩次 setRawMode/pause 會讓 readline 的
// keypress 消費者在兩個提示之間吃掉並丟棄已緩衝的輸入（貼上或導管輸入時就會卡住）。
function promptHiddenSequence(prompts) {
  return new Promise((resolve, reject) => {
    const answers = []
    let current = ''
    const wasRaw = process.stdin.isRaw
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdout.write(prompts[0])

    function finish(error, result) {
      process.stdin.off('keypress', onKeypress)
      process.stdin.setRawMode(Boolean(wasRaw))
      process.stdin.pause()
      if (error) reject(error)
      else resolve(result)
    }

    function onKeypress(character, key) {
      if (key?.ctrl && key.name === 'c') {
        process.stdout.write('\n')
        return finish(new Error('Bootstrap cancelled'))
      }
      if (key?.name === 'return' || key?.name === 'enter') {
        answers.push(current)
        current = ''
        process.stdout.write('\n')
        if (answers.length === prompts.length) return finish(null, answers)
        process.stdout.write(prompts[answers.length])
        return
      }
      if (key?.name === 'backspace') {
        current = current.slice(0, -1)
        return
      }
      if (character && !key?.ctrl && !key?.meta) current += character
    }

    process.stdin.on('keypress', onKeypress)
  })
}

async function readHiddenPassword() {
  if (process.env.BOOTSTRAP_ADMIN_PASSWORD) return process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!process.stdin.isTTY) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD is required when no interactive terminal is available')
  }

  // 密碼不回顯，打錯又無法重跑 bootstrap（會被既有管理員擋下），所以一定要覆誦一次。
  const [password, confirmation] = await promptHiddenSequence([
    `Administrator password (minimum ${MIN_PASSWORD_LENGTH} characters): `,
    'Confirm administrator password: ',
  ])
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  if (password !== confirmation) throw new Error('Passwords do not match')
  return password
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exitCode = 1
} else {
  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  try {
    const password = await readHiddenPassword()
    const result = await bootstrapAdmin(prisma, {
      companyName: process.env.BOOTSTRAP_COMPANY_NAME,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
      password,
    }, (password) => bcrypt.hash(password, 12))

    if (result.created) {
      console.log(`Created administrator ${result.email} (company ${result.companyId})`)
    } else {
      console.log(`Administrator ${result.email} is already bootstrapped; no changes made`)
    }
  } catch (error) {
    console.error(`Bootstrap failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
