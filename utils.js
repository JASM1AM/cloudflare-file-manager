export function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'pdf': '📄', 'doc': '📄', 'docx': '📄',
    'xls': '📊', 'xlsx': '📊', 'ppt': '📽️', 'pptx': '📽️',
    'zip': '📦', 'rar': '📦', '7z': '📦',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
    'mp3': '🎵', 'wav': '🎵',
    'txt': '📝', 'md': '📝'
  };
  return icons[ext] || '📄';
}

export function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
  const textTypes = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js'];
  const pdfTypes = ['pdf'];
  
  if (imageTypes.includes(ext)) return '图片';
  if (textTypes.includes(ext)) return '文本';
  if (pdfTypes.includes(ext)) return 'PDF';
  return '其他';
}

export function isDownloadRequest(request, url) {
  return request.method === "GET" && url.pathname !== "/" && !url.pathname.startsWith('/preview/');
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildErrorResponse(error) {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>错误</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; color: #334155; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .error-container { text-align: center; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .error-icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #dc2626; margin-bottom: 16px; }
        .home-link { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; transition: all 0.3s; }
        .home-link:hover { background: #4f46e5; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1>发生错误</h1>
        <p>${escapeHtml(error.message)}</p>
        <a href="/" class="home-link">返回首页</a>
      </div>
    </body>
    </html>
  `, { status: 500, headers: { "Content-Type": "text/html" } });
}
