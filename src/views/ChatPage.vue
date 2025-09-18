<style scoped>
@import "./style/common.css";
@import "./style/chatPage.css";
</style>

<template>
  <!-- 新增：页面总容器（左侧sidebar + 右侧main-content） -->
  <div class="page-container">
    <!-- 左侧 sidebar：新增动态类控制宽度，移除原v-show（避免折叠时整个消失） -->
    <div class="sidebar" :class="{ 'sidebar-collapsed': isHistoryCollapsed }">
      <!-- 折叠按钮：固定在右上角，始终显示 -->
      <button class="collapse-btn" @click="toggleHistoryCollapse">
        {{ isHistoryCollapsed ? "▶" : "◀" }}
      </button>

      <!-- 新建聊天按钮：折叠时只显示图标（+），展开时显示文字 -->
      <button class="new-chat-btn" @click="handleNewChat">
        <span class="new-chat-icon">+</span>
        <span class="new-chat-text" v-show="!isHistoryCollapsed">新建聊天</span>
      </button>

      <!-- 历史聊天列表：折叠时隐藏整个区域 -->
      <div class="history-section" v-show="!isHistoryCollapsed">
        <div class="history-header">
          <h3 class="history-title">历史聊天</h3>
        </div>
        <!-- 历史内容：展开时显示，折叠时随section隐藏 -->
        <!-- 左侧历史聊天列表 -->
        <div class="history-content" @scroll.passive="handleScroll">
          <div v-if="historyLoading && historyList.length === 0" class="history-loading">
            加载历史聊天中...
          </div>
          <div v-else-if="historyList.length === 0" class="history-empty">
            暂无历史聊天记录
          </div>

          <ul class="history-list" v-else>
            <li
              class="history-item"
              :class="{ active: currentHistoryId === item.id }"
              @click="handleSelectHistory(item)"
              v-for="item in historyList"
              :key="item.id"
            >
              {{ item.title || "未命名聊天" }}
            </li>
          </ul>
          <div v-if="historyLoading && historyList.length > 0" class="history-loading">
            加载更多...
          </div>
          <div v-if="!hasMore && historyList.length > 0" class="history-end">
            没有更多了
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：原聊天内容区 -->
    <div class="main-content">
      <div class="container">
        <header>
          <div class="kb-actions">
            <p>模型:</p>
            <select v-model="model">
              <option value="qwen3:4b">qwen3:4b</option>
              <option value="qwen3:8b">qwen3:8b</option>
              <option value="deepseek-r1:8b">deepseek-r1:8b</option>
            </select>
            <button @click="reset" class="kb-btn">重置</button>
          </div>
        </header>

        <!-- 消息展示区 -->
        <main class="messages">
          <div v-for="(m, i) in store.messages" :key="i" class="message">
            <div class="bubble" :name="m.role">
              <!-- think 折叠区域 -->
              <div
                v-if="thinkLoading[i] || parseText(m.content).thinkText || thinkTime[i]"
                class="think-container"
              >
                <button @click="toggleThink(i)">
                  <template v-if="thinkLoading[i]"> > 思考中{{ loadingDots }} </template>
                  <template v-else>
                    > 思考了 {{ thinkTime[i] }} 秒 {{ thinkOpen[i] ? "▲" : "▼" }}
                  </template>
                </button>
                <!-- 思考文本 -->
                <div v-show="thinkOpen[i]" class="think-content">
                  <template
                    v-for="(line, idx) in parseText(m.content).thinkLines"
                    :key="idx"
                  >
                    {{ line }}
                  </template>
                </div>
              </div>

              <!-- 回答正文 -->
              <div
                class="content-container markdown-wrapper"
                v-html="renderNormalMarkdown(parseText(m.content).normalLines)"
              ></div>

              <!-- 图片展示 -->
              <div v-if="m.images?.length" style="margin-top: 5px">
                <img
                  v-for="(src, idx) in m.images"
                  :key="idx"
                  :src="src"
                  style="width: 80px; height: 80px; object-fit: cover; margin-right: 5px"
                />
              </div>

              <!-- 文件展示 -->
              <div v-if="m.files?.length" style="margin-top: 5px">
                <a
                  v-for="(f, idx) in m.files"
                  :key="idx"
                  :href="f.dataUrl"
                  :download="f.name"
                >
                  📎 {{ f.name }}
                </a>
              </div>
            </div>
          </div>
        </main>

        <!-- 底部输入框 -->
        <footer class="input-area">
          <!-- 文件名预览 -->
          <ul v-if="previewNames.length" class="file-names-list">
            <li v-for="(name, index) in previewNames" :key="index" class="file-name-item">
              {{ name }}
              <button type="button" class="delete-btn" @click="removeFile(index)">
                ✕
              </button>
            </li>
          </ul>
          <form
            @submit.prevent="onSubmit"
            style="display: flex; flex-direction: column; height: 100%"
          >
            <textarea v-model="input" placeholder="输入你的问题..."></textarea>
            <div
              style="
                margin-top: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              "
            >
              <div class="upload-wrapper">
                <div class="query-options">
                  <el-check-tag
                    :checked="internet"
                    @change="internet = !internet"
                    type="success"
                  >
                    <el-icon><Connection /></el-icon>
                    <span style="margin-left: 4px">联网思考</span>
                  </el-check-tag>

                  <el-check-tag
                    :checked="local"
                    @change="local = !local"
                    type="primary"
                    style="margin-left: 8px"
                  >
                    <el-icon><Collection /></el-icon>
                    <span style="margin-left: 4px">私库查询</span>
                  </el-check-tag>
                </div>
              </div>
              <div class="kb-actions">
                <!-- 上传按钮 -->
                <label class="upload-label">
                  <Upload class="icon" />
                  <input
                    type="file"
                    multiple
                    @change="onChange"
                    ref="fileInput"
                    class="file-input"
                  />
                </label>
                <button
                  type="button"
                  :disabled="!store.sending && !input.trim()"
                  @click="store.sending ? handleStop() : onSubmit()"
                  :class="store.sending ? 'chat-stop-btn' : 'chat-send-btn'"
                >
                  <template v-if="store.sending"> ⏹ 停止 </template>
                  <template v-else> 📤 发送 </template>
                </button>
              </div>
            </div>
            <p v-if="store.error" class="error">{{ store.error }}</p>
          </form>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { ref, watch, reactive, watchEffect, onMounted } from "vue";
import { useChatStore } from "@/stores/chat";
import { ElButton } from "element-plus";
import { Upload } from "lucide-vue-next";
// 新增：引入axios用于接口请求（若项目已全局引入可省略）
import axios from "axios";
import { Connection, Collection } from "@element-plus/icons-vue";

const store = useChatStore();
const thinkOpen = reactive<Record<number, boolean>>({});
const thinkTime = reactive<Record<number, number>>({});
const thinkLoading = reactive<Record<number, boolean>>({});
const DEFAULT_MODEL = "deepseek-r1:8b";
const model = ref(store.model || DEFAULT_MODEL);

const loadingDots = ref(".");
let dotTimer: any;

const input = ref("");
const previewNames = ref<string[]>([]);
const images = ref<string[]>([]);
const others = ref<{ name: string; type: string; dataUrl: string }[]>([]);
const selectedFiles = ref<File[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

// 新增：历史聊天相关状态
const historyList = ref<any[]>([]); // 历史聊天列表数据
const historyLoading = ref(false); // 历史列表加载状态
const currentHistoryId = ref<string | null>(null); // 当前选中的历史聊天ID

// 分页状态
const pageNum = ref(1);
const pageSize = 20;
const hasMore = ref(true);

/**
 * 获取历史聊天列表（分页）
 */
async function fetchChatHistory(reset = false) {
  if (historyLoading.value || !hasMore.value) return;
  historyLoading.value = true;

  try {
    // 模拟接口延迟
    await new Promise((r) => setTimeout(r, 500));

    // 模拟数据
    const total = 45; // 总共 45 条
    const startIdx = (pageNum.value - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const data: any[] = [];

    for (let i = startIdx; i < endIdx; i++) {
      data.push({
        id: String(i + 1),
        title: `聊天记录 ${i + 1}`,
        createTime: "2025-09-18 10:00:00",
      });
    }

    if (reset) {
      historyList.value = data;
    } else {
      historyList.value = [...historyList.value, ...data];
    }

    // 更新分页状态
    if (endIdx >= total) {
      hasMore.value = false;
    } else {
      pageNum.value++;
    }
  } finally {
    historyLoading.value = false;
  }
}

/**
 * 监听滚动到底部加载更多
 */
function handleScroll(e: Event) {
  const el = e.target as HTMLElement;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
    fetchChatHistory();
  }
}

// ---------------------- 新增：历史聊天功能逻辑 ----------------------

// 新增：历史聊天折叠状态与切换方法
const isHistoryCollapsed = ref(false);
const toggleHistoryCollapse = () => {
  isHistoryCollapsed.value = !isHistoryCollapsed.value;
};

// 勾选状态：联网查询、私库查询
const internet = ref(false);
const local = ref(false);

/**
 * 页面挂载时请求历史聊天接口
 */
onMounted(() => {
  fetchChatHistory(true);
});

// /**
//  * 请求历史聊天列表接口 /chat/history
//  */
// async function fetchChatHistory() {
//   historyLoading.value = true;
//   try {
//     // --------- 本地模拟数据 start ---------
//     // 模拟接口返回格式：{ code: 200, data: [...] }
//     await new Promise((resolve) => setTimeout(resolve, 500)); // 模拟网络延迟
//     const response = {
//       code: 200,
//       data: [
//         { id: "1", title: "第一次聊天", createTime: "2025-09-17 10:00:00" },
//         { id: "2", title: "Vue开发调试", createTime: "2025-09-17 11:00:00" },
//         { id: "3", title: "前端样式优化", createTime: "2025-09-17 12:30:00" },
//       ],
//     };
//     // --------- 本地模拟数据 end ---------

//     if (response.code === 200) {
//       historyList.value = response.data;
//       // 默认选中第一条
//       if (historyList.value.length > 0) {
//         currentHistoryId.value = historyList.value[0].id;
//       }
//     }
//   } catch (error) {
//     console.error("模拟获取历史聊天异常：", error);
//   } finally {
//     historyLoading.value = false;
//   }
// }

/**
 * 新建聊天：清空当前对话框内容 + 重置输入状态
 */
function handleNewChat() {
  // 1. 清空store中的消息列表
  store.clear();

  // 2. 重置输入框、文件预览、选中文件
  input.value = "";
  previewNames.value = [];
  images.value = [];
  others.value = [];
  selectedFiles.value = [];
  if (fileInput.value) fileInput.value.value = "";

  // 3. 重置模型为默认值
  model.value = DEFAULT_MODEL;
  store.model = DEFAULT_MODEL;

  // 4. 取消历史聊天选中状态
  currentHistoryId.value = null;

  // 5. 重置思考相关状态
  for (const key in thinkOpen) delete thinkOpen[key];
  for (const key in thinkLoading) delete thinkLoading[key];
  for (const key in thinkTime) delete thinkTime[key];
}

async function handleSelectHistory(historyItem: any) {
  currentHistoryId.value = historyItem.id;
  historyLoading.value = true;

  try {
    await new Promise((resolve) => setTimeout(resolve, 300)); // 模拟延迟

    // 本地模拟不同历史聊天对应的消息
    let chatRecords: any[] = [];
    if (historyItem.id === "1") {
      chatRecords = [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！有什么可以帮你的吗？", thinkSeconds: 23 },
      ];
    } else if (historyItem.id === "2") {
      chatRecords = [
        { role: "user", content: "如何在 Vue 中实现组件通信？" },
        {
          role: "assistant",
          content: "可以使用 props、emits 或者 provide/inject。",
          thinkSeconds: 13,
        },
        {
          role: "user",
          content: "分析不同方案优缺点\n考虑性能与维护性你推荐哪种方式？",
        },
        {
          role: "assistant",
          content:
            "<think>思考了一下内容易撒啊的</think>根据场景，如果父子组件通信使用 props/emits，跨层级使用 provide/inject。",
          thinkSeconds: 80,
        },
      ];
    } else if (historyItem.id === "3") {
      chatRecords = [
        { role: "user", content: "页面样式太丑了" },
        { role: "assistant", content: "可以使用 flex 布局和统一的主题色来优化。" },
      ];
    }

    // ✅ 先清空思考状态
    for (const key in thinkOpen) delete thinkOpen[key];
    for (const key in thinkLoading) delete thinkLoading[key];
    for (const key in thinkTime) delete thinkTime[key];

    // 清空当前消息并加载模拟历史消息
    store.clear();
    chatRecords.forEach((msg, idx) => {
      store.appendMessage(msg.role, msg.content, msg.images || [], msg.files || []);

      if (msg.role === "assistant" && msg.thinkSeconds !== undefined) {
        thinkLoading[idx] = false; // 已完成
        thinkOpen[idx] = false; // 默认折叠
        thinkTime[idx] = msg.thinkSeconds; // ✅ 保留模拟时间
      }
    });

    // 同步模型（可选）
    model.value = historyItem.model || DEFAULT_MODEL;
    store.model = model.value;
  } finally {
    historyLoading.value = false;
  }
}

// ---------------------- 原有逻辑保持不变 ----------------------
function onPicked(payload: {
  images: string[];
  files: { name: string; type: string; dataUrl: string }[];
}) {
  images.value = payload.images;
  others.value = payload.files;
  previewNames.value = [
    ...images.value.map((_, i) => `图片${i + 1}`),
    ...others.value.map((f) => f.name),
  ];
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function handleStop() {
  store.stop({
    onStopped: () => {
      console.log("用户主动停止对话");
      const lastIndex = store.messages.length - 1;
      if (lastIndex >= 0 && store.messages[lastIndex].role === "assistant") {
        thinkLoading[lastIndex] = false;
        thinkOpen[lastIndex] = false;
        thinkTime[lastIndex] = 0;
      }
    },
  });
}

async function onChange(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const files = inputEl.files ? Array.from(inputEl.files) : [];
  selectedFiles.value = selectedFiles.value.concat(files);
  previewNames.value = selectedFiles.value.map((f) => f.name);

  const imgs: string[] = [];
  const othrs: { name: string; type: string; dataUrl: string }[] = [];
  for (const f of selectedFiles.value) {
    const dataUrl = await fileToDataUrl(f);
    if (f.type.startsWith("image/")) imgs.push(dataUrl);
    else othrs.push({ name: f.name, type: f.type, dataUrl });
  }

  pendingImages = imgs;
  pendingFiles = othrs;
  inputEl.value = "";
}

function removeFile(index: number) {
  previewNames.value.splice(index, 1);
  if (index < images.value.length) {
    images.value.splice(index, 1);
    pendingImages.splice(index, 1);
  } else {
    const othersIndex = index - images.value.length;
    others.value.splice(othersIndex, 1);
    pendingFiles.splice(othersIndex, 1);
  }
  selectedFiles.value.splice(index, 1);
}

watch(model, (v) => (store.model = v));

function reset() {
  store.clear();
  model.value = DEFAULT_MODEL;
  store.model = DEFAULT_MODEL;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

function renderMarkdown(text: string) {
  return md.render(text || "");
}

watchEffect(() => {
  if (Object.values(thinkLoading).some((v) => v)) {
    if (!dotTimer) {
      dotTimer = setInterval(() => {
        loadingDots.value = loadingDots.value.length >= 5 ? "." : loadingDots.value + ".";
      }, 500);
    }
  } else {
    clearInterval(dotTimer);
    dotTimer = null;
    loadingDots.value = ".";
  }
});

let pendingImages: string[] = [];
let pendingFiles: { name: string; type: string; dataUrl: string }[] = [];

function extractTextFromEvent(raw: string): string {
  let jsonStr = raw.trim();
  if (jsonStr.startsWith("data:")) {
    jsonStr = jsonStr.substring(5).trim();
  }
  try {
    const obj = JSON.parse(jsonStr);
    return obj?.result?.output?.text || obj?.results?.[0]?.output?.text || "";
  } catch (e) {
    console.warn("JSON 解析失败", e);
    return "";
  }
}

function renderNormalMarkdown(lines: string[]) {
  const text = lines.join("\n");
  return md.render(text);
}

function parseText(text: string) {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  const thinkText = thinkMatch ? thinkMatch[1].trim() : "";
  //const normalText = text.replace(/[\s\S]*?<\/think>/, "").trim();
  const normalText = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  return {
    thinkText,
    normalLines: normalText.split("\n"),
    thinkLines: thinkText.split("\n"),
  };
}

function toggleThink(idx: number) {
  thinkOpen[idx] = !thinkOpen[idx];
}

function formatContent(content: string) {
  return content.replace(/\n/g, "<br>");
}

async function onSubmit() {
  const content = input.value.trim();
  if (!content) return;

  input.value = "";
  store.appendUserMessage(content, pendingImages, pendingFiles);
  pendingImages = [];
  pendingFiles = [];

  const start = Date.now();

  await store.send({
    opts: {
      internet: internet.value,
      local: local.value,
    },
    onAssistantStart: (aiIndex) => {
      thinkOpen[aiIndex] = false;
      thinkLoading[aiIndex] = true;
      thinkTime[aiIndex] = 0;
    },
    onAssistantDone: (aiIndex) => {
      thinkLoading[aiIndex] = false;
      const sec = Math.max(0, Math.round((Date.now() - start) / 1000));
      thinkTime[aiIndex] = sec;
    },
  });
}
</script>
