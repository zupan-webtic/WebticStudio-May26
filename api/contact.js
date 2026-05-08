import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { name, email, company, budget, driver, message } = req.body

  if (!name || !email || !company || !budget || !driver) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const driverLabels = {
    raise: 'Upcoming raise',
    launch: 'Product launch',
    outgrown: 'Outgrown current look',
    market: 'New market or audience',
    unsure: 'Not sure yet',
  }

  try {
    await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: 'matic@webtic.si',
      replyTo: email,
      subject: `New inquiry from ${name} — ${company}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Budget:</strong> ${budget}</p>
        <p><strong>Driver:</strong> ${driverLabels[driver] ?? driver}</p>
        ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
      `,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Failed to send email' })
  }
}
