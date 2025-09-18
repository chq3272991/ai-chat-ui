// src/lib/parser.ts
// 用来解析消息里的 <think> 标签内容

export function parseText(content: string): {
    thinkText: string
    finalText: string
} {
    if (!content) {
        return { thinkText: "", finalText: "" }
    }

    // 匹配 <think> ... </think>
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
    const thinkText = thinkMatch ? thinkMatch[1].trim() : ""

    // 去掉 <think> 部分，得到展示用的文本
    const finalText = content.replace(/<think>[\s\S]*?<\/think>/, "").trim()

    return { thinkText, finalText }
}

