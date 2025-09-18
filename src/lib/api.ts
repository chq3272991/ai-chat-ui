import type { ChatRequestBody } from '@/types'

// 模块作用域变量，页面未刷新前一直保持
let fixedConversationId: string | null = null

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

function getConversationId() {
    // ✅ 如果已有，就直接复用，不要每次生成
    if (fixedConversationId) return fixedConversationId

    if (crypto.randomUUID) {
        fixedConversationId = crypto.randomUUID()
    } else {
        fixedConversationId = generateUUID()
    }
    return fixedConversationId
}

/**
 * 手动重置 conversationId
 */
export function resetConversationId() {
    //console.log("清理fixedConversationId：" + fixedConversationId)
    fixedConversationId = null
}

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
        // 如果需要在请求中传 conversationId
        if (body.conversationId == "" || body.conversationId == undefined) {
            const conversationId = getConversationId()
            body.conversationId = conversationId
        }

        // === 新增：只保留每个角色的最新一条消息 ===
        const latest: Record<string, typeof body.messages[0]> = {}
        for (let i = body.messages.length - 1; i >= 0; i--) {
            const msg = body.messages[i]
            // 判断 role 是否需要处理
            if (!['user', 'assistant', 'system'].includes(msg.role)) continue
            // 仅当该角色还没有被记录，并且内容非空时才记录
            const content = msg.content ?? ''
            if (!latest[msg.role] && content.trim() !== '') {
                latest[msg.role] = msg
            }
        }
        body.messages = ['system', 'user', 'assistant']
            .map(role => latest[role])
            .filter(Boolean)

        const token = localStorage.getItem("token");

        // === 原来的请求逻辑 ===
        const resp = await fetch('/api/vector/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'Authorization': `Bearer ${token}` },
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
