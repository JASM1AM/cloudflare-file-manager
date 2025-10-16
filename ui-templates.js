import { getFileType } from './utils.js';

export function showLoginPageTemplate(errorMsg = "") {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>登录 - 云存储</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        min-height: 100vh; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        padding: 20px; 
      }
      .login-container { 
        background: white; 
        padding: 40px; 
        border-radius: 20px; 
        box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
        width: 100%; 
        max-width: 400px; 
      }
      .logo { text-align: center; margin-bottom: 30px; }
      .logo h1 { color: #333; font-size: 28px; font-weight: 600; }
      .form-group { margin-bottom: 20px; }
      .form-group label { 
        display: block; 
        margin-bottom: 8px; 
        color: #555; 
        font-weight: 500; 
      }
      .form-group input { 
        width: 100%; 
        padding: 12px 16px; 
        border: 2px solid #e1e5e9; 
        border-radius: 10px; 
        font-size: 16px; 
        transition: all 0.3s; 
      }
      .form-group input:focus { 
        outline: none; 
        border-color: #667eea; 
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); 
      }
      .login-btn { 
        width: 100%; 
        padding: 12px; 
        background: #667eea; 
        color: white; 
        border: none; 
        border-radius: 10px; 
        font-size: 16px; 
        font-weight: 600; 
        cursor: pointer; 
        transition: all 0.3s; 
      }
      .login-btn:hover { 
        background: #5a6fd8; 
        transform: translateY(-1px); 
      }
      .error { 
        background: #fee; 
        color: #c33; 
        padding: 12px; 
        border-radius: 8px; 
        margin-bottom: 20px; 
        text-align: center; 
        border: 1px solid #fcc; 
      }
    </style>
  </head>
  <body>
    <div class="login-container">
      <div class="logo"><h1>🔐🔐 云存储</h1></div>
      ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
      <form method="POST" action="/login">
        <div class="form-group">
          <label for="password">访问密码</label>
          <input type="password" id="password" name="password" required placeholder="请输入访问密码">
        </div>
        <button type="submit" class="login-btn">登录</button>
      </form>
    </div>
  </body>
  </html>`;
}

export function fileListTemplate(filteredObjects, search, getFileIcon, formatFileSize, escapeHtml) {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>云存储</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
        background: #f8fafc; 
        color: #334155; 
        line-height: 1.6; 
      }
      .header { 
        background: white; 
        padding: 20px 0; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        position: sticky; 
        top: 0; 
        z-index: 100; 
      }
      .container { 
        max-width: 1200px; 
        margin: 0 auto; 
        padding: 0 20px; 
      }
      .header-content { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        flex-wrap: wrap; 
        gap: 20px; 
      }
      .logo h1 { 
        color: #6366f1; 
        font-size: 24px; 
        font-weight: 600; 
      }
      .search-box { 
        flex: 1; 
        max-width: 400px; 
        position: relative; 
      }
      .search-box input { 
        width: 100%; 
        padding: 12px 45px 12px 16px; 
        border: 2px solid #e2e8f0; 
        border-radius: 12px; 
        font-size: 16px; 
        transition: all 0.3s; 
      }
      .search-box input:focus { 
        outline: none; 
        border-color: #6366f1; 
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); 
      }
      .upload-section { 
        background: white; 
        border-radius: 16px; 
        padding: 30px; 
        margin: 30px 0; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
      }
      .upload-area { 
        border: 2px dashed #cbd5e1; 
        border-radius: 12px; 
        padding: 40px; 
        text-align: center; 
        transition: all 0.3s; 
        cursor: pointer; 
      }
      .upload-area:hover { 
        border-color: #6366f1; 
        background: #f8faff; 
      }
      .upload-icon { 
        font-size: 48px; 
        color: #94a3b8; 
        margin-bottom: 16px; 
      }
      .file-input { display: none; }
      .file-list { 
        background: white; 
        border-radius: 16px; 
        overflow: hidden; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
      }
      .file-header { 
        display: grid; 
        grid-template-columns: 40px 1fr 120px 150px 150px 100px; 
        gap: 20px; 
        padding: 20px; 
        background: #f8fafc; 
        border-bottom: 1px solid #e2e8f0; 
        font-weight: 600; 
        color: #64748b; 
      }
      .file-item { 
        display: grid; 
        grid-template-columns: 40px 1fr 120px 150px 150px 100px; 
        gap: 20px; 
        padding: 20px; 
        border-bottom: 1px solid #f1f5f9; 
        align-items: center; 
        transition: all 0.3s; 
      }
      .file-item:hover { background: #f8fafc; }
      .file-icon { 
        width: 40px; 
        height: 40px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        background: #e0e7ff; 
        border-radius: 8px; 
        color: #6366f1; 
        font-size: 18px; 
      }
      .file-name { 
        font-weight: 500; 
        color: #334155; 
        text-decoration: none; 
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis; 
      }
      .file-name:hover { color: #6366f1; }
      .file-size { color: #64748b; font-size: 14px; }
      .file-date { color: #94a3b8; font-size: 14px; }
      .file-type { color: #64748b; font-size: 14px; }
      .file-actions { display: flex; gap: 8px; }
      .btn { 
        padding: 8px 12px; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer; 
        font-size: 14px; 
        transition: all 0.3s; 
        text-decoration: none; 
        display: inline-flex; 
        align-items: center; 
        gap: 4px; 
      }
      .btn-preview { background: #3b82f6; color: white; }
      .btn-preview:hover { background: #2563eb; }
      .btn-download { background: #10b981; color: white; }
      .btn-download:hover { background: #059669; }
      .btn-delete { background: #ef4444; color: white; }
      .btn-delete:hover { background: #dc2626; }
      .empty-state { 
        text-align: center; 
        padding: 60px 20px; 
        color: #94a3b8; 
      }
      .empty-icon { 
        font-size: 64px; 
        margin-bottom: 16px; 
        opacity: 0.5; 
      }
      
      /* 预览模态框样式 */
      .modal { 
        display: none; 
        position: fixed; 
        z-index: 1000; 
        left: 0; 
        top: 0; 
        width: 100%; 
        height: 100%; 
        background-color: rgba(0,0,0,0.8); 
        align-items: center; 
        justify-content: center; 
      }
      .modal-content { 
        background: white; 
        border-radius: 12px; 
        width: 90%; 
        max-width: 800px; 
        max-height: 90vh; 
        overflow: auto; 
        position: relative; 
      }
      .modal-header { 
        padding: 20px; 
        border-bottom: 1px solid #e5e7eb; 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
      }
      .modal-body { 
        padding: 20px; 
        max-height: 70vh; 
        overflow: auto; 
      }
      .close-btn { 
        background: #ef4444; 
        color: white; 
        border: none; 
        padding: 8px 16px; 
        border-radius: 6px; 
        cursor: pointer; 
      }
      .preview-text { 
        white-space: pre-wrap; 
        font-family: monospace; 
        background: #f8fafc; 
        padding: 20px; 
        border-radius: 8px; 
      }
      .preview-image { 
        max-width: 100%; 
        max-height: 400px; 
        display: block; 
        margin: 0 auto; 
      }
      .preview-unsupported { 
        text-align: center; 
        padding: 40px; 
        color: #64748b; 
      }
      
      @media (max-width: 768px) {
        .file-header { display: none; }
        .file-item { 
          grid-template-columns: 1fr; 
          gap: 12px; 
          text-align: center; 
        }
        .file-actions { justify-content: center; }
        .file-header { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="container">
        <div class="header-content">
          <div class="logo"><h1>☁☁️ 云存储</h1></div>
          <div class="search-box">
            <input type="text" id="searchInput" placeholder="搜索文件..." value="${escapeHtml(search)}">
          </div>
        </div>
      </div>
    </div>
    
    <div class="container">
      <div class="upload-section">
        <div class="upload-area" onclick="document.getElementById('fileInput').click()">
          <div class="upload-icon">📁📁</div>
          <h3>点击选择文件或拖拽到此处</h3>
          <p>支持多文件上传，单个文件最大100MB</p>
          <input type="file" id="fileInput" class="file-input" multiple onchange="handleFileSelect(this.files)">
        </div>
      </div>
      
      <div class="file-list">
        <div class="file-header">
          <div></div>
          <div>文件名</div>
          <div>大小</div>
          <div>上传时间</div>
          <div>类型</div>
          <div>操作</div>
        </div>
        
        ${filteredObjects.length > 0 ? filteredObjects.map(file => `
          <div class="file-item">
            <div class="file-icon">${getFileIcon(file.key)}</div>
            <span class="file-name" title="${escapeHtml(file.key)}">${escapeHtml(file.key)}</span>
            <div class="file-size">${formatFileSize(file.size)}</div>
            <div class="file-date">${new Date(file.uploaded).toLocaleDateString('zh-CN')}</div>
            <div class="file-type">${getFileType(file.key)}</div>
            <div class="file-actions">
              <button class="btn btn-preview" onclick="previewFile('${escapeHtml(file.key)}')">👁️ 预览</button>
              <a href="/${encodeURIComponent(file.key)}" class="btn btn-download" download>📥 下载</a>
              <button class="btn btn-delete" onclick="deleteFile('${escapeHtml(file.key)}')">🗑️ 删除</button>
            </div>
          </div>
        `).join('') : `
          <div class="empty-state">
            <div class="empty-icon">📁📁</div>
            <h3>暂无文件</h3>
            <p>上传您的第一个文件开始使用</p>
          </div>
        `}
      </div>
    </div>
    
    <!-- 预览模态框 -->
    <div id="previewModal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="previewTitle">文件预览</h3>
          <button class="close-btn" onclick="closePreview()">关闭</button>
        </div>
        <div class="modal-body" id="previewBody"></div>
      </div>
    </div>
    
    <script>
      function handleFileSelect(files) {
        if (files.length === 0) return;
        const formData = new FormData();
        for (let file of files) {
          if (file.size > 100 * 1024 * 1024) {
            alert('文件 "' + file.name + '" 超过100MB限制');
            return;
          }
          formData.append('file', file);
        }
        fetch('/upload', {
          method: 'POST',
          body: formData
        }).then(response => {
          if (response.ok) {
            alert('上传成功');
            location.reload();
          } else {
            alert('上传失败');
          }
        }).catch(error => {
          alert('上传错误: ' + error.message);
        });
      }
      
      function deleteFile(filename) {
        if (!confirm('确定删除 "' + filename + '" 吗？')) return;
        const formData = new FormData();
        formData.append('fileKey', filename);
        fetch('/delete', {
          method: 'POST',
          body: formData
        }).then(response => {
          if (response.ok) {
            alert('删除成功');
            location.reload();
          } else {
            alert('删除失败');
          }
        });
      }
      
      function previewFile(filename) {
        const modal = document.getElementById('previewModal');
        const title = document.getElementById('previewTitle');
        const body = document.getElementById('previewBody');
        
        title.textContent = '预览: ' + filename;
        body.innerHTML = '<div style="text-align: center; padding: 40px;">加载中...</div>';
        
        modal.style.display = 'flex';
        
        const fileType = getClientFileType(filename);
        
        if (fileType === '图片') {
          body.innerHTML = '';
        } else if (fileType === '文本') {
          fetch('/preview/' + encodeURIComponent(filename))
            .then(response => {
              if (!response.ok) throw new Error('预览失败');
              return response.text();
            })
            .then(text => {
              body.innerHTML = '<div class="preview-text">' + escapeHtml(text) + '</div>';
            })
            .catch(error => {
              body.innerHTML = '<div class="preview-unsupported">预览失败: ' + error.message + '</div>';
            });
        } else if (fileType === 'PDF') {
          body.innerHTML = '<iframe src="/' + encodeURIComponent(filename) + '#toolbar=0" style="width: 100%; height: 600px;" frameborder="0"></iframe>';
        } else {
          body.innerHTML = '<div class="preview-unsupported">不支持预览此文件类型，请下载后查看</div>';
        }
      }
      
      function closePreview() {
        document.getElementById('previewModal').style.display = 'none';
      }
      
      function getClientFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];
        const textTypes = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'csv'];
        const pdfTypes = ['pdf'];
        
        if (imageTypes.includes(ext)) return '图片';
        if (textTypes.includes(ext)) return '文本';
        if (pdfTypes.includes(ext)) return 'PDF';
        return '其他';
      }
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      document.getElementById('searchInput').addEventListener('input', function(e) {
        const search = e.target.value;
        const url = new URL(window.location);
        if (search) {
          url.searchParams.set('search', search);
        } else {
          url.searchParams.delete('search');
        }
        window.location.href = url.toString();
      });
      
      // 拖拽上传功能
      const uploadArea = document.querySelector('.upload-area');
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
        }, false);
      });
      
      ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
          uploadArea.style.borderColor = '#6366f1';
          uploadArea.style.background = '#f0f4ff';
        }, false);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
          uploadArea.style.borderColor = '#cbd5e1';
          uploadArea.style.background = '';
        }, false);
      });
      
      uploadArea.addEventListener('drop', e => {
        const files = e.dataTransfer.files;
        handleFileSelect(files);
      }, false);
      
      // 点击模态框外部关闭
      window.addEventListener('click', function(event) {
        const modal = document.getElementById('previewModal');
        if (event.target === modal) {
          closePreview();
        }
      });
      
      // ESC键关闭预览
      document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
          closePreview();
        }
      });
    </script>
  </body>
  </html>`;
}
