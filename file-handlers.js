import { handleFileList, handleFileDownload, handleFileUpload, handleFileDelete, handleFilePreview } from './file-operations.js';
import { isDownloadRequest } from './utils.js';

export { isDownloadRequest };

export async function handleRequest(request, bucket, url) {
  const { pathname } = url;
  
  try {
    if (request.method === "GET" && pathname !== "/") {
      return await handleFileDownload(bucket, url);
    }

    if (pathname === "/" && request.method === "GET") {
      return await handleFileList(bucket, url);
    }

    if (pathname === "/upload" && request.method === "POST") {
      return await handleFileUpload(request, bucket);
    }

    if (pathname === "/delete" && request.method === "POST") {
      return await handleFileDelete(bucket, request);
    }

    return new Response("Not Found", { status: 404 });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
