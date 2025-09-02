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

      <!-- 右侧登录状态 -->
      <div v-if="isLoggedIn" class="flex items-center gap-2">
        <span>{{ username }}</span>
        <el-button type="text" @click="logout" class="logout-btn">[退出]</el-button>
      </div>
    </header>

    <!-- 路由内容区域，占满剩余空间 -->
    <main class="flex-1 overflow-auto min-h-0">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useUserStore } from "@/stores/user";
import { useRouter, useRoute } from "vue-router";

const userStore = useUserStore();
const router = useRouter();
const route = useRoute();

const isLoggedIn = computed(() => userStore.isLoggedIn);
const username = computed(() => userStore.username);

// 当在登录页或注册页时隐藏顶部导航
const showHeader = computed(() => !["/login", "/register"].includes(route.path));

function logout() {
  userStore.logout();
  router.push("/login");
}
</script>

<style scoped>
.header-container {
  display: flex;
  flex-direction: column;
  height: 5vh;
  margin: 0;
  padding: 0;
}

.header-p {
  padding: 0.25rem 0.5rem; /* 上下左右内边距 */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between; /* 左右分布 */
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

.logout-btn {
  margin-left: 5px;
}
</style>
