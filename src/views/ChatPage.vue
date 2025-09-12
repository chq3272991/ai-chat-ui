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
        <div class="history-content">
          <div v-if="historyLoading" class="history-loading">加载历史聊天中...</div>
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
                v-if="thinkLoading[i] || parseText(m.content).thinkText"
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
                    {{ line }}<br />
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
              </div>
              <div class="kb-actions">
                <button
                  type="button"
                  :disabled="!input.trim() && !store.sending"
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

// ---------------------- 新增：历史聊天功能逻辑 ----------------------

// 新增：历史聊天折叠状态与切换方法
const isHistoryCollapsed = ref(false);
const toggleHistoryCollapse = () => {
  isHistoryCollapsed.value = !isHistoryCollapsed.value;
};
/**
 * 页面挂载时请求历史聊天接口
 */
onMounted(() => {
  fetchChatHistory();
});

/**
 * 请求历史聊天列表接口 /chat/history
 */
async function fetchChatHistory() {
  historyLoading.value = true;
  try {
    const response = await axios.get("/chat/history");
    // 假设接口返回格式：{ code: 200, data: [{ id: "xxx", title: "聊天标题", createTime: "xxx" }] }
    if (response.data.code === 200) {
      historyList.value = response.data.data;
      // 若有历史数据，默认选中第一条（可选逻辑）
      if (historyList.value.length > 0) {
        currentHistoryId.value = historyList.value[0].id;
      }
    } else {
      console.error("获取历史聊天失败：", response.data.msg);
    }
  } catch (error) {
    console.error("历史聊天接口请求异常：", error);
  } finally {
    historyLoading.value = false;
  }
}

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

/**
 * 选中历史聊天：加载对应聊天记录（需配合后端接口，此处为示例逻辑）
 */
async function handleSelectHistory(historyItem: any) {
  currentHistoryId.value = historyItem.id;
  historyLoading.value = true;
  try {
    // 假设请求单个历史聊天详情接口（需后端提供）
    const response = await axios.get(`/chat/history/${historyItem.id}`);
    if (response.data.code === 200) {
      const chatRecords = response.data.data.messages; // 历史消息列表
      // 清空当前消息并加载历史消息
      store.clear();
      chatRecords.forEach((msg: any) => {
        store.appendMessage(msg.role, msg.content, msg.images || [], msg.files || []);
      });
      // 同步模型
      model.value = response.data.data.model || DEFAULT_MODEL;
      store.model = model.value;
    } else {
      console.error("加载历史聊天详情失败：", response.data.msg);
    }
  } catch (error) {
    console.error("历史聊天详情接口请求异常：", error);
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
