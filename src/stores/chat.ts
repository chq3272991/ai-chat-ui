import { defineStore } from 'pinia'
import type { ChatMessage, ChatRequestBody, ChatOptions } from '@/types'
import { streamChat, resetConversationId } from '@/lib/api'
import { parseText } from '@/lib/parser'

const DEFAULT_MODEL = "deepseek-r1:8b"

export const useChatStore = defineStore('chat', {
    state: () => ({
        model: DEFAULT_MODEL,
        options: { temperature: 0.7, top_p: 0.9, max_tokens: 20000 } as ChatOptions,
        conversationId: '' as string,
        messages: [] as ChatMessage[],
        sending: false,
        controller: null as AbortController | null,
        error: '' as string,
    }),
    actions: {
        appendUserMessage(
            content: string,
            images: string[] = [],
            files: { name: string; type: string; dataUrl: string }[] = []
        ) {
            this.messages.push({ role: 'user', content, images, files })
        },

        appendAssistantMessagePlaceholder() {
            this.messages.push({ role: 'assistant', content: '' })
        },

        updateLastAssistantContent(delta: string) {
            let piece = ""

            try {
                let jsonStr = delta.trim()
                if (jsonStr.startsWith("data:")) {
                    jsonStr = jsonStr.substring(5).trim()
                }
                const obj = JSON.parse(jsonStr)
                piece =
                    obj?.result?.output?.text ||
                    obj?.results?.[0]?.output?.text ||
                    ""
            } catch {
                piece = delta
            }

            for (let i = this.messages.length - 1; i >= 0; i--) {
                if (this.messages[i].role === "assistant") {
                    this.messages[i].content += piece
                    break
                }
            }
        },

        async send(hooks?: {
            opts?: {
                internet?: boolean
                local?: boolean
                conversationId?: string
            },
            onAssistantStart?: (aiIndex: number) => void
            onAssistantDone?: (aiIndex: number) => void
            onError?: (e: any) => void
            onStopped?: () => void
        }) {
            if (this.sending) return

            this.error = ''
            this.sending = true
            this.controller = new AbortController()

            // ✅ 从 hooks 解构出 opts 和回调
            const { opts, onAssistantStart, onAssistantDone, onError, onStopped } = hooks ?? {}

            const body: ChatRequestBody = {
                model: this.model,
                conversationId: opts?.conversationId ?? this.conversationId,
                messages: this.messages,
                options: this.options,
                stream: true,
                internet: opts?.internet ?? false,
                local: opts?.local ?? true
            }

            this.appendAssistantMessagePlaceholder()
            const aiIndex = this.messages.length - 1
            onAssistantStart?.(aiIndex)

            try {
                await streamChat(body, {
                    signal: this.controller.signal,
                    onToken: (chunk) => this.updateLastAssistantContent(chunk),
                    onDone: () => {
                        onAssistantDone?.(aiIndex)
                    },
                    onError: (e) => {
                        // 用户主动中断，不当作错误
                        if (e?.name === 'AbortError' || String(e).includes('aborted')) {
                            return
                        }
                        this.error = e?.message || String(e)
                        onError?.(e)
                    },
                })
            } catch (e: any) {
                // 兜底异常处理
                if (e?.name !== 'AbortError' && !String(e).includes('aborted')) {
                    this.error = e?.message || String(e)
                    onError?.(e)
                }
            } finally {
                // ✅ 无论成功/失败/中断，最后都复原状态
                this.sending = false
                this.controller = null
            }
        },

        stop(hooks?: { onStopped?: () => void }) {
            if (this.controller) {
                this.controller.abort()
            }
            // ✅ 双保险：立即复原状态
            this.sending = false
            this.controller = null
            hooks?.onStopped?.()
        },

        clear() {
            this.messages = []
            this.error = ''
            resetConversationId()
        },

        appendMessage(
            role: "user" | "assistant" | "system" | 'tool',
            content: string,
            images: string[] = [],
            files: { name: string; type: string; dataUrl: string }[] = []
        ) {
            if (role === "user") {
                this.appendUserMessage(content, images, files);
            } else if (role === "assistant") {
                // 插入占位消息
                this.appendAssistantMessagePlaceholder();
                const aiIndex = this.messages.length - 1;
                this.updateLastAssistantContent(content);
            }
        },
        prependMessage(m: {
            role: string  // "user" | "assistant" | "system" | 'tool'
            content: string
            images?: string[]
            files?: { name: string; type: string; dataUrl: string }[]
        }) {
            let newMessage: ChatMessage

            if (m.role === "user") {
                newMessage = {
                    role: "user",
                    content: m.content,
                    images: m.images ?? [],
                    files: m.files ?? []
                }
            } else {
                // assistant 消息，保持和 appendMessage 一致的处理逻辑
                newMessage = {
                    role: "assistant",
                    content: m.content,
                    images: m.images ?? [],
                    files: m.files ?? []
                }
            }

            // 插到 messages 最前面
            this.messages = [newMessage, ...this.messages]
        }

    }
})
