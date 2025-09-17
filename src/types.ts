export type Role = 'user' | 'assistant' | 'system' | 'tool'


export interface ChatMessage {
    role: Role
    content: string
    images?: string[]
    files?: {
        name: string
        type: string
        dataUrl: string
    }[]
}


export interface ChatOptions {
    temperature?: number
    top_p?: number
    max_tokens?: number
}


export interface ChatRequestBody {
    model: string
    messages: ChatMessage[]
    options?: ChatOptions
    stream?: boolean
    conversationId: string
    internet: boolean
    local: boolean
}