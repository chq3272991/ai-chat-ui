import { createRouter, createWebHistory } from 'vue-router'
import ChatPage from '../views/ChatPage.vue'
import KnowledgeBase from '../views/KnowledgeBase.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import { useUserStore } from "@/stores/user";

const routes = [
    { path: "/login", name: "Login", component: Login },
    { path: "/register", name: "Register", component: Register },
    { path: '/', name: 'chat', component: ChatPage },
    { path: '/kb', name: 'knowledge-base', component: KnowledgeBase }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// 全局路由守卫
router.beforeEach((to, _from, next) => {

    const userStore = useUserStore();

    // 登录页和注册页不检查登录
    if (to.path === "/login" || to.path === "/register") {
        next();
        return;
    }

    // 其他页面必须登录
    if (!userStore.isLoggedIn) {
        next("/login");
    } else {
        next();
    }

});


export default router
