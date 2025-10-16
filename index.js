import { handleRequest, isDownloadRequest } from './file-handlers.js';
import { handleLogin, isAuthenticated, showLoginPage } from './auth.js';

export default {
  async fetch(request, env) {
    const { MY_BUCKET: bucket, ACCESS_PASSWORD: password } = env;
    const url = new URL(request.url);
    
    if (!password) {
      return handleRequest(request, bucket, url);
    }

    if (url.pathname.startsWith("/preview/")) {
      return await handleFilePreview(bucket, url);
    }

    const isFileDownload = isDownloadRequest(request, url);
    if (isFileDownload) {
      return handleRequest(request, bucket, url);
    }

    if (url.pathname === "/login" && request.method === "POST") {
      return await handleLogin(request, password);
    }

    const isLoggedIn = isAuthenticated(request, password);
    
    if (!isLoggedIn) {
      return showLoginPage(request, "请先登录", false);
    }

    return handleRequest(request, bucket, url);
  },
};
