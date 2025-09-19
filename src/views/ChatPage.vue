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
      <button class="new-chat-btn" @click="handleNewChat(true)">
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
          <div
            v-if="conversationLoading && conversationList.length === 0"
            class="history-loading"
          >
            加载历史聊天中...
          </div>
          <div v-else-if="conversationList.length === 0" class="history-empty">
            暂无历史聊天记录
          </div>

          <ul class="history-list" v-else>
            <li
              class="history-item"
              :class="{ active: currentConversationId === item.id }"
              @click="handleSelectHistory(item)"
              v-for="item in conversationList"
              :key="item.id"
            >
              <span class="history-title-text">{{ item.title || "未命名聊天" }}</span>

              <el-popover
                trigger="click"
                placement="top-end"
                popper-class="history-more-popover"
              >
                <div class="more-menu-item" @click.stop="handleRename(item)">重命名</div>
                <div class="more-menu-item" @click.stop="handleDelete(item)">删除</div>
                <div class="more-menu-item" @click.stop="handleArchive(item)">归档</div>
                <div class="more-menu-item" @click.stop="handleShare(item)">共享</div>

                <template #reference>
                  <button class="more-btn" @click.stop>⋮</button>
                </template>
              </el-popover>
            </li>
          </ul>
          <div
            v-if="conversationLoading && conversationList.length > 0"
            class="history-loading"
          >
            加载更多...
          </div>
          <div
            v-if="!conversationHasMore && conversationList.length > 0"
            class="history-end"
          >
            没有更多了
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：原聊天内容区 -->
    <div class="main-content">
      <div class="container">
        <!-- 消息展示区 -->
        <main
          class="messages"
          ref="messagesContainer"
          @scroll.passive="handleHistoryScroll"
        >
          <div v-for="(m, i) in store.messages" :key="i" class="message">
            <div class="bubble" :name="m.role">
              <!-- 思考折叠区域：直接使用 m.thinkLoading/m.thinkTime/m.thinkOpen -->
              <div
                v-if="m.thinkLoading || parseText(m.content).thinkText || m.thinkTime"
                class="think-container"
              >
                <button @click="toggleThink(i)">
                  <template v-if="m.thinkLoading"> > 思考中{{ loadingDots }} </template>
                  <template v-else>
                    > 思考了 {{ m.thinkTime }} 秒 {{ m.thinkOpen ? "▲" : "▼" }}
                  </template>
                </button>
                <!-- 思考文本 -->
                <div v-show="m.thinkOpen" class="think-content">
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
import { ref, watch, reactive, watchEffect, onMounted, nextTick } from "vue";
import { useChatStore } from "@/stores/chat";
import { ElButton } from "element-plus";
import { Upload } from "lucide-vue-next";
// 新增：引入axios用于接口请求（若项目已全局引入可省略）
import axios from "axios";
import { Connection, Collection } from "@element-plus/icons-vue";
import type { ChatMessage, ChatRequestBody, ChatOptions, Conversation } from "@/types";
import { getConversationId } from "@/lib/api";

const store = useChatStore();
// const thinkOpen = reactive<Record<number, boolean>>({});
// const thinkTime = reactive<Record<number, number>>({});
// const thinkLoading = reactive<Record<number, boolean>>({});
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
const conversationList = ref<Conversation[]>([]); // 历史聊天列表数据
const conversationLoading = ref(false); // 历史列表加载状态
const currentConversationId = ref<string | "">(""); // 当前选中的历史聊天ID

// 分页状态
const conversationCurrent = ref(1);
const conversationPageSize = 20;
const conversationHasMore = ref(true);
const messagesContainer = ref<HTMLElement | null>(null);

const historyMessages = ref<any[]>([]);
const historyMessagePage = ref(1);
const historyMessagePageSize = ref(40);
const historyMessageTotalPages = ref(1);
const loadingHistoryMessages = ref(false);
const moreMenuOpenId = ref<string | null>(null);

// 新增：标记当前是否为「新建聊天」状态（用于后续插入最新数据）
const isNewChatSession = ref(false);

/**
 * 获取历史聊天列表（分页）
 */
async function fetchChatHistory(reset = false) {
  if (conversationLoading.value || !conversationHasMore.value) return;
  conversationLoading.value = true;

  try {
    const response = await axios.post("/conversation/getPage", {
      current: conversationCurrent.value, // 当前页
      size: conversationPageSize, // 每页条数
    });

    const result = response.data;
    if (result.success) {
      const records = result.data.records || [];
      const total = result.data.total || 0;
      const current = result.data.current || 1;
      const pages = result.data.pages || 1;

      // 使用真实数据更新列表
      if (reset) {
        conversationList.value = records;
        conversationCurrent.value = 2;
      } else {
        conversationList.value = [...conversationList.value, ...records];
        conversationCurrent.value = current + 1;
      }

      // 更新分页状态
      conversationHasMore.value = current < pages;

      // ✅ 如果是第一页，并且返回了数据，默认选中第一条
      if (reset && records.length > 0) {
        currentConversationId.value = records[0].id;
        console.log("首次加载第一条会话，切换model:", records[0].model);
        model.value = records[0].model;
        store.model = records[0].model;
        fetchHistoryMessages(records[0].id, 1);
      }
    }
  } catch (error) {
    console.error("获取聊天历史失败:", error);
  } finally {
    conversationLoading.value = false;
  }
}

/**
 * 获取最新聊天，插入到左侧标题栏（优化加载时空白问题）
 */
async function fetchLeastChatHistory() {
  // 保存当前分页状态和旧数据
  const originalPageNum = conversationCurrent.value;
  const originalHasMore = conversationHasMore.value;
  const oldHistoryList = [...conversationList.value]; // 缓存旧数据

  try {
    // 1. 不直接清空列表，而是先标记加载状态
    conversationLoading.value = true;
    // 2. 重置分页参数，从第一页开始
    conversationCurrent.value = 1;
    conversationHasMore.value = true;
    // 临时数组存储新加载的所有页数据
    const newHistoryList: any[] = [];
    console.log("打印originalPageNum：" + originalPageNum);

    // 3. 使用for循环加载原来已查看的分页范围
    for (let i = 1; i <= originalPageNum && originalHasMore; i++) {
      // 调用修改后的fetchChatHistory，返回当前页数据而非直接修改historyList
      const pageData = await fetchChatHistoryPage(i);
      newHistoryList.push(...pageData);
      conversationCurrent.value = i + 1;
    }

    // 4. 所有页加载完成后，再替换列表（避免中间空白）
    conversationList.value = newHistoryList;

    // 5. 处理非新建会话选中逻辑
    if (!currentConversationId.value && conversationList.value.length > 0) {
      currentConversationId.value = conversationList.value[0].id;
    }
  } catch (error) {
    console.error("获取最新聊天记录失败:", error);
    // 出错时恢复旧数据
    conversationList.value = oldHistoryList;
  } finally {
    // 恢复原始分页状态
    conversationCurrent.value = originalPageNum;
    conversationHasMore.value = originalHasMore;
    conversationLoading.value = false;
  }
}

/**
 * 辅助函数：获取单页聊天历史（不直接修改historyList）
 */
async function fetchChatHistoryPage(page: number): Promise<any[]> {
  try {
    const response = await axios.post("/conversation/getPage", {
      current: page,
      size: conversationPageSize,
    });
    const result = response.data;
    if (result.success) {
      conversationHasMore.value = page < (result.data.pages || 1);
      return result.data.records || [];
    }
    return [];
  } catch (error) {
    console.error(`获取第${page}页历史失败:`, error);
    return [];
  }
}

function handleSelectHistory(item: Conversation) {
  const historyId = item.id;
  if (!historyId) return;

  console.log("用户点击左侧会话标题切换对话，切换会话id为:" + item.id);

  //console.log("Conversation会话对象：", item);

  // 清空消息，但不清空 currentHistoryId
  store.clear();
  currentConversationId.value = historyId; // ✅ 更新为新会话的 id
  historyMessagePage.value = 1;
  historyMessageTotalPages.value = 1;
  if (model.value !== item.model) {
    console.log("切换模型：", item.model);
    model.value = item.model;
    store.model = item.model;
  }

  // 拉第一页
  fetchHistoryMessages(historyId, 1);

  // 当用户还处于新建窗口的时候，点击了左侧会话标题，说明需要切换会话界面了
  if (isNewChatSession.value) {
    fetchLeastChatHistory();
    isNewChatSession.value = false;
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

function handleHistoryScroll(e: Event) {
  const el = e.target as HTMLElement;
  // 滑到顶部触发加载上一页
  if (el.scrollTop <= 10) {
    const nextPage = historyMessagePage.value + 1;
    if (nextPage < historyMessageTotalPages.value) {
      fetchHistoryMessages(currentConversationId.value, nextPage);
    }
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

/**
 * 新建聊天：清空当前对话框内容 + 重置输入状态
 */
function handleNewChat(click = false) {
  if (store.sending) {
    handleStop();
  }
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

  // 4. 新建聊天框，重置会话ID
  currentConversationId.value = getConversationId(true);
  historyMessagePage.value = 1;
  historyMessageTotalPages.value = 1;

  if (click) {
    isNewChatSession.value = true;
    fetchLeastChatHistory();
  }
}

async function fetchHistoryMessages(conversationId: string, page: number) {
  // console.log("fetchHistoryMessages打印conversationId：", conversationId);
  if (loadingHistoryMessages.value) return;
  loadingHistoryMessages.value = true;

  try {
    const size = historyMessagePageSize.value;
    const response = await axios.post("/conversation/getMessagePage", {
      current: page,
      size,
      conversationId,
    });

    const result = response.data;
    if (result.success) {
      const records = result.data.records || [];
      const pages = result.data.pages || 1;

      // 新消息加在前面，保持时间顺序
      records.forEach((msg, idx: number) => {
        const parsed = parseText(msg.content || "");
        store.prependMessage({
          role: msg.role,
          content: msg.content,
          images: msg.images || [],
          files: msg.files || [],
          thinkTime: msg.duration, // 假设后端用 duration 字段存储思考耗时
        });
      });

      historyMessageTotalPages.value = pages;
      historyMessagePage.value = page;

      // --- 核心：滚动到底部 ---
      await nextTick();
      if (messagesContainer.value && page == 1) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    } else {
      console.warn("获取历史消息失败:", result.message);
    }
  } catch (err) {
    console.error("请求历史消息失败:", err);
  } finally {
    loadingHistoryMessages.value = false;
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
      // 无需手动修改 thinkLoading，Store 已在 stop 中更新
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

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

function renderMarkdown(text: string) {
  return md.render(text || "");
}

watchEffect(() => {
  // 替代原来的 Object.values(thinkLoading).some(...)
  const hasLoading = store.messages.some(
    (msg) => msg.role === "assistant" && msg.thinkLoading
  );

  if (hasLoading) {
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
  store.toggleMessageThink(idx); // 替代原来的 thinkOpen[idx] = !thinkOpen[idx]
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
  console.log("当前会话 ID:", currentConversationId.value);
  await store.send({
    opts: {
      internet: internet.value,
      local: local.value,
      conversationId: currentConversationId.value,
    },
    onAssistantStart: (aiIndex) => {
      // 无需手动设置 thinkLoading[aiIndex] = true（Store 已处理）
      store.updateMessageThinkState(aiIndex, { thinkLoading: true });
    },
    onAssistantDone: (aiIndex) => {
      // 无需手动计算 thinkTime（Store 已处理）
      if (isNewChatSession.value) {
        console.log("新建窗口并聊天响应结束");
        fetchLeastChatHistory();
      }
    },
  });
}

function toggleMoreMenu(itemId: string) {
  if (moreMenuOpenId.value === itemId) {
    moreMenuOpenId.value = null;
  } else {
    moreMenuOpenId.value = itemId;
  }
}

// 点击操作
function handleRename(item: any) {
  console.log("重命名", item);
  moreMenuOpenId.value = null;
}

function handleDelete(item: any) {
  console.log("删除", item);
  moreMenuOpenId.value = null;
}

function handleArchive(item: any) {
  console.log("归档", item);
  moreMenuOpenId.value = null;
}

function handleShare(item: any) {
  console.log("共享", item);
  moreMenuOpenId.value = null;
}

// 点击页面空白关闭菜单
document.addEventListener("click", () => {
  moreMenuOpenId.value = null;
});
</script>
