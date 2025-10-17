export default {
  async fetch(request, env) {
    const bucket = env.MY_BUCKET;
    const url = new URL(request.url);
    const ACCESS_PASSWORD = env.ACCESS_PASSWORD;

    if (!ACCESS_PASSWORD) {
      return handleRequest(request, env, bucket, url);
    }

    if (url.pathname === "/login" && request.method === "POST") {
      return await handleLogin(request, ACCESS_PASSWORD);
    }

    if (!isAuthenticated(request, ACCESS_PASSWORD) && url.pathname !== "/login") {
      return showLoginPage(request, "请先登录", false);
    }

    return handleRequest(request, env, bucket, url);
  },
};

function isAuthenticated(request, password) {
  const cookies = request.headers.get("Cookie") || "";
  return cookies.includes(`access_token=${password}`);
}

function showLoginPage(request, errorMsg = "", failed = false) {
  const html = buildLoginPage(errorMsg);
  const headers = { "Content-Type": "text/html" };
  if (failed) headers["Cache-Control"] = "no-store";
  return new Response(html, { status: failed ? 401 : 200, headers });
}

async function handleLogin(request, correctPassword) {
  const formData = await request.formData();
  const password = formData.get("password");

  if (password === correctPassword) {
    const headers = new Headers();
    headers.set("Location", "/");
    headers.set(
      "Set-Cookie",
      `access_token=${correctPassword}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`
    );
    return new Response(null, { status: 302, headers });
  } else {
    return showLoginPage(request, "密码错误", true);
  }
}

async function handleRequest(request, env, bucket, url) {
  const pathname = url.pathname;

  try {
    if (pathname === "/" && request.method === "GET") {
      return await handleFileList(bucket, url);
    } else if (request.method === "GET" && pathname !== "/") {
      return await handleFileDownload(bucket, url);
    } else if (pathname === "/upload" && request.method === "POST") {
      return await handleFileUploadWithProgress(request, bucket);
    } else if (pathname === "/delete" && request.method === "POST") {
      return await handleFileDelete(bucket, request);
    }
  } catch (error) {
    return buildErrorResponse(error);
  }

  return new Response("Not Found", { status: 404 });
}

async function handleFileList(bucket, url) {
  try {
    const listResult = await bucket.list();
    let objects = (listResult.objects || [])
      .filter((o) => o.key)
      .map(normalizeFileObject);

    const search = url.searchParams.get("search") || "";
    if (search) {
      objects = objects.filter((obj) =>
        obj.key.toLowerCase().includes(search.toLowerCase())
      );
    }

    const sortBy = url.searchParams.get("sort") || "name";
    const order = url.searchParams.get("order") || "asc";
    objects.sort((a, b) => {
      let x, y;
      if (sortBy === "name") {
        x = a.key.toLowerCase();
        y = b.key.toLowerCase();
      } else if (sortBy === "size") {
        x = a.size;
        y = b.size;
      } else if (sortBy === "date") {
        x = (a.uploaded || 0);
        y = (b.uploaded || 0);
      }
      return order === "asc" ? (x > y ? 1 : -1) : (x < y ? 1 : -1);
    });

    const html = renderEnhancedFileListPage(objects, url);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=UTF-8" },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}

function normalizeFileObject(obj) {
  return {
    key: obj.key || "",
    size: obj.size || 0,
    uploaded: obj.uploaded || new Date().toISOString(),
  };
}

async function handleFileDownload(bucket, url) {
  const key = decodeURIComponent(url.pathname.slice(1));
  const object = await bucket.get(key);
  if (!object) return new Response("文件不存在", { status: 404 });

  const headers = new Headers();
  if (object.writeHttpMetadata) object.writeHttpMetadata(headers);
  headers.set("Content-Length", (object.size || 0).toString());
  headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(key)}`);
  return new Response(object.body, { headers });
}

async function handleFileUploadWithProgress(request, bucket) {
  const formData = await request.formData();
  const files = formData.getAll("file");
  if (!files.length) return new Response(JSON.stringify({ error: "未选择文件" }), { status: 400 });

  const results = [];
  for (const file of files) {
    try {
      await bucket.put(file.name, file.stream());
      results.push({ name: file.name, success: true });
    } catch (err) {
      results.push({ name: file.name, success: false, error: err.message });
    }
  }
  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleFileDelete(bucket, request) {
  const formData = await request.formData();
  const fileKeys = formData.getAll("fileKey");
  if (!fileKeys.length) {
    return new Response(JSON.stringify({ error: "未选择文件" }), { status: 400 });
  }

  const results = [];
  for (const key of fileKeys) {
    try {
      await bucket.delete(key);
      results.push({ key, success: true });
    } catch (err) {
      results.push({ key, success: false, error: err.message });
    }
  }
  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
}

function renderEnhancedFileListPage(objects, url) {
  const stats = {
    count: objects.length,
    size: objects.reduce((sum, o) => sum + o.size, 0),
  };

  const searchParams = new URLSearchParams(url.searchParams);
  const currentSearch = searchParams.get("search") || "";
  const currentSort = searchParams.get("sort") || "name";
  const currentOrder = searchParams.get("order") || "asc";

  const fileItems = objects.length > 0
    ? objects.map((file, index) => {
        const encodedKey = encodeURIComponent(file.key);
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.key);
        const isFolder = file.key.endsWith("/");
        const icon = isFolder ? "fa-folder" : (isImage ? "fa-image" : "fa-file");
        const display = isImage
          ? `<img src="/${encodedKey}" style="max-width: 60px; max-height: 60px; object-fit: cover; border-radius: 4px;" alt="preview" />`
          : `<i class="fas ${icon}" style="font-size: 1.5rem; color: var(--primary);"></i>`;

        return `
          <div class="file-item">
            <div class="file-checkbox">
              <input type="checkbox" name="fileKey" value="${encodeURIComponent(file.key)}" id="check-${index}" />
            </div>
            <div class="file-icon">${display}</div>
            <div class="file-name-cell">
              <a href="/${encodedKey}" class="file-name link">${escapeHtml(file.key)}</a>
            </div>
            <div class="file-size">${formatFileSize(file.size)}</div>
            <div class="file-date">${new Date(file.uploaded).toLocaleString('zh-CN')}</div>
            <div class="file-actions">
              <div class="actions-wrapper">
                <a href="/${encodedKey}" class="btn btn-primary btn-sm">下载</a>
                <form style="display: inline;" onsubmit="return deleteSingleFile('${escapeHtml(file.key)}')">
                  <input type="hidden" name="fileKey" value="${escapeHtml(file.key)}">
                  <button type="submit" class="btn btn-danger btn-sm">删除</button>
                </form>
              </div>
            </div>
          </div>
        `;
      }).join("")
    : `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-folder-open"></i></div>
        <h3>📁 暂无文件</h3>
        <p>上传您的第一个文件开始使用吧！</p>
      </div>
    `;

  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>☁️ 我的云存储</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
      :root {
        --primary: #6366f1;
        --primary-hover: #4f46e5;
        --danger: #ef4444;
        --text: #1f2937;
        --text-light: #6b7280;
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --border: #e5e7eb;
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --input-bg: #ffffff;
      }
      [data-theme="dark"] {
        --text: #f9fafb;
        --text-light: #9ca3af;
        --bg: #111827;
        --card-bg: #1f2937;
        --border: #374151;
        --input-bg: #374151;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Inter', sans-serif;
        background-color: var(--bg);
        color: var(--text);
        line-height: 1.6;
        transition: background-color 0.3s, color 0.3s;
      }
      .container { max-width: 1200px; margin: 0 auto; padding: 2rem 1rem; }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .header h1 {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--primary);
      }
      .theme-toggle {
        background: var(--card-bg);
        border: 1px solid var(--border);
        color: var(--text);
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
      }
      .upload-area {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
      }
      .controls {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
      }
      .search-box {
        flex: 1;
        min-width: 200px;
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--text);
      }
      .sort-select {
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--input-bg);
        color: var(--text);
      }
      .file-list {
        background: var(--card-bg);
        border-radius: 12px;
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
        overflow: hidden;
      }
      .file-list-header {
        display: grid;
        grid-template-columns: 0.3fr 3fr 1fr 1fr 1fr;
        gap: 1rem;
        padding: 1rem;
        font-weight: 600;
        background: #f9fafb;
        border-bottom: 1px solid var(--border);
        align-items: center;
      }
      [data-theme="dark"] .file-list-header {
        background: #374151;
      }
      .file-item {
        display: grid;
        grid-template-columns: 0.3fr 3fr 1fr 1fr 1fr 1fr;
        gap: 1rem;
        padding: 1rem;
        align-items: center;
        border-bottom: 1px solid var(--border);
        transition: background-color 0.15s;
      }
      .file-item:hover {
        background-color: #f9fafb;
      }
      [data-theme="dark"] .file-item:hover {
        background-color: #374151;
      }
      .file-item:last-child { border-bottom: none; }
      .file-checkbox {
        display: flex;
        justify-content: center;
      }
      .file-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .file-name-cell { 
        min-width: 0;
      }
      .file-name {
        font-weight: 500;
        color: var(--text);
        word-break: break-all;
        overflow-wrap: break-word;
      }
      .file-name.link {
        text-decoration: none;
        color: var(--primary);
      }
      .file-name.link:hover {
        text-decoration: underline;
      }
      .file-size, .file-date {
        color: var(--text-light);
        font-size: 0.9rem;
      }
      .file-actions {
        min-width: 120px;
        display: flex;
        justify-content: flex-end;
      }
      .actions-wrapper {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .btn {
        padding: 0.4rem 0.8rem;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        border: 1px solid transparent;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .btn-sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
      .btn-primary {
        background: var(--primary);
        color: white;
        border-color: var(--primary);
      }
      .btn-primary:hover {
        background: var(--primary-hover);
      }
      .btn-danger {
        background: var(--danger);
        color: white;
        border-color: var(--danger);
      }
      .btn-danger:hover {
        background: #dc2626;
      }
      .link { color: var(--primary); }
      .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-light);
      }
      .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        color: var(--border);
      }
      .bulk-actions {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1rem;
        margin-bottom: 1rem;
        box-shadow: var(--shadow);
        border: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .bulk-actions button {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s;
      }
      .bulk-delete-btn {
        background: var(--danger);
        color: white;
        border-color: var(--danger);
      }
      .bulk-delete-btn:hover:not(:disabled) {
        background: #dc2626;
      }
      .bulk-delete-btn:disabled {
        background: var(--border);
        color: var(--text-light);
        cursor: not-allowed;
        border-color: var(--border);
      }

      /* 移动端优化 */
      @media (max-width: 768px) {
        .container {
          padding: 1rem 0.5rem;
        }
        
        .header {
          flex-direction: column;
          text-align: center;
          gap: 0.5rem;
        }
        
        .header h1 {
          font-size: 1.5rem;
        }
        
        .controls {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }
        
        .search-box,
        .sort-select {
          min-width: unset;
          width: 100%;
        }
        
        .file-list-header {
          display: none;
        }
        
        .file-item {
          grid-template-columns: 1fr;
          gap: 0.75rem;
          padding: 1rem;
          align-items: flex-start;
        }
        
        .file-checkbox {
          justify-content: flex-start;
          margin-right: 0.5rem;
          margin-left: 0.5rem;
          display: flex; /* 显示复选框 */
        }
        
        .file-item > div {
          width: 100%;
        }
        
        .file-name-cell {
          order: -2;
          min-width: unset;
        }
        
        .file-name {
          font-size: 1.1rem;
          word-break: break-word;
          margin-bottom: 0.5rem;
        }
        
        .file-icon {
          order: -1;
          font-size: 2rem;
          margin-bottom: 0.5rem;
          justify-content: flex-start;
        }
        
        .file-icon i {
          font-size: 2rem !important;
        }
        
        .file-icon img {
          max-width: 80px !important;
          max-height: 80px !important;
        }
        
        .file-size,
        .file-date {
          order: 1;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }
        
        .file-actions {
          order: 2;
          min-width: unset;
          justify-content: flex-start;
          margin-top: 0.5rem;
          width: 100%;
        }
        
        .actions-wrapper {
          justify-content: flex-start;
          width: 100%;
        }
        
        .btn {
          flex: 1;
          justify-content: center;
          min-width: 0;
        }
        
        .btn-sm {
          flex: 1;
        }
        
        .bulk-actions {
          flex-direction: column;
          gap: 0.75rem;
          align-items: stretch;
        }
        
        .bulk-actions button {
          width: 100%;
        }
        
        /* 移动端显示复选框 */
        .file-checkbox {
          display: flex;
        }
      }
      
      @media (max-width: 480px) {
        .file-item {
          padding: 0.75rem;
        }
        
        .btn {
          padding: 0.5rem;
          font-size: 0.8rem;
        }
        
        .btn-sm {
          padding: 0.4rem;
          font-size: 0.75rem;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>☁️ 我的云存储</h1>
        <button class="theme-toggle" onclick="toggleTheme()">🌙 切换主题</button>
      </div>

      <div class="upload-area">
        <form class="upload-form" id="uploadForm" enctype="multipart/form-data" method="POST" action="/upload">
          <input type="file" id="fileInput" name="file" multiple />
          <label for="fileInput" style="display: inline-block; background: var(--primary); color: white; padding: 0.7rem 1.2rem; border-radius: 6px; cursor: pointer; margin-bottom: 1rem;">📁 选择文件</label>
          <button type="submit" style="background: var(--primary); color: white; padding: 0.7rem 1.2rem; border-radius: 6px; cursor: pointer;">上传文件</button>
        </form>
      </div>

      <div class="controls">
        <input type="text" class="search-box" placeholder="🔍 搜索文件..." name="search" value="${currentSearch}" />
        <select class="sort-select" name="sort">
          <option value="name" ${currentSort === 'name' ? 'selected' : ''}>📝 名称</option>
          <option value="size" ${currentSort === 'size' ? 'selected' : ''}>📦 大小</option>
          <option value="date" ${currentSort === 'date' ? 'selected' : ''}>📅 修改时间</option>
        </select>
        <select class="sort-select" name="order">
          <option value="asc" ${currentOrder === 'asc' ? 'selected' : ''}>⬆️ 升序</option>
          <option value="desc" ${currentOrder === 'desc' ? 'selected' : ''}>⬇️ 降序</option>
        </select>
      </div>

      <div class="bulk-actions">
        <button type="button" class="btn btn-primary" onclick="toggleSelectAll()" style="margin-right: 1rem;">✅ 全选</button>
        <button type="button" class="btn bulk-delete-btn" id="bulkDeleteBtn" onclick="bulkDelete()" disabled>🗑️ 批量删除</button>
      </div>

      <div class="file-list">
        <div class="file-list-header">
          <div></div>
          <div>文件名</div>
          <div>大小</div>
          <div>修改时间</div>
          <div>操作</div>
        </div>
        ${fileItems}
      </div>
    </div>

    <script>
      function toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      }
      (function() {
        const html = document.documentElement;
        const saved = localStorage.getItem('theme') || 'light';
        html.setAttribute('data-theme', saved);
      })();

      document.getElementById('uploadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('fileInput');
        const files = fileInput.files;
        if (!files.length) {
          alert('请选择文件');
          return;
        }
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) formData.append('file', files[i]);
        const res = await fetch('/upload', { method: 'POST', body: formData });
        if (res.ok) {
          alert('上传成功');
          location.reload();
        } else {
          alert('上传失败');
        }
      });

      function toggleSelectAll() {
        const checkboxes = document.querySelectorAll('input[name="fileKey"]');
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        let checked = false;
        checkboxes.forEach(cb => {
          if (!checked) checked = !cb.checked;
          cb.checked = !cb.checked;
        });
        updateBulkDeleteButton();
      }

      function updateBulkDeleteButton() {
        const checkboxes = document.querySelectorAll('input[name="fileKey"]:checked');
        const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
        bulkDeleteBtn.disabled = checkboxes.length === 0;
      }

      function bulkDelete() {
        const checkboxes = document.querySelectorAll('input[name="fileKey"]:checked');
        if (checkboxes.length === 0) {
          alert('请至少选择一个文件');
          return;
        }
        const keys = Array.from(checkboxes).map(cb => decodeURIComponent(cb.value));
        if (!confirm('确定删除选中的 ' + keys.length + ' 个文件/文件夹吗？')) return;
        const formData = new FormData();
        keys.forEach(key => formData.append('fileKey', key));
        fetch('/delete', {
          method: 'POST',
          body: formData
        }).then(res => res.json()).then(json => {
          if (json.results && json.results.every(r => r.success)) {
            alert('批量删除成功');
            location.reload();
          } else {
            alert('部分文件删除失败，请重试');
          }
        }).catch(err => {
          alert('删除失败：' + err.message);
        });
      }

      function deleteSingleFile(filename) {
        if (confirm('确定删除 "' + filename + '"？')) {
          const formData = new FormData();
          formData.append('fileKey', filename);
          fetch('/delete', {
            method: 'POST',
            body: formData
          }).then(res => res.json()).then(json => {
            if (json.results && json.results[0] && json.results[0].success) {
              alert('删除成功');
              location.reload();
            } else {
              alert('删除失败，请重试');
            }
          }).catch(err => {
            alert('删除失败：' + err.message);
          });
          return false;
        }
        return false;
      }

      document.addEventListener('change', (e) => {
        if (e.target && e.target.name === 'fileKey') {
          updateBulkDeleteButton();
        }
      });

      const formControls = document.querySelectorAll('.controls input, .controls select');
      formControls.forEach(control => {
        control.addEventListener('change', () => {
          const search = document.querySelector('.search-box').value;
          const sort = document.querySelector('.sort-select:nth-of-type(1)').value;
          const order = document.querySelector('.sort-select:nth-of-type(2)').value;
          const params = new URLSearchParams(window.location.search);
          params.set('search', search);
          params.set('sort', sort);
          params.set('order', order);
          window.location.search = params.toString();
        });
      });
    </script>
  </body>
</html>
  `;
}

function buildLoginPage(errorMsg) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>登录 - 我的云存储</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --danger: #ef4444;
      --text: #1f2937;
      --text-light: #6b7280;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e5e7eb;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --input-bg: #ffffff;
    }
    [data-theme="dark"] {
      --text: #f9fafb;
      --text-light: #9ca3af;
      --bg: #111827;
      --card-bg: #1f2937;
      --border: #374151;
      --input-bg: #374151;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      transition: background-color 0.3s, color 0.3s;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 2.5rem;
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .login-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 1.5rem;
    }
    .login-icon {
      font-size: 3rem;
      margin-bottom: 1.5rem;
      color: var(--primary);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-label {
      font-weight: 500;
      color: var(--text);
    }
    .form-input {
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--text);
      font-size: 1rem;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .login-btn {
      padding: 0.75rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .login-btn:hover {
      background: var(--primary-hover);
    }
    .login-btn:disabled {
      background: var(--border);
      color: var(--text-light);
      cursor: not-allowed;
    }
    .error-message {
      background: #fef2f2;
      color: var(--danger);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid #fecaca;
      margin-bottom: 1rem;
    }
    [data-theme="dark"] .error-message {
      background: #371e1e;
      border-color: #7f1d1d;
    }
    .theme-toggle {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .login-footer {
      margin-top: 1.5rem;
      font-size: 0.85rem;
      color: var(--text-light);
    }
    .login-footer a {
      color: var(--primary);
      text-decoration: none;
    }
    .login-footer a:hover {
      text-decoration: underline;
    }
    
    /* 移动端优化 */
    @media (max-width: 480px) {
      .login-container {
        margin: 1rem;
        padding: 1.5rem;
      }
      
      .theme-toggle {
        position: relative;
        top: auto;
        right: auto;
        margin-bottom: 1rem;
      }
    }
  </style>
</head>
<body>
  <button class="theme-toggle" onclick="toggleTheme()">🌙 切换主题</button>
  
  <div class="login-container">
    <div class="login-icon">
      <i class="fas fa-lock"></i>
    </div>
    
    <h1 class="login-title">请登录</h1>
    
    ${errorMsg ? `<div class="error-message">⚠️ ${escapeHtml(errorMsg)}</div>` : ''}
    
    <form class="login-form" method="POST" action="/login">
      <div class="form-group">
        <label class="form-label" for="password">访问密码</label>
        <input 
          type="password" 
          id="password" 
          name="password" 
          class="form-input" 
          placeholder="请输入访问密码"
          required 
          autocomplete="current-password"
        />
      </div>
      
      <button type="submit" class="login-btn">
        <i class="fas fa-sign-in-alt" style="margin-right: 0.5rem;"></i>
        登录
      </button>
    </form>
    
    <div class="login-footer">
      <p>请输入正确的访问密码以继续使用云存储服务</p>
    </div>
  </div>

  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }
    (function() {
      const html = document.documentElement;
      const saved = localStorage.getItem('theme') || 'light';
      html.setAttribute('data-theme', saved);
    })();

    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
</body>
</html>
`;
}

function buildErrorResponse(error) {
  return new Response(`
  <!DOCTYPE html>
  <html>
  <body style="font-family: sans-serif; text-align: center; padding: 2rem; background: #f5f5f5;">
    <div style="background: white; padding: 2rem; border-radius: 8px;">
      <h2>发生错误</h2>
      <p>${error.message || error}</p>
      <a href="/" style="color: #6366f1;">返回首页</a>
    </div>
  </body>
</html>
  `, { status: 500, headers: { "Content-Type": "text/html" } });
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}