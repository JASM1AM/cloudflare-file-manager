import { buildErrorResponse } from './utils.js';
import { showLoginPageTemplate } from './ui-templates.js';

export function isAuthenticated(request, password) {
  const cookie = request.headers.get("Cookie") || "";
  const tokenMatch = cookie.match(/access_token=([^;]+)/);
  return tokenMatch && tokenMatch[1] === password;
}

export function showLoginPage(request, errorMsg = "", failed = false) {
  const html = showLoginPageTemplate(errorMsg);
  return new Response(html, {
    status: failed ? 401 : 200,
    headers: { "Content-Type": "text/html" }
  });
}

export async function handleLogin(request, correctPassword) {
  try {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password !== correctPassword) {
      return showLoginPage(request, "密码错误", true);
    }

    const headers = new Headers({
      "Location": "/",
      "Set-Cookie": `access_token=${correctPassword}; Path=/; HttpOnly; Max-Age=86400; SameSite=Strict`
    });
    
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
