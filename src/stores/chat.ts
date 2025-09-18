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
            this.messages.push({
                role: 'assistant',
                content: '',
                thinkOpen: false, // 默认不展开
                thinkTime: 0, // 默认耗时 0
                thinkLoading: false, // 默认未加载
            })
        },

        // 新增：切换指定消息的思考内容展开/收起状态
        toggleMessageThink(messageIndex: number) {
            if (messageIndex < 0 || messageIndex >= this.messages.length) return;
            const targetMsg = this.messages[messageIndex];
            // 仅处理助手消息
            if (targetMsg.role === 'assistant') {
                targetMsg.thinkOpen = !targetMsg.thinkOpen;
            }
        },

        // 新增：更新指定消息的思考状态（加载中/耗时）
        updateMessageThinkState(
            messageIndex: number,
            state: Partial<{ thinkLoading: boolean; thinkTime: number }>
        ) {
            if (messageIndex < 0 || messageIndex >= this.messages.length) return;
            const targetMsg = this.messages[messageIndex];
            if (targetMsg.role === 'assistant') {
                Object.assign(targetMsg, state); // 批量更新状态
            }
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

            const start = Date.now(); // 记录开始时间（用于计算耗时）
            try {
                await streamChat(body, {
                    signal: this.controller.signal,
                    onToken: (chunk) => this.updateLastAssistantContent(chunk),
                    onDone: () => {
                        onAssistantDone?.(aiIndex)
                        // 关键：完成后更新思考状态（停止加载 + 计算耗时）
                        const thinkTime = Math.max(0, Math.round((Date.now() - start) / 1000));
                        this.updateMessageThinkState(aiIndex, { thinkLoading: false, thinkTime });
                    },
                    onError: (e) => {
                        // 用户主动中断，不当作错误
                        if (e?.name === 'AbortError' || String(e).includes('aborted')) {
                            return
                        }
                        this.error = e?.message || String(e)
                        onError?.(e)
                        // 错误时也需要停止加载状态
                        this.updateMessageThinkState(aiIndex, { thinkLoading: false });
                    },
                })
            } catch (e: any) {
                // 兜底异常处理
                if (e?.name !== 'AbortError' && !String(e).includes('aborted')) {
                    this.error = e?.message || String(e)
                    onError?.(e)
                    this.updateMessageThinkState(aiIndex, { thinkLoading: false });
                }
            } finally {
                // ✅ 无论成功/失败/中断，最后都复原状态
                this.sending = false
                this.controller = null
            }
        },

        // 改造：stop 方法中同步停止思考加载状态
        stop(hooks?: { onStopped?: () => void }) {
            if (this.controller) {
                this.controller.abort()
            }
            // 找到最后一条助手消息，停止其加载状态
            const lastAssistantIndex = this.messages.findLastIndex(
                msg => msg.role === 'assistant'
            );
            if (lastAssistantIndex !== -1) {
                this.updateMessageThinkState(lastAssistantIndex, { thinkLoading: false });
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

        // 改造：prependMessage 时为助手消息添加思考状态默认值
        prependMessage(m: {
            role: string  // "user" | "assistant" | "system" | 'tool'
            content: string
            images?: string[]
            files?: { name: string; type: string; dataUrl: string }[]
            thinkTime?: number; // 新增：支持从历史消息中读取思考耗时
        }) {
            let newMessage: ChatMessage

            if (m.role === "user") {
                newMessage = {
                    role: "user",
                    content: m.content,
                    images: m.images ?? [],
                    files: m.files ?? []
                }
            } else if (m.role === "assistant") {
                // assistant 消息，保持和 appendMessage 一致的处理逻辑
                newMessage = {
                    role: "assistant",
                    content: m.content,
                    images: m.images ?? [],
                    files: m.files ?? [],
                    thinkOpen: false,
                    thinkTime: m.thinkTime ?? 0, // 从历史消息中获取耗时（如后端返回）
                    thinkLoading: false
                }
            } else {
                // 其他角色（system/tool）无需思考状态
                newMessage = {
                    role: m.role as any,
                    content: m.content,
                    images: m.images ?? [],
                    files: m.files ?? []
                };
            }

            // 插到 messages 最前面
            this.messages = [newMessage, ...this.messages]
        }

    }
})
