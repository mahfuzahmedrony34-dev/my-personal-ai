import type { VercelRequest, VercelResponse } from '@vercel/node'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Use POST to send a chat message.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  if (!apiKey) {
    return res.status(503).json({ message: 'Gemini is not configured. Add GEMINI_API_KEY in Vercel Environment Variables, then redeploy.' })
  }

  let body: any
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ message: 'Invalid JSON request.' })
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length || messages.length > 20 || messages.some((m: any) =>
    !['user', 'assistant'].includes(m?.role) || typeof m?.content !== 'string' || !m.content.trim()
  )) {
    return res.status(400).json({ message: 'Please send a valid chat message history.' })
  }

  const wantsSearch = body?.webSearch === true
  const contents = messages.map((m: ChatMessage) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content.slice(0, 18000) }],
  }))

  try {
    const requestBody: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: 'You are Orbit, a helpful personal AI assistant. Be clear, practical, and concise. Help with study planning, task organization, and explaining documents. Never claim you performed an action unless a connected tool actually did it. If the user asks for current facts and web search is not enabled, explain that live search is not enabled for this request.' }],
      },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 1400 },
    }

    if (wantsSearch) requestBody.tools = [{ google_search: {} }]

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(requestBody),
      },
    )

    const data: any = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      console.error('Gemini API returned an error:', upstream.status, data?.error?.status || '')
      return res.status(502).json({
        message: upstream.status === 401 || upstream.status === 403
          ? 'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel.'
          : upstream.status === 429
            ? 'Gemini rate limit or quota reached. Check your Google AI Studio usage and billing.'
            : 'Gemini could not complete the request. Check the model name and API access.',
      })
    }

    const parts = data?.candidates?.[0]?.content?.parts
    const reply = Array.isArray(parts)
      ? parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n')
      : ''
    if (!reply.trim()) return res.status(502).json({ message: 'Gemini returned an empty reply. Please try again.' })

    const grounding = data?.candidates?.[0]?.groundingMetadata
    const sources = Array.isArray(grounding?.groundingChunks)
      ? grounding.groundingChunks.map((chunk: any) => ({
          title: chunk?.web?.title || '',
          uri: chunk?.web?.uri || '',
        })).filter((source: any) => source.uri).slice(0, 8)
      : []

    return res.status(200).json({ reply, sources })
  } catch (error) {
    console.error('Gemini request failed:', error)
    return res.status(502).json({ message: 'Could not connect to Gemini. Check the network and try again.' })
  }
}
