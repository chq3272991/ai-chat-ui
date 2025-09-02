<template>
  <div class="auth-container">
    <el-card class="auth-card">
      <h2>登录</h2>
      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item label="用户">
          <el-input v-model="form.username" placeholder="请输入用户名/邮箱" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input type="password" v-model="form.password" placeholder="请输入密码" />
        </el-form-item>

        <!-- 登录按钮居中 -->
        <el-form-item class="login-button-item">
          <div class="form-actions">
            <el-button type="primary" @click="handleLogin">登录</el-button>
            <router-link to="/register" class="switch-link">没有账号？去注册</router-link>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { ElMessage } from "element-plus";

const router = useRouter();
const userStore = useUserStore();

const form = reactive({
  username: "",
  password: "",
});

async function handleLogin() {
  if (form.username && form.password) {
    // TODO: 调用后端登录接口
    try {
      await userStore.loginApi(form.username, form.password);
      ElMessage.success("登录成功");
      router.push("/");
    } catch (err: any) {
      ElMessage.error(err.message);
    }
  } else {
    alert("请输入用户名和密码");
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 90vh;
  background: #f8f9fa;
}

.auth-card {
  width: 360px;
  padding: 20px;
}

/* 移除表单项的默认边距，确保居中不受影响 */
.login-button-item {
  margin: 0 !important;
  padding: 0 !important;
  display: flex;
  justify-content: center;
}

/* 登录按钮居中样式 */
.form-actions {
  display: flex;
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  gap: 10px; /* 按钮和链接间距 */
  width: 100%; /* 确保占满父容器宽度 */
}

.switch-link {
  font-size: 13px;
  color: #409eff;
}
</style>
