<style scoped>
@import "./style/common.css";
@import "./style/chatPage.css";
</style>

<template>
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
        <!-- <div class="role">{{ m.role }}</div> -->
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
              <template v-for="(line, idx) in parseText(m.content).thinkLines" :key="idx">
                {{ line }}<br />
              </template>
            </div>
          </div>

          <!--  回答正文 -->
          <!-- <div
            v-for="(line, idx) in parseText(m.content).normalLines"
            :key="idx"
            class="content-container"
            v-html="renderMarkdown(line)"
          ></div> -->

          <div
            class="content-container markdown-wrapper"
            v-html="renderNormalMarkdown(parseText(m.content).normalLines)"
          ></div>

          <div v-if="m.images?.length" style="margin-top: 5px">
            <img
              v-for="(src, idx) in m.images"
              :key="idx"
              :src="src"
              style="width: 80px; height: 80px; object-fit: cover; margin-right: 5px"
            />
          </div>

          <div v-if="m.files?.length" style="margin-top: 5px">
            <a v-for="(f, idx) in m.files" :key="idx" :href="f.dataUrl" :download="f.name"
              >📎 {{ f.name }}</a
            >
          </div>
        </div>
      </div>
    </main>

    <!-- 底部输入框 -->
    <footer class="input-area">
      <!-- 文件名预览放在 form 外 -->
      <!-- 文件名预览放在 form 外 -->
      <ul v-if="previewNames.length" class="file-names-list">
        <li v-for="(name, index) in previewNames" :key="index" class="file-name-item">
          {{ name }}
          <button type="button" class="delete-btn" @click="removeFile(index)">✕</button>
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
              v-if="store.sending"
              @click="store.stop()"
              class="chat-stop-btn"
            >
              停止
            </button>
            <button
              type="submit"
              :disabled="store.sending || !input.trim()"
              class="chat-send-btn"
            >
              发送
            </button>
          </div>
        </div>
        <p v-if="store.error" class="error">{{ store.error }}</p>
      </form>
    </footer>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { ref, watch, reactive, watchEffect } from "vue";
import { useChatStore } from "@/stores/chat";
import { ElButton } from "element-plus";
import { Upload } from "lucide-vue-next"; // 上传图标

const store = useChatStore();
const thinkOpen = reactive<Record<number, boolean>>({});
const thinkTime = reactive<Record<number, number>>({}); // 存储每条消息的耗时
const thinkLoading = reactive<Record<number, boolean>>({}); // 标记是否请求中
const DEFAULT_MODEL = "deepseek-r1:8b";
const model = ref(store.model || DEFAULT_MODEL);

const loadingDots = ref(".");
let dotTimer: any;

const input = ref("");
const previewNames = ref<string[]>([]);
const images = ref<string[]>([]);
const others = ref<{ name: string; type: string; dataUrl: string }[]>([]);
const selectedFiles = ref<File[]>([]);

// FilePicker 选择文件后回调
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

async function onChange(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const files = inputEl.files ? Array.from(inputEl.files) : [];

  // 累加文件
  selectedFiles.value = selectedFiles.value.concat(files);

  // 更新文件名预览
  previewNames.value = selectedFiles.value.map((f) => f.name);

  // 处理 images / others
  const imgs: string[] = [];
  const othrs: { name: string; type: string; dataUrl: string }[] = [];

  for (const f of selectedFiles.value) {
    const dataUrl = await fileToDataUrl(f);
    if (f.type.startsWith("image/")) imgs.push(dataUrl);
    else othrs.push({ name: f.name, type: f.type, dataUrl });
  }

  // 同步到全局待发送变量
  pendingImages = imgs;
  pendingFiles = othrs;

  // 重置 input，保证下次选择同名文件也会触发 change
  inputEl.value = "";
}

function removeFile(index: number) {
  // 移除预览
  previewNames.value.splice(index, 1);

  // 移除对应 images 或 others
  if (index < images.value.length) {
    // 移除图片
    images.value.splice(index, 1);
    pendingImages.splice(index, 1);
  } else {
    // 移除其他文件
    const othersIndex = index - images.value.length;
    others.value.splice(othersIndex, 1);
    pendingFiles.splice(othersIndex, 1);
  }
  // 同步 selectedFiles
  selectedFiles.value.splice(index, 1);
}

watch(model, (v) => (store.model = v));

function reset() {
  store.clear();
  model.value = DEFAULT_MODEL;
  store.model = DEFAULT_MODEL;
}

const md = new MarkdownIt({
  html: true, // 允许 HTML 标签
  linkify: true, // 自动识别链接
  breaks: true, // 回车换行
});

// 封装一个工具方法，把纯文本转成 HTML
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

watch(model, (v) => (store.model = v));

let pendingImages: string[] = [];
let pendingFiles: { name: string; type: string; dataUrl: string }[] = [];

// function onPicked(payload: {
//   images: string[];
//   files: { name: string; type: string; dataUrl: string }[];
// }) {
//   pendingImages = payload.images;
//   pendingFiles = payload.files;
// }

// 解析 data:{} → 提取 JSON.text
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

// script setup
function renderNormalMarkdown(lines: string[]) {
  const text = lines.join("\n"); // 合并成整体 markdown
  return md.render(text);
}

/**
 * 解析 text，提取 think 内容
 * parseTest在流式响应API会被调用多次，每次text内容追加
 */
function parseText(text: string) {
  //console.log("打印 text：", text);
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  const thinkText = thinkMatch ? thinkMatch[1].trim() : "";
  const normalText = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();
  return {
    thinkText,
    normalLines: normalText.split("\n"),
    thinkLines: thinkText.split("\n"),
  };
}

/**
 * 切换折叠状态
 */
function toggleThink(idx: number) {
  thinkOpen[idx] = !thinkOpen[idx];
}

function formatContent(content: string) {
  // 打印
  //console.console.log(content.replace(/\n/g, "<br>"));
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
      // 助手占位消息一创建就能显示“思考中…”
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
