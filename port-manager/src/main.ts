import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");

// 主题同步：优先读 localStorage（与主应用同源时有值），
// 否则回退到系统媒体查询
const syncTheme = () => {
  const theme = localStorage.getItem("unihub-theme");
  const isDark =
    theme === "dark" ||
    ((!theme || theme === "system") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
};

syncTheme();

// 监听主应用广播的主题变化（WebContentsView IPC）
if (window.electron?.ipcRenderer) {
  window.electron.ipcRenderer.on("theme-changed", (_event: unknown, ...args: unknown[]) => {
    const theme = args[0] as "light" | "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  });
}

// 监听系统主题变化（当用户设置为 system 时）
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const theme = localStorage.getItem("unihub-theme");
  if (!theme || theme === "system") syncTheme();
});
