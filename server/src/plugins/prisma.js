import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export default fp(async function prismaPlugin(fastify) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({
    adapter,
    // password 預設不進任何查詢結果；需要比對時在單點 opt-in `omit: { password: false }`
    omit: {
      user: { password: true },
    },
  })

  await prisma.$connect()

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})
