import fp from 'fastify-plugin'
import { Resend } from 'resend'

export default fp(async function mailerPlugin(fastify) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFY_FROM
  const to = process.env.NOTIFY_TO

  if (!apiKey || !from || !to) {
    fastify.log.warn('mailer disabled: RESEND_API_KEY / NOTIFY_FROM / NOTIFY_TO not all set')
  }

  const resend = apiKey ? new Resend(apiKey) : null

  fastify.decorate('mailer', {
    enabled: Boolean(resend && from && to),
    notifyTo: to,
    async send({ subject, text, replyTo }) {
      if (!resend || !from || !to) return { skipped: true }
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        text,
        replyTo,
      })
      if (error) throw new Error(error.message || 'resend failed')
      return data
    },
  })
})
