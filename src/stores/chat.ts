import { defineStore } from 'pinia'
import type { ChatMessage, ChatRequestBody, ChatOptions } from '@/types'
import { streamChat } from '@/lib/api'

const DEFAULT_MODEL = "qwen3:4b"

export const useChatStore = defineStore('chat', {
    state: () => ({
        model: DEFAULT_MODEL,
        options: { temperature: 0.7, top_p: 0.9, max_tokens: 200 } as ChatOptions,
        messages: [] as ChatMessage[],
        sending: false,
        controller: null as AbortController | null,
        error: '' as string,
    }),
    actions: {
        appendUserMessage(content: string, images: string[] = [], files: { name: string; type: string; dataUrl: string; }[] = []) {
            this.messages.push({ role: 'user', content, images, files })
        },
        appendAssistantMessagePlaceholder() {
            this.messages.push({ role: 'assistant', content: '' })
        },
        updateLastAssistantContent(delta: string) {
            let piece = "";  // ← 这里声明

            try {
                // 去掉 SSE 前缀
                let jsonStr = delta.trim();
                if (jsonStr.startsWith("data:")) {
                    jsonStr = jsonStr.substring(5).trim();
                }

                // 解析 JSON
                const obj = JSON.parse(jsonStr);
                piece =
                    obj?.result?.output?.text ||
                    obj?.results?.[0]?.output?.text ||
                    "";
            } catch {
                // 如果不是合法 JSON，就直接当作普通字符串
                piece = delta;
            }

            // 把片段拼接到最后一个 assistant 消息
            for (let i = this.messages.length - 1; i >= 0; i--) {
                if (this.messages[i].role === "assistant") {
                    this.messages[i].content += piece;
                    break;
                }
            }
        },
        // ⬇️ 新增 hooks 参数
        async send(hooks?: {
            onAssistantStart?: (aiIndex: number) => void
            onAssistantDone?: (aiIndex: number) => void
            onError?: (e: any) => void
        }) {
            if (this.sending) return
            this.error = ''
            this.sending = true
            this.controller = new AbortController()

            const body: ChatRequestBody = {
                model: this.model,
                messages: this.messages,
                options: this.options,
                stream: true,
            }

            this.appendAssistantMessagePlaceholder()
            const aiIndex = this.messages.length - 1
            hooks?.onAssistantStart?.(aiIndex)   // ⬅️ 告知外层：助手消息开始了

            await streamChat(body, {
                signal: this.controller.signal,
                onToken: (chunk) => this.updateLastAssistantContent(chunk),
                onDone: () => {
                    this.sending = false
                    this.controller = null
                    hooks?.onAssistantDone?.(aiIndex) // ⬅️ 告知外层：助手消息结束
                },
                onError: (e) => {
                    this.sending = false
                    this.controller = null
                    this.error = e?.message || String(e)
                    hooks?.onError?.(e)
                },
            })
        },
        stop() {
            this.controller?.abort()
            this.sending = false
            this.controller = null
        },
        clear() {
            this.messages = []
            this.error = ''
        }
    }
})