<template>
  <div class="kb-container">
    <!-- 工具栏：面包屑 + 右上角上传 -->
    <div class="kb-toolbar">
      <div class="kb-breadcrumbs">
        <span class="crumb" @click="goRoot">根目录</span>
        <template v-for="(seg, idx) in breadcrumbSegments" :key="idx">
          <span class="sep">/</span>
          <span class="crumb" @click="goToIndex(idx)">{{ seg }}</span>
        </template>
      </div>
      <div class="kb-actions">
        <button class="kb-btn" @click="triggerUpload">上传文件</button>
        <input
          ref="fileInput"
          type="file"
          multiple
          style="display: none"
          @change="onUpload"
        />
      </div>
    </div>

    <!-- 目录列表 -->
    <div class="kb-list">
      <table class="kb-table">
        <thead>
          <tr>
            <th style="text-align: left">名称</th>
            <th style="width: 100px">类型</th>
            <th style="width: 140px">大小</th>
            <th style="width: 180px">修改时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="currentPath" class="kb-row" @click="goUp">
            <td colspan="4">⬆️ 返回上级 ..</td>
          </tr>
          <tr
            v-for="item in items"
            :key="itemKey(item)"
            class="kb-row"
            @click="open(item)"
          >
            <td>
              <span v-if="item.type === 'dir'">📁 {{ item.name }}</span>
              <span v-else>📄 {{ item.name }}</span>
            </td>
            <td>{{ item.type }}</td>
            <td>{{ item.size ?? "-" }}</td>
            <td>{{ item.updatedAt ?? "-" }}</td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="4" style="text-align: center; color: #777">此目录暂无文件</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import axios from "axios";

type KBItem = {
  name: string;
  type: "dir" | "file";
  size?: string;
  updatedAt?: string;
};

const items = ref<KBItem[]>([]);
const currentPath = ref(""); // 使用 "/" 拼接
const fileInput = ref<HTMLInputElement | null>(null);

const breadcrumbSegments = computed(() =>
  currentPath.value ? currentPath.value.split("/").filter(Boolean) : []
);

function itemKey(it: KBItem) {
  return currentPath.value + "/" + it.name;
}

function pathJoin(base: string, name: string) {
  return [base, name].filter(Boolean).join("/");
}

async function loadDir(path = "") {
  try {
    const { data } = await axios.get("/api/kb/list", { params: { path } });
    items.value = data?.items || [];
  } catch (e) {
    // 没有后端时的占位数据，便于前端自测
    items.value = [
      { name: "docs", type: "dir", updatedAt: "2025-01-01 10:00" },
      { name: "readme.md", type: "file", size: "3.2 KB", updatedAt: "2025-01-05 09:12" },
    ];
  }
}

function open(it: KBItem) {
  if (it.type === "dir") {
    currentPath.value = pathJoin(currentPath.value, it.name);
    loadDir(currentPath.value);
  } else {
    // 文件点击可扩展：下载/预览
  }
}

function goUp() {
  if (!currentPath.value) return;
  const parts = currentPath.value.split("/").filter(Boolean);
  parts.pop();
  currentPath.value = parts.join("/");
  loadDir(currentPath.value);
}

function goRoot() {
  currentPath.value = "";
  loadDir("");
}

function goToIndex(idx: number) {
  const parts = currentPath.value.split("/").filter(Boolean);
  currentPath.value = parts.slice(0, idx + 1).join("/");
  loadDir(currentPath.value);
}

function triggerUpload() {
  fileInput.value?.click();
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  const form = new FormData();
  for (const f of Array.from(input.files)) form.append("files", f);
  form.append("path", currentPath.value);

  try {
    await axios.post("/api/kb/upload", form);
    await loadDir(currentPath.value);
  } finally {
    if (fileInput.value) fileInput.value.value = "";
  }
}

onMounted(() => loadDir(""));
</script>

<style scoped>
/* 简单列表样式 */
ul {
  padding: 0;
  margin: 0;
  list-style: none;
}
li {
  margin-bottom: 4px;
}
.kb-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
}
.kb-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.kb-actions .kb-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #333;
  color: #fff;
  cursor: pointer;
}
.kb-breadcrumbs {
  font-size: 14px;
}
.kb-breadcrumbs .crumb {
  cursor: pointer;
  color: #0070f3;
}
.kb-breadcrumbs .sep {
  margin: 0 6px;
  color: #999;
}
.kb-list {
  flex: 1;
  overflow: auto;
}
.kb-table {
  width: 100%;
  border-collapse: collapse;
}
.kb-table th,
.kb-table td {
  border-bottom: 1px solid #eee;
  padding: 8px;
}
.kb-row {
  cursor: pointer;
}
.kb-row:hover {
  background: #fafafa;
}
</style>
