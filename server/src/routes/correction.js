import { dateStrToDate } from '../utils/timezone.js'
import { createApprovalChain } from '../services/approvalEngine.js'
import { body, str } from '../utils/schema.js'

export default async function correctionRoutes(fastify) {
  fastify.addHook('onRequest', fastify.authenticate)

  // POST /api/correction-requests
  fastify.post('/api/correction-requests', {
    schema: { body: body({ workDate: str, time: str, type: str, reason: str }) },
  }, async (request, reply) => {
    const { workDate, time, type, reason } = request.body

    if (!workDate || !time || !type || !reason) {
      return reply.code(400).send({ error: '請填寫完整資料' })
    }

    const dateStart = dateStrToDate(workDate)

    const attendance = await fastify.prisma.attendanceRecord.findUnique({
      where: {
        userId_workDate: {
          userId: request.user.id,
          workDate: dateStart,
        },
      },
      include: { user: { select: { companyId: true } } },
    })

    if (!attendance) {
      return reply.code(404).send({ error: '找不到該日期的考勤紀錄' })
    }

    const correction = await fastify.prisma.correctionRequest.create({
      data: {
        attendanceId: attendance.id,
        reason: `[${type === 'in' ? '上班' : '下班'}] ${time} - ${reason}`,
      },
    })

    await createApprovalChain(fastify.prisma, {
      requestType: 'correction',
      requestId: correction.id,
      submitterId: request.user.id,
      companyId: attendance.user?.companyId ?? request.companyId,
    })

    return correction
  })

  // GET /api/correction-requests
  fastify.get('/api/correction-requests', async (request) => {
    const records = await fastify.prisma.correctionRequest.findMany({
      where: {
        attendance: { userId: request.user.id },
      },
      include: { attendance: true },
      orderBy: { createdAt: 'desc' },
    })

    return records
  })
}
