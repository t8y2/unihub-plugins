import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");

// 同步主应用的深色模式
const syncTheme = () => {
  const theme = localStorage.getItem("unihub-theme");
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", isDark);
};

syncTheme();

// 监听 storage 变化实时切换主题
window.addEventListener("storage", (e) => {
  if (e.key === "unihub-theme") syncTheme();
});

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", syncTheme);
