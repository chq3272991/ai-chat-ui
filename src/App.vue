<template>
  <div class="header-container">
    <!-- 极简 header -->
    <header
      v-if="showHeader"
      class="header-p flex items-center justify-between px-2 py-1 border-b bg-white"
    >
      <!-- 左侧导航 -->
      <nav class="flex gap-1">
        <router-link to="/" class="tab-btn">对话框</router-link>
        <router-link to="/kb" class="tab-btn">知识库</router-link>
      </nav>

      <!-- 右侧登录状态与模型选择 -->
      <div v-if="isLoggedIn" class="right-section">
        <!-- 模型选择下拉框：仅在对话框路由显示 -->
        <div class="model-selector" v-if="isDialogRoute">
          <select v-model="selectedModel" class="model-select">
            <option value="qwen3:4b">qwen3:4b</option>
            <option value="qwen3:8b">qwen3:8b</option>
            <option value="deepseek-r1:8b">deepseek-r1:8b</option>
          </select>
        </div>

        <span class="username">{{ username }}</span>
        <el-button type="text" @click="logout" class="logout-btn">[退出]</el-button>
      </div>
    </header>

    <!-- 路由内容区域 -->
    <main class="flex-1 overflow-auto min-h-0">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useUserStore } from "@/stores/user";
import { useRouter, useRoute } from "vue-router";
import { useChatStore } from "@/stores/chat";

const userStore = useUserStore();
const chatStore = useChatStore();
const router = useRouter();
const route = useRoute();

const isLoggedIn = computed(() => userStore.isLoggedIn);
const username = computed(() => userStore.username);
const selectedModel = ref(chatStore.model || "deepseek-r1:8b");

// 新增：判断当前是否为对话框路由（路径为"/"）
const isDialogRoute = computed(() => route.path === "/");

watch(selectedModel, (newModel) => {
  chatStore.model = newModel;
});

const showHeader = computed(() => !["/login", "/register"].includes(route.path));

function logout() {
  userStore.logout();
  router.push("/login");
}
</script>

<style scoped>
/* 样式保持不变 */
.header-container {
  display: flex;
  flex-direction: column;
  height: 5vh;
  margin: 0;
  padding: 0;
}

.header-p {
  padding: 0.25rem 0.5rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tab-btn {
  padding: 2px 6px;
  font-size: 13px;
  text-decoration: none;
  color: #333;
  border-bottom: 2px solid transparent;
}

.tab-btn.router-link-active {
  border-bottom-color: #333;
  font-weight: 500;
}

.right-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.model-selector {
  font-size: 13px;
}

.model-select {
  padding: 2px 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background-color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.username {
  font-size: 13px;
}

.logout-btn {
  font-size: 13px;
  margin: 0;
  padding: 0 6px;
}
</style>
