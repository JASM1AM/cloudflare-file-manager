export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { method } = request;
      const { pathname } = url;
      
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache'
      };

      if (method === 'OPTIONS') {
        return new Response(null, { headers });
      }
      
      // 路由处理
      if (method === 'POST' && pathname === '/api/register') {
        return await handleRegister(request, env);
      }
      
      if (method === 'POST' && pathname === '/api/login') {
        return await handleLogin(request, env);
      }
      
      if (method === 'PUT' && pathname === '/api/user/nickname') {
        return await handleUpdateNickname(request, env);
      }
      
      if (method === 'GET' && pathname.startsWith('/api/user/')) {
        return await handleGetUserInfo(request, env, url);
      }
      
      if (method === 'POST' && pathname === '/api/message') {
        return await handlePostMessage(request, env);
      }
      
      if (method === 'GET' && pathname === '/api/messages') {
        return await handleGetMessages(request, env, url);
      }
      
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        return serveHTML();
      }
      
      return new Response('Not Found', { status: 404, headers });
      
    } catch (error) {
      console.error('全局错误:', error);
      return createResponse({ error: '服务器内部错误' }, 500);
    }
  }
};

// 工具函数
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function validateQQ(qq) {
  return /^\d{5,12}$/.test(qq);
}

function validateNickname(nickname) {
  const trimmed = nickname.trim();
  return trimmed.length > 0 && trimmed.length <= 20;
}

function validatePassword(password) {
  return password.length >= 6 && password.length <= 20;
}

function validateMessage(message) {
  const trimmed = message.trim();
  return trimmed.length > 0 && trimmed.length <= 1000;
}

function createResponse(data, status = 200, customHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    ...customHeaders
  };
  
  return new Response(JSON.stringify(data), { status, headers });
}

async function parseJSONRequest(request) {
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('请使用 application/json 格式');
  }
  return await request.json();
}

// 处理器函数
async function handleRegister(request, env) {
  try {
    const data = await parseJSONRequest(request);
    const { qq = '', nickname = '', password = '' } = data;
    
    if (!qq || !nickname || !password) {
      return createResponse({ error: '需要QQ号、昵称和密码' }, 400);
    }
    
    if (!validateQQ(qq)) {
      return createResponse({ error: 'QQ号必须是5-12位数字' }, 400);
    }
    
    if (!validateNickname(nickname)) {
      return createResponse({ error: '昵称不能为空且不超过20个字符' }, 400);
    }
    
    if (!validatePassword(password)) {
      return createResponse({ error: '密码长度需在6-20位之间' }, 400);
    }
    
    // 检查用户是否已存在
    const existingUser = await env.CHAT_D1.prepare(
      'SELECT qq FROM users WHERE qq = ?'
    ).bind(qq).first();
    
    if (existingUser) {
      return createResponse({ error: '该QQ号已注册' }, 409);
    }
    
    // 创建用户
    const timestamp = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    
    const result = await env.CHAT_D1.prepare(
      'INSERT INTO users (qq, nickname, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?)'
    ).bind(qq, nickname, passwordHash, timestamp, timestamp).run();
    
    if (!result.success) {
      throw new Error('创建用户失败');
    }
    
    return createResponse({ 
      success: true,
      qq: qq,
      nickname: nickname,
      message: '注册成功'
    });
    
  } catch (error) {
    console.error('注册错误:', error);
    if (error.message.includes('application/json')) {
      return createResponse({ error: error.message }, 400);
    }
    return createResponse({ error: '注册失败，请稍后重试' }, 500);
  }
}

async function handleLogin(request, env) {
  try {
    const data = await parseJSONRequest(request);
    const { qq = '', password = '' } = data;
    
    if (!qq || !password) {
      return createResponse({ error: '需要QQ号和密码' }, 400);
    }
    
    if (!validateQQ(qq)) {
      return createResponse({ error: 'QQ号必须是5-12位数字' }, 400);
    }
    
    // 查询用户
    const user = await env.CHAT_D1.prepare(
      'SELECT qq, nickname, password_hash FROM users WHERE qq = ?'
    ).bind(qq).first();
    
    if (!user) {
      return createResponse({ error: '用户未注册' }, 404);
    }
    
    // 验证密码
    const passwordHash = await hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return createResponse({ error: '密码错误' }, 401);
    }
    
    // 更新最后登录时间
    await env.CHAT_D1.prepare(
      'UPDATE users SET last_login = ? WHERE qq = ?'
    ).bind(new Date().toISOString(), qq).run();
    
    return createResponse({
      success: true,
      qq: user.qq,
      nickname: user.nickname
    });
    
  } catch (error) {
    console.error('登录错误:', error);
    if (error.message.includes('application/json')) {
      return createResponse({ error: error.message }, 400);
    }
    return createResponse({ error: '登录失败，请稍后重试' }, 500);
  }
}

async function handleUpdateNickname(request, env) {
  try {
    const data = await parseJSONRequest(request);
    const { qq = '', nickname = '' } = data;
    
    if (!qq || !nickname) {
      return createResponse({ error: '需要QQ号和昵称' }, 400);
    }
    
    if (!validateQQ(qq)) {
      return createResponse({ error: 'QQ号必须是5-12位数字' }, 400);
    }
    
    if (!validateNickname(nickname)) {
      return createResponse({ error: '昵称不能为空且不超过20个字符' }, 400);
    }
    
    // 检查用户是否存在
    const user = await env.CHAT_D1.prepare(
      'SELECT qq FROM users WHERE qq = ?'
    ).bind(qq).first();
    
    if (!user) {
      return createResponse({ error: '用户未注册' }, 404);
    }
    
    // 更新昵称
    const result = await env.CHAT_D1.prepare(
      'UPDATE users SET nickname = ? WHERE qq = ?'
    ).bind(nickname, qq).run();
    
    if (!result.success) {
      throw new Error('更新昵称失败');
    }
    
    return createResponse({ 
      success: true,
      qq: qq,
      nickname: nickname,
      message: '昵称更新成功'
    });
    
  } catch (error) {
    console.error('更新昵称错误:', error);
    if (error.message.includes('application/json')) {
      return createResponse({ error: error.message }, 400);
    }
    return createResponse({ error: '更新昵称失败，请稍后重试' }, 500);
  }
}

async function handleGetUserInfo(request, env, url) {
  try {
    const qq = url.pathname.split('/').pop();
    
    if (!validateQQ(qq)) {
      return createResponse({ error: '无效的QQ号' }, 400);
    }
    
    const user = await env.CHAT_D1.prepare(
      'SELECT qq, nickname, created_at, last_login FROM users WHERE qq = ?'
    ).bind(qq).first();
    
    if (!user) {
      return createResponse({ error: '用户不存在' }, 404);
    }
    
    return createResponse(user);
    
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return createResponse({ error: '获取用户信息失败' }, 500);
  }
}

async function handlePostMessage(request, env) {
  try {
    const data = await parseJSONRequest(request);
    const { qq = '', message = '' } = data;
    
    if (!qq || !message) {
      return createResponse({ error: '需要QQ号和消息内容' }, 400);
    }
    
    if (!validateQQ(qq)) {
      return createResponse({ error: 'QQ号必须是5-12位数字' }, 400);
    }
    
    if (!validateMessage(message)) {
      return createResponse({ error: '消息内容不能为空且不超过1000字符' }, 400);
    }
    
    // 获取用户昵称
    const user = await env.CHAT_D1.prepare(
      'SELECT nickname FROM users WHERE qq = ?'
    ).bind(qq).first();
    
    const nickname = user ? user.nickname : null;
    
    // 插入消息
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const result = await env.CHAT_D1.prepare(
      'INSERT INTO messages (id, qq, nickname, message, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(messageId, qq, nickname, message, timestamp).run();
    
    if (!result.success) {
      throw new Error('插入数据失败');
    }
    
    return createResponse({ 
      success: true, 
      id: messageId,
      timestamp 
    });
    
  } catch (error) {
    console.error('发送消息错误:', error);
    if (error.message.includes('application/json')) {
      return createResponse({ error: error.message }, 400);
    }
    return createResponse({ error: '服务器错误，请稍后重试' }, 500);
  }
}

async function handleGetMessages(request, env, url) {
  try {
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 200);
    
    const { results } = await env.CHAT_D1.prepare(
      'SELECT id, qq, nickname, message, timestamp FROM messages ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    
    const messages = results.reverse();
    
    return createResponse(messages);
    
  } catch (error) {
    console.error('获取消息错误:', error);
    return createResponse({ error: '获取消息失败' }, 500);
  }
}

import htmlContent from './index.html';

function serveHTML() {
  return new Response(htmlContent, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
