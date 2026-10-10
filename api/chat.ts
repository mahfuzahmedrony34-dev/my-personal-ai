import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Use POST to send a chat message.' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ message: 'Online AI is not configured yet. Add OPENAI_API_KEY in the Vercel project environment variables.' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length || messages.length > 20 || messages.some((m: any) => !['user', 'assistant'].includes(m?.role) || typeof m?.content !== 'string')) {
    return res.status(400).json({ message: 'Please send a valid chat message history.' })
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Orbit, a friendly, helpful personal assistant. Be clear, practical, and concise. The user may be a student and may appreciate simple explanations.' },
          ...messages.map((m: any) => ({ role: m.role, content: m.content.slice(0, 12000) })),
        ],
        max_tokens: 900,
      }),
    })
    const data = await upstream.json()
    if (!upstream.ok) {
      console.error('AI provider returned an error:', upstream.status)
      return res.status(502).json({ message: 'The AI provider could not complete this request. Check the API key, model access, and billing settings.' })
    }
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) return res.status(502).json({ message: 'The AI provider returned an empty reply.' })
    return res.status(200).json({ reply })
  } catch {
    return res.status(502).json({ message: 'Could not reach the AI service. Please try again.' })
  }
}
