import { defineConfig } from 'vite';

// GitHub Pages 可能部署在 https://<user>.github.io/<repo>/ 子路径下，
// 使用相对 base 可同时兼容用户主页仓库（<user>.github.io）与项目仓库。
export default defineConfig({
  base: './',
});
