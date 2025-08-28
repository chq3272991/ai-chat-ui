import type { ChatRequestBody } from '@/types'


export async function streamChat(
    body: ChatRequestBody,
    {
        onToken,
        onDone,
        onError,
        signal,
    }: {
        onToken: (chunk: string) => void
        onDone?: () => void
        onError?: (e: any) => void
        signal?: AbortSignal
    }
) {
    try {
        const resp = await fetch('/api/vector/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify(body),
            signal,
        })


        if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)


        const reader = resp.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''


        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })


            const parts = buffer.split('\n')
            buffer = parts.pop() || ''
            for (const part of parts) {
                const s = part.trim()
                if (!s) continue
                try {
                    const json = JSON.parse(s)
                    const token = json.token ?? json.content ?? json.delta ?? ''
                    if (token) onToken(token)
                } catch {
                    onToken(s)
                }
            }
        }


        const tail = buffer.trim()
        if (tail) onToken(tail)
        onDone && onDone()
    } catch (e) {
        onError && onError(e)
    }
}