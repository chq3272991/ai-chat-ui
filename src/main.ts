import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'   // 引入 router

import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)   // ✅ 这里要挂载 router
app.mount('#app')
