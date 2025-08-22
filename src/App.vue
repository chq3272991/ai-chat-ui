<template>
  <div class="container">
    <header>
      <h1>AI Chat UI</h1>
      <div style="margin-top: 8px; font-size: 14px">
        模型: <input v-model="model" style="width: 150px" />
        <button @click="store.clear()">清空</button>
      </div>
    </header>

    <!-- 消息展示区 -->
    <main class="messages">
      <div v-for="(m, i) in store.messages" :key="i" class="message">
        <!-- <div class="role">{{ m.role }}</div> -->
        <div class="bubble" :name="m.role">
          <!-- think 折叠区域 -->
          <div v-if="parseText(m.content).thinkText" class="think-container">
            <button @click="toggleThink(i)">
              {{ thinkOpen[i] ? "收起思考" : "显示思考" }}
            </button>
            <div v-show="thinkOpen[i]" class="think-content">
              <template v-for="(line, idx) in parseText(m.content).thinkLines" :key="idx">
                {{ line }}<br />
              </template>
            </div>
          </div>

          <!-- 普通文本 -->
          <!-- <template v-for="line in parseText(m.content).normalLines" :key="line.idx">
            {{ line.text }}
          </template> -->

          <div
            v-for="(line, idx) in parseText(m.content).normalLines"
            :key="idx"
            class="content-container"
          >
            {{ line }}<br />
          </div>

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
          <FilePicker @picked="onPicked" />
          <div>
            <button type="button" v-if="store.sending" @click="store.stop()">停止</button>
            <button type="submit" :disabled="store.sending || !input.trim()">发送</button>
          </div>
        </div>
        <p v-if="store.error" class="error">{{ store.error }}</p>
      </form>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from "vue";
import { useChatStore } from "./stores/chat";
import FilePicker from "./components/FilePicker.vue";

const store = useChatStore();
const input = ref("");
const model = ref(store.model);
const thinkOpen = reactive<Record<number, boolean>>({});

watch(model, (v) => (store.model = v));

let pendingImages: string[] = [];
let pendingFiles: { name: string; type: string; dataUrl: string }[] = [];

function onPicked(payload: {
  images: string[];
  files: { name: string; type: string; dataUrl: string }[];
}) {
  pendingImages = payload.images;
  pendingFiles = payload.files;
}

/**
 * 解析 text，提取 think 内容
 */
function parseText(text: string) {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
  const thinkText = thinkMatch ? thinkMatch[1].trim() : "";
  const normalText = text.replace(/<think>[\s\S]*?<\/think>/, "").trim();

  return {
    thinkText,
    //normalLines: normalText.split("\n").map((t, idx) => ({ text: t, idx })),
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
  const content = input.value;
  input.value = "";
  store.appendUserMessage(content, pendingImages, pendingFiles);
  pendingImages = [];
  pendingFiles = [];
  await store.send();
}
</script>
