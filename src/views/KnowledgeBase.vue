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
      <div>
        <!-- 选择文件 -->
        <button @click="triggerFileSelect">选择文件</button>
        <input
          type="file"
          ref="fileInput"
          style="display: none"
          multiple
          @change="onUpload"
        />

        <!-- 选择文件夹 -->
        <button @click="triggerFolderSelect">选择文件夹</button>
        <input
          type="file"
          ref="folderInput"
          style="display: none"
          webkitdirectory
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
              <span v-if="item.type === 'dir'">📁 {{ item.fileName }}</span>
              <span v-else>📄 {{ item.fileName }}</span>
            </td>
            <td>{{ item.type }}</td>
            <td>{{ item.fileSize ?? "-" }}</td>
            <td>{{ item.createTime ?? "-" }}</td>
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

  <!-- 上传弹窗 -->
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
  id: string;
  fileName: string;
  type: "dir" | "file";
  fileSize?: number;
  createTime?: string;
  updateTime?: string;
  filePath?: string;
};

const items = ref<KBItem[]>([]);
const currentPath = ref("");
const searchQuery = ref("");

const breadcrumbSegments = computed(() =>
  currentPath.value ? currentPath.value.split("/").filter(Boolean) : []
);

const showUploadModal = ref(false);
const optimizeText = ref(false);
type PendingFile = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
};
const pendingFiles = ref<PendingFile[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);

function triggerFileSelect() {
  fileInput.value?.click();
}

function triggerFolderSelect() {
  folderInput.value?.click();
}

function itemKey(it: KBItem) {
  return currentPath.value + "/" + it.fileName;
}

function pathJoin(base: string, name: string) {
  return [base, name].filter(Boolean).join("/");
}

async function loadDir(filePath = "") {
  try {
    const { data } = await axios.get("/api/file/list", { params: { filePath } });
    items.value = data?.data || []; // 直接取 data
    console.log("文件夹和文件列表", items.value);
  } catch (e) {
    items.value = [
      {
        id: "1",
        fileName: "docs",
        type: "dir",
        createTime: "2025-01-01T10:00:00",
      },
      {
        id: "2",
        fileName: "readme.md",
        type: "file",
        fileSize: 3.2 * 1024, // KB 转字节
        createTime: "2025-01-05T09:12:00",
      },
    ];
  }
}

function open(it: KBItem) {
  if (it.type === "dir") {
    currentPath.value = pathJoin(currentPath.value, it.fileName);
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

/** 单按钮，支持文件 + 文件夹上传 */
function triggerUpload() {
  const input = fileInput.value!;
  input.value = ""; // 清空上次选择
  input.setAttribute("multiple", ""); // 支持多文件
  input.setAttribute("webkitdirectory", ""); // 同时允许选文件夹
  input.click();
}

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  console.log("当前所在目录：", currentPath.value);

  // 判断是否选择了文件夹（通过 webkitRelativePath 判断）
  const firstFile = input.files[0] as any;
  let topFolder = "";
  if (firstFile.webkitRelativePath) {
    // webkitRelativePath 示例: "MyFolder/sub1/file.txt"
    topFolder = firstFile.webkitRelativePath.split("/")[0];
    console.log("选择的顶层文件夹：", topFolder);
    // 调用创建文件夹的接口 /file/folder
    createFolderApi(topFolder);
  }

  pendingFiles.value = Array.from(input.files).map((f) => ({
    file: f,
    progress: 0,
    status: "pending",
  }));

  showUploadModal.value = true;

  // 重置 input，避免多次选择同一文件不触发 change
  input.value = "";
}

// 模拟 API 调用
async function createFolderApi(folderName: string) {
  console.log("调用 /file/folder 接口创建文件夹:", folderName);
  // 这里可以用 axios/fetch 调用实际接口
  if (folderName) {
    try {
      await axios.post("/api/file/folder", {
        folderName: folderName,
        dirPath: currentPath.value, // 当前路径下创建
      });
      console.log("文件夹创建成功:", folderName);
    } catch (err) {
      console.error("创建文件夹失败:", err);
      return; // 失败直接返回，避免继续上传
    }
  }
}

async function confirmUpload() {
  if (!pendingFiles.value.length) return;

  for (const pf of pendingFiles.value) {
    pf.status = "uploading";

    const form = new FormData();
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

function download(item: KBItem) {
  if (item.type === "dir") return;
  const link = document.createElement("a");
  link.href = `/api/kb/download?path=${encodeURIComponent(
    pathJoin(currentPath.value, item.fileName)
  )}`;
  link.download = item.fileName;
  link.click();
}

function confirmDelete(item: KBItem) {
  if (!confirm(`确认删除 "${item.fileName}" 吗？`)) return;
  axios
    .post("/api/kb/delete", { path: pathJoin(currentPath.value, item.fileName) })
    .then(() => loadDir(currentPath.value))
    .catch((err) => alert("删除失败：" + err));
}

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  return items.value.filter((it) => it.fileName.includes(searchQuery.value.trim()));
});

function doSearch() {
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
