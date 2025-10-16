import { getFileIcon, getFileType, formatFileSize, escapeHtml, buildErrorResponse } from './utils.js';
import { fileListTemplate } from './ui-templates.js';

export async function handleFileList(bucket, url) {
  try {
    const listResult = await bucket.list();
    const objects = (listResult.objects || []).filter(o => o.key).map(obj => ({
      key: obj.key,
      size: obj.size || 0,
      uploaded: obj.uploaded || new Date().toISOString()
    }));

    const search = url.searchParams.get("search") || "";
    const filteredObjects = search ? objects.filter(obj => 
      obj.key.toLowerCase().includes(search.toLowerCase())
    ) : objects;

    const html = fileListTemplate(filteredObjects, search, getFileIcon, formatFileSize, escapeHtml);
    
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function handleFileDownload(bucket, url) {
  try {
    const key = decodeURIComponent(url.pathname.slice(1));
    const object = await bucket.get(key);
    
    if (!object) {
      return new Response("文件不存在", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(key)}"`);
    
    return new Response(object.body, { headers });
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function handleFilePreview(bucket, url) {
  try {
    const key = decodeURIComponent(url.pathname.slice(9));
    const object = await bucket.get(key);
    
    if (!object) {
      return new Response("文件不存在", { status: 404 });
    }

    const fileType = getFileType(key);
    
    if (fileType === '文本') {
      const text = await object.text();
      return new Response(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `inline; filename="${encodeURIComponent(key)}"`
        }
      });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(key)}"`);
    
    return new Response(object.body, { headers });
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function handleFileUpload(request, bucket) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    
    if (!files.length) {
      return new Response(JSON.stringify({ error: "未选择文件" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const results = await Promise.all(
      files.map(async file => {
        try {
          await bucket.put(file.name, file.stream());
          return { name: file.name, success: true };
        } catch (err) {
          return { name: file.name, success: false, error: err.message };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}

export async function handleFileDelete(bucket, request) {
  try {
    const formData = await request.formData();
    const fileKeys = formData.getAll("fileKey");
    
    if (!fileKeys.length) {
      return new Response(JSON.stringify({ error: "未选择文件" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const results = await Promise.all(
      fileKeys.map(async key => {
        try {
          await bucket.delete(key);
          return { key, success: true };
        } catch (err) {
          return { key, success: false, error: err.message };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
