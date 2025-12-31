const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// 配置
const JWT_SECRET = process.env.JWT_SECRET || 'chat-room-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// CORS中间件
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// 内存存储
const users = new Map();
const messages = new Map();
const userSockets = new Map();
const userIPs = new Map();
const onlineUsers = new Set();

// 获取客户端IP
function getClientIp(req) {
    return req.ip || req.connection.remoteAddress;
}

// API路由
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientIp = getClientIp(req);
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        if (users.has(username)) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 检查IP是否已注册
        if (userIPs.has(clientIp)) {
            return res.status(400).json({ error: '该IP地址已注册过账号' });
        }
        
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
        users.set(username, {
            password: hashedPassword,
            ip: clientIp,
            registeredAt: new Date()
        });
        
        userIPs.set(clientIp, username);
        
        res.status(201).json({ message: '注册成功' });
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = users.get(username);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username });
    } catch (error) {
        res.status(500).json({ error: '服务器错误' });
    }
});

app.post('/api/auth/check', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '无效的认证令牌' });
        }
        res.json({ username: user.username });
    });
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket服务器
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log('新的WebSocket连接');
    let currentUser = null;
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'auth':
                    try {
                        const decoded = jwt.verify(data.token, JWT_SECRET);
                        currentUser = decoded.username;
                        
                        if (!users.has(currentUser)) {
                            ws.send(JSON.stringify({
                                type: 'auth_error',
                                message: '用户不存在'
                            }));
                            ws.close();
                            return;
                        }
                        
                        userSockets.set(currentUser, ws);
                        onlineUsers.add(currentUser);
                        
                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            username: currentUser
                        }));
                        
                        broadcastUsersList();
                        sendRecentMessages(ws);
                        
                    } catch (error) {
                        ws.send(JSON.stringify({
                            type: 'auth_error',
                            message: '认证失败'
                        }));
                        ws.close();
                    }
                    break;
                    
                case 'message':
                    if (!currentUser) return;
                    
                    const messageId = uuidv4();
                    const timestamp = new Date().toISOString();
                    let quoteMessage = null;
                    
                    if (data.quoteMessageId) {
                        const quotedMsg = messages.get(data.quoteMessageId);
                        if (quotedMsg) {
                            quoteMessage = {
                                sender: quotedMsg.sender,
                                text: quotedMsg.text
                            };
                        }
                    }
                    
                    const messageData = {
                        id: messageId,
                        type: 'message',
                        sender: currentUser,
                        text: data.text,
                        timestamp: timestamp,
                        quoteMessage: quoteMessage
                    };
                    
                    messages.set(messageId, messageData);
                    
                    if (messages.size > 500) {
                        const oldestKey = messages.keys().next().value;
                        messages.delete(oldestKey);
                    }
                    
                    broadcastMessage(messageData);
                    break;
                    
                case 'recall':
                    if (!currentUser) return;
                    
                    const msgToRecall = messages.get(data.messageId);
                    if (msgToRecall && msgToRecall.sender === currentUser) {
                        msgToRecall.recalled = true;
                        broadcastRecall(data.messageId);
                    }
                    break;
                    
                case 'delete':
                    if (!currentUser) return;
                    
                    const msgToDelete = messages.get(data.messageId);
                    if (msgToDelete && msgToDelete.sender === currentUser) {
                        messages.delete(data.messageId);
                        broadcastDelete(data.messageId);
                    }
                    break;
            }
        } catch (error) {
            console.error('处理WebSocket消息错误:', error);
        }
    });
    
    ws.on('close', () => {
        if (currentUser) {
            userSockets.delete(currentUser);
            onlineUsers.delete(currentUser);
            broadcastUsersList();
        }
    });
});

// 广播函数
function broadcastMessage(messageData) {
    const data = JSON.stringify({
        type: 'message',
        message: messageData
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function broadcastRecall(messageId) {
    const data = JSON.stringify({
        type: 'message_recalled',
        messageId: messageId
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function broadcastDelete(messageId) {
    const data = JSON.stringify({
        type: 'message_deleted',
        messageId: messageId
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function broadcastUsersList() {
    const usersArray = Array.from(onlineUsers);
    const data = JSON.stringify({
        type: 'users_update',
        users: usersArray
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

function sendRecentMessages(ws) {
    const recentMessages = Array.from(messages.values())
        .filter(msg => !msg.recalled)
        .slice(-30);
    
    recentMessages.forEach(messageData => {
        ws.send(JSON.stringify({
            type: 'message',
            message: messageData
        }));
    });
}

// 启动服务器
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});