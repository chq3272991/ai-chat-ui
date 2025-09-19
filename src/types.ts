export type Role = 'user' | 'assistant' | 'system' | 'tool'


export interface ChatMessage {
    role: string;
    content: string;
    images?: string[];
    files?: {
        name: string
        type: string
        dataUrl: string
    }[];

    // 新增：思考状态相关属性（默认值确保使用时无需手动初始化）
    thinkOpen?: boolean; // 是否展开思考内容
    thinkTime?: number; // 思考耗时（秒）
    thinkLoading?: boolean; // 是否正在思考中
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

// @/types/index.ts
export interface Conversation {
    id: string;
    title: string | undefined; // 明确标题可能为undefined
    model: string;
    createTime?: string;
}