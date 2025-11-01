// GitHub文件上传器
class GitHubUploader {
    constructor() {
        this.token = null;
        this.isAuthenticated = false;
        this.init();
    }

    init() {
        // 尝试从本地存储恢复token
        this.loadTokenFromStorage();
    }

    // 从本地存储加载token
    loadTokenFromStorage() {
        const savedToken = localStorage.getItem('github_token');
        if (savedToken) {
            this.setToken(savedToken);
        }
    }

    // 设置Token
    setToken(token) {
        this.token = token;
        this.isAuthenticated = true;
        localStorage.setItem('github_token', token);
    }

    // 清除Token
    clearToken() {
        this.token = null;
        this.isAuthenticated = false;
        localStorage.removeItem('github_token');
    }

    // 检查认证状态
    checkAuth() {
        if (!this.isAuthenticated || !this.token) {
            this.showAuthModal();
            return false;
        }
        return true;
    }

    // 显示认证弹窗
    showAuthModal() {
        // 移除已存在的弹窗
        const existingModal = document.getElementById('githubAuthModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="auth-modal" id="githubAuthModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-key"></i> GitHub 认证</h3>
                        <button class="close-btn" onclick="this.closest('.auth-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>需要 GitHub Personal Access Token 来上传文件</p>
                        <div class="input-group">
                            <input type="password" id="githubToken" placeholder="输入你的 GitHub Token" class="token-input">
                        </div>
                        <div class="help-links">
                            <a href="https://github.com/settings/tokens" target="_blank">
                                <i class="fas fa-external-link-alt"></i> 获取 Token
                            </a>
                            <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token" target="_blank">
                                <i class="fas fa-question-circle"></i> 帮助文档
                            </a>
                        </div>
                        <div class="token-tips">
                            <p><strong>所需权限：</strong></p>
                            <ul>
                                <li>✅ <code>repo</code> - 完全控制仓库</li>
                                <li>✅ <code>delete_repo</code> - 删除文件</li>
                                <li>✅ <code>workflow</code> - 工作流管理（可选）</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.auth-modal').remove()">取消</button>
                        <button class="btn-primary" onclick="githubUploader.saveToken()">保存 Token</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 聚焦输入框
        setTimeout(() => {
            const tokenInput = document.getElementById('githubToken');
            if (tokenInput) tokenInput.focus();
        }, 100);
    }

    // 保存Token
    saveToken() {
        const tokenInput = document.getElementById('githubToken');
        const token = tokenInput.value.trim();
        
        if (!token) {
            this.showMessage('请输入有效的 Token', 'error');
            return;
        }

        // 验证Token格式（以 ghp_ 或 ghs_ 开头）
        if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_')) {
            this.showMessage('Token 格式不正确，请检查是否复制完整', 'error');
            return;
        }

        this.setToken(token);
        document.getElementById('githubAuthModal').remove();
        this.showMessage('认证成功！现在可以上传文件了。', 'success');
        
        // 触发文件列表刷新
        if (typeof cloudDrive !== 'undefined') {
            cloudDrive.init();
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 移除已存在的消息
        const existingMsg = document.getElementById('uploadMessage');
        if (existingMsg) {
            existingMsg.remove();
        }

        const messageHTML = `
            <div class="message ${type}" id="uploadMessage">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', messageHTML);
        
        // 3秒后自动消失
        setTimeout(() => {
            const msg = document.getElementById('uploadMessage');
            if (msg) msg.remove();
        }, 3000);
    }

    // 上传文件到GitHub
    async uploadFile(file) {
        if (!this.checkAuth()) {
            throw new Error('未认证');
        }

        try {
            // 1. 获取文件内容（Base64编码）
            const content = await this.readFileAsBase64(file);
            
            // 2. 调用GitHub API创建文件
            const response = await fetch(`https://api.github.com/repos/${CONFIG.repo}/contents/${encodeURIComponent(file.name)}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `Upload file: ${file.name}`,
                    content: content.split(',')[1] // 移除Base64前缀
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log('文件上传成功:', result);
                return {
                    success: true,
                    data: result
                };
            } else {
                console.error('上传失败:', result);
                throw new Error(result.message || `上传失败: ${response.status}`);
            }
        } catch (error) {
            console.error('上传错误:', error);
            
            // 处理特定错误
            if (error.message.includes('401')) {
                this.clearToken();
                this.showAuthModal();
                throw new Error('Token 无效或已过期，请重新认证');
            } else if (error.message.includes('403')) {
                throw new Error('权限不足，请检查 Token 权限');
            } else if (error.message.includes('422')) {
                throw new Error('文件已存在或路径无效');
            } else {
                throw new Error('上传失败: ' + error.message);
            }
        }
    }

    // 删除文件
    async deleteFile(filename, sha) {
        if (!this.checkAuth()) {
            throw new Error('未认证');
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${CONFIG.repo}/contents/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `Delete file: ${filename}`,
                    sha: sha
                })
            });

            const result = await response.json();

            if (response.ok) {
                console.log('文件删除成功:', result);
                return {
                    success: true,
                    data: result
                };
            } else {
                console.error('删除失败:', result);
                throw new Error(result.message || `删除失败: ${response.status}`);
            }
        } catch (error) {
            console.error('删除错误:', error);
            
            if (error.message.includes('401')) {
                this.clearToken();
                this.showAuthModal();
                throw new Error('Token 无效或已过期，请重新认证');
            } else {
                throw new Error('删除失败: ' + error.message);
            }
        }
    }

    // 读取文件为Base64
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    }

    // 验证Token有效性
    async validateToken() {
        if (!this.token) return false;

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// 初始化上传器
const githubUploader = new GitHubUploader();
