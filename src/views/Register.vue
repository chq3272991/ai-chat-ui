<template>
  <div class="auth-container">
    <el-card class="auth-card">
      <h2>注册</h2>
      <el-form
        :model="form"
        :rules="rules"
        ref="registerFormRef"
        label-width="80px"
        @submit.prevent="handleRegister"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input type="password" v-model="form.password" placeholder="请输入密码" />
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            type="password"
            v-model="form.confirmPassword"
            placeholder="请再次输入密码"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleRegister">注册</el-button>
          <router-link to="/login" class="switch-link">已有账号？去登录</router-link>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { ElMessage, FormInstance } from "element-plus";

const router = useRouter();
const userStore = useUserStore();
const registerFormRef = ref<FormInstance>();

const form = reactive({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
});

// 校验规则
const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    {
      pattern: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/,
      message: "用户名只能包含汉字、字母、数字",
      trigger: "blur",
    },
  ],
  email: [
    { required: true, message: "请输入邮箱", trigger: "blur" },
    {
      type: "email",
      message: "邮箱格式不正确",
      trigger: "blur",
    },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码长度不能小于6位", trigger: "blur" },
  ],
  confirmPassword: [
    { required: true, message: "请再次输入密码", trigger: "blur" },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== form.password) {
          callback(new Error("两次输入密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

async function handleRegister() {
  if (!registerFormRef.value) return;

  registerFormRef.value.validate(async (valid) => {
    if (!valid) return;

    try {
      await userStore.registerApi(form.username, form.password, form.email);
      ElMessage.success("注册成功，请登录");
      router.push("/login");
    } catch (err: any) {
      ElMessage.error(err.message);
    }
  });
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
.switch-link {
  margin-left: 10px;
  font-size: 13px;
  color: #409eff;
}
</style>

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
.switch-link {
  margin-left: 10px;
  font-size: 13px;
  color: #409eff;
}
</style>
