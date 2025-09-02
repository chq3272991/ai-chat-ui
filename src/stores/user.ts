// src/stores/user.ts
import { defineStore } from "pinia";
import axios from "axios";

export const useUserStore = defineStore("user", {
    state: () => ({
        token: localStorage.getItem("token") || "",
        username: localStorage.getItem("username") || "",
    }),
    getters: {
        isLoggedIn: (state) => !!state.token,
    },
    actions: {
        /**
         * 登录
         */
        async loginApi(username: string, password: string) {
            try {
                const res = await axios.post("/api/user/login", {
                    username,
                    password,
                }, {
                    headers: { "Content-Type": "application/json" },
                });

                if (res.data.success && res.data.data) {
                    this.token = res.data.data; // token 在 data
                    this.username = username;
                    localStorage.setItem("token", this.token);
                    localStorage.setItem("username", this.username);
                    return true;
                } else {
                    throw new Error(res.data.message || "登录失败");
                }
            } catch (err: any) {
                throw new Error(err.message || "网络错误");
            }
        },

        /**
         * 注册
         */
        async registerApi(username: string, password: string, email: string) {
            try {
                const res = await axios.post("/api/user/register", {
                    username,
                    password,
                    email,
                }, {
                    headers: { "Content-Type": "application/json" },
                });

                if (res.data.success && res.data.data) {
                    return true; // 注册成功
                } else {
                    throw new Error(res.data.message || "注册失败");
                }
            } catch (err: any) {
                throw new Error(err.message || "网络错误");
            }
        },

        logout() {
            this.token = "";
            this.username = "";
            localStorage.removeItem("token");
            localStorage.removeItem("username");
        },
    },
});
