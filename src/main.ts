import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// 引入 Element Plus 主库
import ElementPlus from 'element-plus'
// 引入 Element Plus 样式
import 'element-plus/dist/index.css'
import router from './router'   // 引入 router
import axios from "axios";


import "./views/style/chatPage.css";
import "./views/style/common.css";



axios.defaults.baseURL = "/api";

axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        // console.log("打印 token： " + token)
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        // console.log("打印 config:", config)
        return config;
    },
    (error) => Promise.reject(error)
);

const app = createApp(App)
// 全局注册 Element Plus
app.use(ElementPlus)
app.use(createPinia())
app.use(router)   // ✅ 这里要挂载 router
app.mount('#app')