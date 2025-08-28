<template>
  <div class="kb-container">
    <!-- 工具栏：面包屑 + 搜索 + 上传 -->
    <div class="kb-toolbar">
      <div class="kb-left">
        <div class="kb-breadcrumbs">
          <span class="crumb" @click="goRoot">根目录</span>
          <template v-for="(seg, idx) in breadcrumbSegments" :key="idx">
            <span class="sep">/</span>
            <span class="crumb" @click="goToIndex(idx)">{{ seg }}</span>
          </template>
        </div>
        <div class="kb-search">
          <input type="text" v-model="searchQuery" placeholder="搜索文件/文件夹" />
          <button class="kb-btn" @click="doSearch">搜索</button>
        </div>
      </div>
      <div class="kb-actions">
        <button class="kb-btn" @click="triggerUpload">上传文件</button>
        <input
          ref="fileInput"
          type="file"
          webkitdirectory
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
            <th style="width: 100px">大小</th>
            <th style="width: 180px">修改时间</th>
            <th style="width: 140px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="currentPath" class="kb-row" @click="goUp">
            <td colspan="5">⬆️ 返回上级 ..</td>
          </tr>
          <tr v-for="item in filteredItems" :key="itemKey(item)" class="kb-row">
            <td
              @click="item.type === 'dir' ? open(item) : download(item)"
              style="cursor: pointer"
            >
              <span v-if="item.type === 'dir'">📁 {{ item.name }}</span>
              <span v-else>📄 {{ item.name }}</span>
            </td>
            <td>{{ item.type }}</td>
            <td>{{ item.size ?? "-" }}</td>
            <td>{{ item.updatedAt ?? "-" }}</td>
            <td>
              <button class="kb-btn small" @click="download(item)">下载</button>
              <button class="kb-btn small danger" @click="confirmDelete(item)">
                删除
              </button>
            </td>
          </tr>
          <tr v-if="!filteredItems.length">
            <td colspan="5" style="text-align: center; color: #777">此目录暂无文件</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="showUploadModal" class="upload-modal">
    <div class="modal-content">
      <h3>上传文件确认</h3>

      <ul class="file-list">
        <li v-for="pf in pendingFiles" :key="pf.file.name">
          {{ pf.file.name }} ({{ (pf.file.size / 1024).toFixed(1) }} KB)
          <div class="progress-container">
            <div class="progress-bar" :style="{ width: pf.progress + '%' }"></div>
            <span>{{ pf.progress }}%</span>
          </div>
          <span v-if="pf.status === 'done'" style="color: green">✔</span>
          <span v-if="pf.status === 'error'" style="color: red">✖</span>
        </li>
      </ul>

      <div class="modal-actions">
        <label class="checkbox-label">
          <input type="checkbox" v-model="optimizeText" />
          优化文本内容
        </label>
        <div class="buttons">
          <button class="kb-btn" @click="confirmUpload">确定上传</button>
          <button class="kb-btn danger" @click="cancelUpload">取消</button>
        </div>
      </div>
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
const searchQuery = ref("");

const breadcrumbSegments = computed(() =>
  currentPath.value ? currentPath.value.split("/").filter(Boolean) : []
);

const showUploadModal = ref(false); // 是否显示上传弹窗
const optimizeText = ref(false); // 勾选框状态
type PendingFile = {
  file: File;
  progress: number; // 0~100
  status: "pending" | "uploading" | "done" | "error";
};
const pendingFiles = ref<PendingFile[]>([]);
const uploadProgress = ref(0); // 上传进度，0~100
const isUploading = ref(false); // 是否正在上传

function itemKey(it: KBItem) {
  return currentPath.value + "/" + it.name;
}

function pathJoin(base: string, name: string) {
  return [base, name].filter(Boolean).join("/");
}

// 加载目录
async function loadDir(path = "") {
  try {
    const { data } = await axios.get("/api/kb/list", { params: { path } });
    items.value = data?.items || [];
  } catch (e) {
    // 占位数据
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
    download(it);
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

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  console.log("当前所在目录：", currentPath.value);
  // 判断是否选择了文件夹，获取文件夹路径
  // 取第一个文件的 webkitRelativePath
  const firstFile = input.files[0] as any;
  let topFolder = "";
  if (firstFile.webkitRelativePath) {
    // webkitRelativePath 示例: "MyFolder/sub1/file.txt"
    topFolder = firstFile.webkitRelativePath.split("/")[0];
  }
  console.log("选择的顶层文件夹：", topFolder);

  pendingFiles.value = Array.from(input.files).map((f) => ({
    file: f,
    progress: 0,
    status: "pending",
  }));

  showUploadModal.value = true;
  if (fileInput.value) fileInput.value.value = "";
}

async function confirmUpload() {
  // if (!optimizeText.value) {
  //   alert("请勾选“优化文本内容”再上传");
  //   return;
  // }
  if (!pendingFiles.value.length) return;

  for (const pf of pendingFiles.value) {
    pf.status = "uploading";

    const form = new FormData();
    console.log("file所在文件夹信息：", pf.file.webkitRelativePath);

    form.append("file", pf.file);
    form.append("path", currentPath.value);
    form.append("optimize", String(optimizeText.value));

    try {
      await axios.post("/api/vector/single-upload", form, {
        onUploadProgress: (event) => {
          if (event.total) {
            pf.progress = Math.round((event.loaded / event.total) * 100);
          }
        },
      });
      pf.status = "done";
    } catch (err) {
      pf.status = "error";
    }
  }

  await loadDir(currentPath.value);
  showUploadModal.value = false;
  pendingFiles.value = [];
}

function cancelUpload() {
  pendingFiles.value = [];
  showUploadModal.value = false;
}

// 下载文件
function download(item: KBItem) {
  if (item.type === "dir") return;
  const link = document.createElement("a");
  link.href = `/api/kb/download?path=${encodeURIComponent(
    pathJoin(currentPath.value, item.name)
  )}`;
  link.download = item.name;
  link.click();
}

// 删除文件或文件夹
function confirmDelete(item: KBItem) {
  if (!confirm(`确认删除 "${item.name}" 吗？`)) return;
  axios
    .post("/api/kb/delete", { path: pathJoin(currentPath.value, item.name) })
    .then(() => loadDir(currentPath.value))
    .catch((err) => alert("删除失败：" + err));
}

// 搜索
const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  return items.value.filter((it) => it.name.includes(searchQuery.value.trim()));
});

function doSearch() {
  // 这里可以留空，因为 filteredItems 已经根据 searchQuery 实时过滤
  // 如果你希望按回车或按钮触发重新加载，可在此处调用后端 API 搜索
  console.log("搜索关键词:", searchQuery.value);
}

onMounted(() => loadDir(""));
</script>

<style scoped>
.kb-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
}
.kb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.kb-left {
  display: flex;
  align-items: center;
  gap: 10px;
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
.kb-search input {
  padding: 4px 8px;
  font-size: 13px;
}
.kb-search button {
  margin-left: 4px;
  padding: 4px 8px;
  font-size: 13px;
}
.kb-actions .kb-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #333;
  color: #fff;
  cursor: pointer;
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
.modal-actions {
  display: flex;
  justify-content: space-between; /* 左右分开 */
  align-items: center;
  margin-top: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.buttons button {
  margin-left: 6px; /* 两个按钮之间小间距 */
}
.kb-btn.small {
  padding: 2px 6px;
  font-size: 12px;
  margin-right: 4px;
}
.kb-btn.danger {
  background-color: #e53935;
  color: #fff;
}
.kb-list {
  flex: 1;
  overflow: auto;
}
.upload-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 700px;
}

.progress-container {
  position: relative;
  background: #eee;
  border-radius: 6px;
  height: 20px;
  margin-top: 12px;
  overflow: hidden;
}
.progress-bar {
  background: #0070f3;
  height: 100%;
  transition: width 0.2s;
}
.progress-container span {
  position: absolute;
  right: 8px;
  top: 0;
  font-size: 12px;
  line-height: 20px;
  color: #fff;
}

.file-list {
  margin: 10px 0;
  list-style: none;
  padding: 0;
}
.file-list li {
  margin-bottom: 8px;
}
.progress-container {
  position: relative;
  background: #eee;
  border-radius: 6px;
  height: 16px;
  overflow: hidden;
  margin-top: 4px;
}
.progress-bar {
  background: #0070f3;
  height: 100%;
  transition: width 0.2s;
}
.progress-container span {
  position: absolute;
  right: 6px;
  top: 0;
  font-size: 12px;
  line-height: 16px;
  color: #fff;
}
</style>
