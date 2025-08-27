import { createRouter, createWebHistory } from 'vue-router'
import ChatPage from '../views/ChatPage.vue'
import KnowledgeBase from '../views/KnowledgeBase.vue'

const routes = [
    { path: '/', name: 'chat', component: ChatPage },
    { path: '/kb', name: 'knowledge-base', component: KnowledgeBase }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
