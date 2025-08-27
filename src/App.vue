<template>
  <div class="flex flex-col h-screen">
    <!-- 极简 header -->
    <header class="flex items-center px-2 py-1 border-b flex-shrink-0 bg-white">
      <nav class="flex gap-1">
        <router-link to="/" class="tab-btn">对话框</router-link>
        <router-link to="/kb" class="tab-btn">知识库</router-link>
      </nav>
    </header>

    <!-- 路由内容区域，占满剩余空间 -->
    <main class="flex-1 overflow-auto min-h-0">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// 顶层只做导航容器
</script>

<style scoped>
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
</style>
