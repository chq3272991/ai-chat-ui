<style scoped>
@import "./style/common.css";
@import "./style/knowledgeBase.css";
</style>

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
        <button class="kb-btn primary" @click="openFolderModel">
          <FolderPlus size="16" />
          新建文件夹
        </button>

        <button class="kb-btn success" @click="triggerFileSelect">
          <Upload size="16" />
          上传文件
        </button>
        <input
          type="file"
          ref="fileInput"
          style="display: none"
          multiple
          @change="onUpload"
        />

        <button class="kb-btn success" @click="triggerFolderSelect">
          <FolderUp size="16" />
          上传文件夹
        </button>
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
          <tr v-if="currentPath" class="kb-row kb-up-row" @click="goUp">
            <td colspan="5">⬆️ 返回上级 ..</td>
          </tr>
          <tr v-for="item in filteredItems" :key="itemKey(item)" class="kb-row">
            <td
              @click="item.type === 'dir' && open(item)"
              style="cursor: pointer; display: flex; align-items: center; gap: 6px"
            >
              <component :is="getFileIcon(item)" style="width: 16px; height: 16px" />
              <span>{{ item.fileName }}</span>
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
        <div>
          <label class="checkbox-label">
            <input type="checkbox" v-model="optimizeText" />
            优化内容
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="rewriteText" />
            允许覆盖
          </label>
        </div>

        <div class="buttons">
          <button class="kb-btn primary" @click="confirmUpload">确定上传</button>
          <button class="kb-btn" @click="cancelUpload">取消</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 删除确认弹窗 -->
  <div v-if="showDeleteModal" class="upload-modal">
    <div class="modal-content-mid">
      <h3>确认删除</h3>
      <p>确定要删除 "{{ deleteTarget?.fileName }}" 吗？</p>

      <input
        type="text"
        v-model="deleteConfirmInput"
        placeholder="请输入文件/文件夹名称确认"
        class="kb-input"
      />

      <p
        v-if="deleteConfirmInput && deleteConfirmInput !== deleteTarget?.fileName"
        class="error-msg"
      >
        输入不一致，请正确输入文件/文件夹名称
      </p>

      <div class="modal-actions">
        <label class="checkbox-label">
          <input type="checkbox" v-model="deleteVector" />
          同时删除向量库内容
        </label>

        <div class="buttons">
          <button class="kb-btn danger" @click="doDelete" :disabled="!canDelete">
            确认删除
          </button>
          <button class="kb-btn" @click="cancelDelete">取消</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 新建文件夹弹窗 -->
  <div v-if="showCreateFolderModal" class="upload-modal">
    <div class="modal-content-mid">
      <h3>新建文件夹</h3>

      <input
        type="text"
        v-model="createFolderName"
        placeholder="请输入文件夹名称"
        class="kb-input"
      />

      <p
        v-if="createFolderFailMsg !== ''"
        class="error-msg"
        v-html="createFolderFailMsg"
      ></p>

      <div class="modal-actions">
        <div></div>
        <div class="buttons">
          <button class="kb-btn primary" @click="createFolder">确认创建</button>
          <button class="kb-btn" @click="cancelCreateFolder">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  FolderPlus,
  Upload,
  FolderUp,
  Folder,
  File, // 默认文件图标
  FileIcon, // 可选备用
  FileText, // 文本文件.txt
  FileJson, // JSON 文件
  FileImage, // 图片
  FileVideo, // 视频
  FileAudio, // 音频
  FileMinus, // 其他文件
} from "lucide-vue-next";

import { computed, onMounted, ref } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";

type KBItem = {
  id: string;
  fileName: string;
  type: "dir" | "file";
  fileSuffix: string;
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
const rewriteText = ref(false);
type PendingFile = {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
};
const pendingFiles = ref<PendingFile[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
// 是否删除向量库内容（删除弹窗用）
const deleteVector = ref(true);
const showDeleteModal = ref(false);

const deleteTarget = ref<KBItem | null>(null);
const deleteConfirmInput = ref("");
const canDelete = computed(() => {
  return deleteConfirmInput.value === deleteTarget.value?.fileName;
});

const showCreateFolderModal = ref(false);
const createFolderName = ref("");
const createFolderFailMsg = ref("");

// 下载进度
// const downloading = ref(false);
// const downloadProgress = ref(0);

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

async function loadDir(filePath = "", keyword = "") {
  try {
    const { data } = await axios.get("/file/list", { params: { filePath, keyword } });
    items.value = data?.data || []; // 直接取 data
    console.log("文件夹和文件列表", items.value);
  } catch (e) {
    items.value = [];
  }
}

function open(it: KBItem) {
  if (it.type === "dir") {
    currentPath.value = pathJoin(currentPath.value, it.fileName);
    loadDir(currentPath.value, "");
  } else {
    download(it);
  }
}

function goUp() {
  if (!currentPath.value) return;
  const parts = currentPath.value.split("/").filter(Boolean);
  parts.pop();
  currentPath.value = parts.join("/");
  loadDir(currentPath.value, "");
}

function goRoot() {
  currentPath.value = "";
  loadDir("");
}

function goToIndex(idx: number) {
  const parts = currentPath.value.split("/").filter(Boolean);
  currentPath.value = parts.slice(0, idx + 1).join("/");
  loadDir(currentPath.value, "");
}

function openFolderModel() {
  showCreateFolderModal.value = true;
  createFolderName.value = "";
}
async function createFolder() {
  console.log("新建文件夹:", createFolderName.value);
  try {
    const response = await axios.post("/file/folder", {
      folderName: createFolderName.value,
      dirPath: currentPath.value, // 当前路径下创建
    });
    // 解析响应数据
    const result = response.data;
    if (result.success) {
      // 处理成功情况
      console.log("文件夹创建成功:", result.message);
      // 可以在这里添加成功提示，如弹框提示用户
      // alert(result.message);
      showCreateFolderModal.value = false;
      createFolderName.value = "";
      // 通常这里还需要刷新文件列表，显示新创建的文件夹
      loadDir(currentPath.value, "");
    } else {
      // 处理业务逻辑失败情况（如已存在同名文件夹）
      console.error("创建文件夹失败:", result.message);
      createFolderFailMsg.value = result.message;
      // 显示错误信息给用户
      // alert(result.message);
    }
  } catch (err) {
    // 处理网络错误或服务器异常
    console.error("创建文件夹请求失败:", err);
    createFolderFailMsg.value = "网络错误，创建文件夹失败";
  }
}

function onUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  console.log("当前所在目录：", currentPath.value);

  // 判断是否选择了文件夹（通过 webkitRelativePath 判断）
  const firstFile = input.files[0] as any;
  let topFolder = "";
  // webkitRelativePath 示例: "MyFolder/sub1/file.txt"
  topFolder = firstFile.webkitRelativePath.split("/")[0];
  console.log("选择的顶层文件夹：", topFolder);

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
      await axios.post("/file/folder", {
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
    form.append("lastModified", String(pf.file.lastModified)); // 时间戳
    form.append("path", currentPath.value);
    form.append("optimize", String(optimizeText.value));
    form.append("rewrite", String(rewriteText.value));

    try {
      const response = await axios.post("/vector/single-upload", form, {
        onUploadProgress: (event) => {
          if (event.total) {
            pf.progress = Math.round((event.loaded / event.total) * 100);
          }
        },
      });
      // 处理接口响应
      const { success, message } = response.data;
      if (success) {
        pf.status = "done";
        // 可添加成功提示，如：ElMessage.success(`${pf.file.name} 上传成功`);
      } else {
        pf.status = "error";
        // 接口返回成功标识为false的情况
        console.error(`上传失败: ${message}`);
        // 可添加错误提示，如：ElMessage.error(`${pf.file.name} 上传失败: ${message}`);
        ElMessage.error(`${pf.file.name} 上传失败: ${message}`);
      }
    } catch (err) {
      pf.status = "error";
      // 提示错误信息
      // 解析错误信息
      let errorMsg = "上传失败，请重试";
      console.error(`文件 ${pf.file.name} 上传错误: ${errorMsg}`);
      // 可添加错误提示，如：ElMessage.error(`${pf.file.name}: ${errorMsg}`);
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

async function download(item: KBItem) {
  try {
    const response = await axios.get(`/file/download?id=${item.id}`, {
      responseType: "blob",
      onDownloadProgress: (e) => {
        if (e.lengthComputable) {
          // 改为 lengthComputable 判断
          console.log("打印下载进度：", Math.round((e.loaded / e.total) * 100));
        }
      },
      validateStatus: () => true, // 即使非 2xx 也返回
    });

    const contentType = response.headers["content-type"];
    if (!contentType?.includes("application/octet-stream")) {
      const text = await blobToText(response.data);
      ElMessage.error(text);
      return;
    }

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
  } finally {
  }
}

function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob, "utf-8");
  });
}

function confirmDelete(item: KBItem) {
  deleteTarget.value = item;
  deleteVector.value = true; // 默认勾选
  showDeleteModal.value = true;
  deleteConfirmInput.value = "";
}

function cancelDelete() {
  deleteTarget.value = null;
  showDeleteModal.value = false;
  deleteConfirmInput.value = "";
}

async function doDelete() {
  if (!deleteTarget.value) return;
  try {
    await axios.post("/file/delete", {
      id: deleteTarget.value.id,
      removeVector: deleteVector.value, // ✅ 根据勾选传参
    });
    await loadDir(currentPath.value, "");
  } catch (err) {
    alert("删除失败：" + err);
  } finally {
    showDeleteModal.value = false;
    deleteTarget.value = null;
    deleteConfirmInput.value = "";
  }
}

function cancelCreateFolder() {
  showCreateFolderModal.value = false;
  createFolderName.value = "";
  createFolderFailMsg.value = "";
}

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  return items.value.filter((it) => it.fileName.includes(searchQuery.value.trim()));
});

function doSearch() {
  console.log("搜索关键词:", searchQuery.value);
  // 更新列表接口
  loadDir(currentPath.value, searchQuery.value);
}

function getFileIcon(item: KBItem) {
  if (item.type === "dir") return Folder;

  const suffix = item.fileSuffix?.toLowerCase();
  console.log(suffix);
  switch (suffix) {
    case "txt":
    case "doc":
    case "docx":
    case "pdf":
      return FileText;
    case "json":
      return FileJson;
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "bmp":
      return FileImage;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return FileVideo;
    case "mp3":
    case "wav":
    case "flac":
      return FileAudio;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return FileMinus;
    default:
      return FileMinus; // 其他文件
  }
}

onMounted(() => loadDir("", ""));
</script>
