// 聊天室前端逻辑
class ChatApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.quoteMessageId = null;
        this.quoteMessageText = null;
        this.selectedMessageId = null;
        
        // 自动检测后端URL（根据部署环境）
        this.BACKEND_URL = this.detectBackendUrl();
        
        this.initEventListeners();
        this.checkAuthStatus();
    }
    
    // 自动检测后端URL
    detectBackendUrl() {
        // 如果是GitHub Pages，使用默认后端
        if (window.location.hostname.includes('github.io')) {
            // 这里放你部署的后端URL
            return 'https://chat-room-backend.vercel.app';
        }
        
        // 如果是本地开发，使用localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // 默认使用相对路径
        return window.location.origin;
    }

    // 初始化事件监听器
    initEventListeners() {
        // 登录/注册切换
        document.getElementById('switch-to-register').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        });
        
        document.getElementById('switch-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('register-form').style.display = 'block';
            document.getElementById('login-form').style.display = 'none';
        });
        
        // 登录按钮
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        
        // 注册按钮
        document.getElementById('register-btn').addEventListener('click', () => this.register());
        document.getElementById('reg-username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        document.getElementById('reg-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        document.getElementById('confirm-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.register();
        });
        
        // 聊天相关
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // 消息操作
        document.getElementById('clear-input').addEventListener('click', () => {
            document.getElementById('message-input').value = '';
            this.hideQuotePreview();
        });
        
        document.getElementById('toggle-emoji').addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('close-emoji').addEventListener('click', () => this.closeEmojiPicker());
        document.getElementById('cancel-quote').addEventListener('click', () => this.hideQuotePreview());
        
        // 表情选择
        document.querySelectorAll('.emoji').forEach(emoji => {
            emoji.addEventListener('click', () => {
                const input = document.getElementById('message-input');
                input.value += emoji.textContent;
                input.focus();
            });
        });
        
        // 点击外部关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.message-action-btn') && !e.target.closest('.message-menu')) {
                this.hideMessageMenu();
            }
        });
    }
    
    // 检查认证状态
    checkAuthStatus() {
        const token = localStorage.getItem('chatToken');
        const username = localStorage.getItem('chatUsername');
        
        if (token && username) {
            // 尝试使用存储的token自动登录
            this.autoLogin(token, username);
        }
    }
    
    // 自动登录
    async autoLogin(token, username) {
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/auth/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                this.currentUser = username;
                this.connectWebSocket(token);
                this.showChatInterface();
            } else {
                localStorage.removeItem('chatToken');
                localStorage.removeItem('chatUsername');
            }
        } catch (error) {
            console.error('自动登录失败:', error);
        }
    }
    
    // 登录
    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showNotification('请输入用户名和密码', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = username;
                localStorage.setItem('chatToken', data.token);
                localStorage.setItem('chatUsername', username);
                this.connectWebSocket(data.token);
                this.showChatInterface();
                this.showNotification('登录成功', 'success');
            } else {
                this.showNotification(data.error || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showNotification('网络错误，请重试', 'error');
        }
    }
    
    // 注册
    async register() {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!username || !password) {
            this.showNotification('请输入用户名和密码', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showNotification('两次输入的密码不一致', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showNotification('密码至少6位', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.BACKEND_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('注册成功，请登录', 'success');
                // 切换到登录界面
                document.getElementById('register-form').style.display = 'none';
                document.getElementById('login-form').style.display = 'block';
                document.getElementById('username').value = username;
                document.getElementById('password').value = '';
            } else {
                this.showNotification(data.error || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showNotification('网络错误，请重试', 'error');
        }
    }
    
    // 连接WebSocket
    connectWebSocket(token) {
        // 如果已有连接，先关闭
        if (this.socket) {
            this.socket.close();
        }
        
        // 创建WebSocket连接
        const wsUrl = this.BACKEND_URL.replace('http', 'ws').replace('https', 'wss') + '/ws';
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('WebSocket连接已建立');
            // 发送认证信息
            this.socket.send(JSON.stringify({
                type: 'auth',
                token: token
            }));
        };
        
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.socket.onclose = () => {
            console.log('WebSocket连接已关闭');
            // 5秒后尝试重连
            setTimeout(() => {
                if (this.currentUser) {
                    this.connectWebSocket(token);
                }
            }, 5000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };
    }
    
    // 处理WebSocket消息
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'auth_success':
                this.showNotification('连接成功', 'success');
                break;
            case 'auth_error':
                this.showNotification('认证失败，请重新登录', 'error');
                this.logout();
                break;
            case 'message':
                this.addMessageToChat(data.message);
                break;
            case 'message_recalled':
                this.recallMessage(data.messageId);
                break;
            case 'message_deleted':
                this.deleteMessage(data.messageId);
                break;
            case 'users_update':
                this.updateUsersList(data.users);
                break;
            case 'error':
                this.showNotification(data.message, 'error');
                break;
        }
    }
    
    // 发送消息
    sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text) return;
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const messageData = {
                type: 'message',
                text: text,
                quoteMessageId: this.quoteMessageId
            };
            
            this.socket.send(JSON.stringify(messageData));
            input.value = '';
            this.hideQuotePreview();
        } else {
            this.showNotification('连接已断开，请刷新页面重试', 'error');
        }
    }
    
    // 显示聊天界面
    showChatInterface() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('chat-container').style.display = 'block';
        document.getElementById('current-user').textContent = this.currentUser;
        
        // 清空消息历史
        document.getElementById('messages').innerHTML = '';
        document.getElementById('users-list').innerHTML = '';
        
        // 聚焦到输入框
        document.getElementById('message-input').focus();
    }
    
    // 添加消息到聊天窗口
    addMessageToChat(messageData) {
        const messagesContainer = document.getElementById('messages');
        const messageElement = this.createMessageElement(messageData);
        messagesContainer.appendChild(messageElement);
        
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // 创建消息元素
    createMessageElement(messageData) {
        const isOwnMessage = messageData.sender === this.currentUser;
        const messageClass = isOwnMessage ? 'message sent' : 'message received';
        
        // 格式化时间
        const time = new Date(messageData.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let quoteHtml = '';
        if (messageData.quoteMessage) {
            quoteHtml = `
                <div class="quote-container">
                    <div class="quote-sender">${messageData.quoteMessage.sender}:</div>
                    <div class="quote-text">${this.escapeHtml(messageData.quoteMessage.text)}</div>
                </div>
            `;
        }
        
        const messageHtml = `
            <div class="${messageClass}" data-id="${messageData.id}">
                <div class="message-header">
                    <span class="message-sender">${messageData.sender}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">
                    ${quoteHtml}
                    <div class="message-text">${this.formatMessageText(messageData.text)}</div>
                    ${isOwnMessage ? `
                        <div class="message-actions">
                            <button class="message-action-btn recall-btn" data-id="${messageData.id}" title="撤回">
                                <i class="fas fa-undo"></i>
                            </button>
                            <button class="message-action-btn delete-btn" data-id="${messageData.id}" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : `
                        <div class="message-actions">
                            <button class="message-action-btn quote-btn" data-id="${messageData.id}" data-sender="${messageData.sender}" data-text="${this.escapeHtml(messageData.text)}" title="引用">
                                <i class="fas fa-quote-left"></i>
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        const messageEl = document.createElement('div');
        messageEl.innerHTML = messageHtml;
        const messageNode = messageEl.firstChild;
        
        // 添加事件监听
        if (isOwnMessage) {
            messageNode.querySelector('.recall-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.recallOwnMessage(messageData.id);
            });
            
            messageNode.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteOwnMessage(messageData.id);
            });
        } else {
            messageNode.querySelector('.quote-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = e.target.closest('.quote-btn');
                const sender = btn.dataset.sender;
                const text = btn.dataset.text;
                const messageId = btn.dataset.id;
                this.showQuotePreview(sender, text, messageId);
            });
        }
        
        // 右键菜单
        messageNode.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageMenu(e, messageData, isOwnMessage);
        });
        
        return messageNode;
    }
    
    // 显示引用预览
    showQuotePreview(sender, text, messageId) {
        this.quoteMessageId = messageId;
        this.quoteMessageText = text;
        
        document.getElementById('quote-text').textContent = `${sender}: ${text}`;
        document.getElementById('quote-preview').style.display = 'block';
        document.getElementById('message-input').focus();
    }
    
    // 隐藏引用预览
    hideQuotePreview() {
        this.quoteMessageId = null;
        this.quoteMessageText = null;
        document.getElementById('quote-preview').style.display = 'none';
    }
    
    // 撤回消息
    recallOwnMessage(messageId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'recall',
                messageId: messageId
            }));
        }
    }
    
    // 删除消息
    deleteOwnMessage(messageId) {
        if (confirm('确定要删除这条消息吗？此操作不可撤销。')) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'delete',
                    messageId: messageId
                }));
            }
        }
    }
    
    // 撤回消息（服务器通知）
    recallMessage(messageId) {
        const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            contentElement.innerHTML = '<em>此消息已被撤回</em>';
            contentElement.classList.add('recalled');
            
            // 移除动作按钮
            const actionsElement = messageElement.querySelector('.message-actions');
            if (actionsElement) {
                actionsElement.remove();
            }
        }
    }
    
    // 删除消息（服务器通知）
    deleteMessage(messageId) {
        const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }
    
    // 更新用户列表
    updateUsersList(users) {
        const usersList = document.getElementById('users-list');
        const onlineCount = document.getElementById('online-count');
        const usersCount = document.getElementById('users-count');
        
        // 更新计数
        onlineCount.textContent = `${users.length}人在线`;
        usersCount.textContent = users.length;
        
        // 清空列表
        usersList.innerHTML = '';
        
        // 添加用户
        users.forEach(user => {
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            if (user === this.currentUser) {
                userItem.classList.add('active');
            }
            
            // 生成用户头像（使用首字母）
            const avatarText = user.charAt(0).toUpperCase();
            
            userItem.innerHTML = `
                <div class="user-avatar">${avatarText}</div>
                <div class="user-name">${user}${user === this.currentUser ? ' (我)' : ''}</div>
            `;
            
            usersList.appendChild(userItem);
        });
    }
    
    // 显示消息操作菜单
    showMessageMenu(event, messageData, isOwnMessage) {
        this.selectedMessageId = messageData.id;
        
        const menu = document.getElementById('message-menu');
        menu.style.display = 'block';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        // 设置菜单项
        document.getElementById('quote-menu-item').onclick = () => {
            this.showQuotePreview(messageData.sender, messageData.text, messageData.id);
            this.hideMessageMenu();
        };
        
        document.getElementById('delete-menu-item').onclick = () => {
            if (isOwnMessage) {
                this.deleteOwnMessage(messageData.id);
            }
            this.hideMessageMenu();
        };
        
        document.getElementById('recall-menu-item').onclick = () => {
            if (isOwnMessage) {
                this.recallOwnMessage(messageData.id);
            }
            this.hideMessageMenu();
        };
        
        // 如果不是自己的消息，禁用删除和撤回选项
        document.getElementById('delete-menu-item').style.display = isOwnMessage ? 'block' : 'none';
        document.getElementById('recall-menu-item').style.display = isOwnMessage ? 'block' : 'none';
    }
    
    // 隐藏消息菜单
    hideMessageMenu() {
        document.getElementById('message-menu').style.display = 'none';
        this.selectedMessageId = null;
    }
    
    // 切换表情选择器
    toggleEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (picker.style.display === 'block') {
            this.closeEmojiPicker();
        } else {
            picker.style.display = 'block';
        }
    }
    
    // 关闭表情选择器
    closeEmojiPicker() {
        document.getElementById('emoji-picker').style.display = 'none';
    }
    
    // 登出
    logout() {
        if (this.socket) {
            this.socket.close();
        }
        
        localStorage.removeItem('chatToken');
        localStorage.removeItem('chatUsername');
        
        this.currentUser = null;
        this.socket = null;
        
        document.getElementById('chat-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'flex';
        
        // 清空表单
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        // 确保显示登录表单
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    }
    
    // 显示通知
    showNotification(message, type) {
        // 移除已有的通知
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 样式
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '8px';
        notification.style.color = '#fff';
        notification.style.fontWeight = '500';
        notification.style.zIndex = '9999';
        notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
        notification.style.animation = 'slideIn 0.3s ease';
        
        if (type === 'success') {
            notification.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else {
            notification.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // 添加动画样式
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // 格式化消息文本（简单的链接和换行处理）
    formatMessageText(text) {
        // 处理换行
        text = this.escapeHtml(text).replace(/\n/g, '<br>');
        
        // 简单链接检测
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlRegex, '<a href="$1" target="_blank" class="message-link">$1</a>');
        
        return text;
    }
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});