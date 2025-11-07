// 配置文件
const CONFIG = {
    repo: 'Chinesexiaochen/mycloudrive.github.io',
    username: 'Chinesexiaochen'
};

// 文件类型图标映射
const FILE_ICONS = {
    'pdf': '📕',
    'doc': '📘',
    'docx': '📘',
    'txt': '📄',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'mp4': '🎬',
    'avi': '🎬',
    'mov': '🎬',
    'mp3': '🎵',
    'wav': '🎵',
    'zip': '📦',
    'rar': '📦',
    '7z': '📦',
    'exe': '⚙️',
    'msi': '⚙️',
    'default': '📁'
};

// 全局变量
let cloudDrive;

// 初始化云盘
function initCloudDrive() {
    cloudDrive = new CloudDrive();
    cloudDrive.init();
}

class CloudDrive {
    constructor() {
        this.files = [];
    }

    async init() {
        await this.loadFiles();
        this.renderFileList();
        this.updateStats();
        this.updateAuthStatus();
        this.initEventListeners();
    }

    initEventListeners() {
        // 文件选择事件
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // 拖拽上传
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });
        }
    }

    async loadFiles() {
        try {
            const apiUrl = `https://api.github.com/repos/${CONFIG.repo}/git/trees/main?recursive=1`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('无法加载文件列表');
            }
            
            const data = await response.json();
            
            this.files = data.tree
                .filter(item => item.type === 'blob')
                .filter(item => !this.isSystemFile(item.path))
                .map(item => ({
                    name: item.path.split('/').pop(),
                    path: item.path,
                    size: this.formatFileSize(item.size || 0),
                    type: this.getFileType(item.path),
                    icon: this.getFileIcon(item.path),
                    url: `https://${CONFIG.username}.github.io/mycloudrive.github.io/${item.path}`,
                    rawUrl: `https://raw.githubusercontent.com/${CONFIG.repo}/main/${item.path}`,
                    sha: item.sha
                }));
                
        } catch (error) {
            console.error('加载文件失败:', error);
            this.showError('无法加载文件列表，请检查网络连接');
        }
    }

    isSystemFile(filename) {
        const systemFiles = [
            '.gitignore', 'README.md', 'index.html', 
            'style.css', 'script.js', 'auth.js', 'github-uploader.js'
        ];
        return systemFiles.includes(filename);
    }

    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ext;
    }

    getFileIcon(filename) {
        const ext = this.getFileType(filename);
        return FILE_ICONS[ext] || FILE_ICONS.default;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    renderFileList(filesToRender = null) {
        const fileList = document.getElementById('fileList');
        const files = filesToRender || this.files;

        if (files.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>暂无文件</h3>
                    <p>上传你的第一个文件开始使用云盘</p>
                </div>
            `;
            return;
        }

        fileList.innerHTML = files.map(file => `
            <div class="file-card">
                <div class="file-header">
                    <div class="file-icon">${file.icon}</div>
                    <div class="file-info">
                        <div class="file-name" title="${file.name}">${file.name}</div>
                        <div class="file-size">${file.size}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${file.rawUrl}" class="download-btn" download="${file.name}">
                        <i class="fas fa-download"></i> 下载
                    </a>
                    <button class="delete-btn" onclick="cloudDrive.deleteFile('${file.name}', '${file.sha}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const stats = document.getElementById('stats');
        const fileCount = document.getElementById('fileCount');
        
        if (stats) {
            stats.innerHTML = `<i class="fas fa-file"></i> ${this.files.length} 个文件`;
        }
        if (fileCount) {
            fileCount.textContent = `${this.files.length} 个文件`;
        }
    }

    updateAuthStatus() {
        const authStatus = document.getElementById('authStatus');
        if (authStatus) {
            const token = localStorage.getItem('github_token');
            if (token && (token.startsWith('ghp_') || token.startsWith('gho_'))) {
                authStatus.innerHTML = '<i class="fas fa-check-circle"></i> 已认证';
                authStatus.className = 'auth-status authenticated';
            } else {
                authStatus.innerHTML = '<i class="fas fa-times-circle"></i> 未认证';
                authStatus.className = 'auth-status not-authenticated';
            }
        }
    }

    showError(message) {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>加载失败</h3>
                <p>${message}</p>
                <button class="upload-btn" onclick="cloudDrive.init()" style="margin-top: 15px;">
                    <i class="fas fa-redo"></i> 重新加载
                </button>
            </div>
        `;
    }

    async handleFileUpload(file) {
        if (file.size > 25 * 1024 * 1024) {
            alert('文件大小不能超过25MB');
            return;
        }

        const token = localStorage.getItem('github_token');
        if (!token || (!token.startsWith('ghp_') && !token.startsWith('gho_'))) {
            alert('请先设置GitHub Token才能上传文件');
            manageGitHubToken();
            return;
        }

        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        // 显示上传进度
        uploadProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '准备上传... 0%';

        try {
            // 模拟上传过程
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                progressFill.style.width = i + '%';
                progressText.textContent = `上传中... ${i}%`;
            }

            // 实际使用GitHub API上传
            const success = await uploadFileToGitHub(file, token);
            
            if (success) {
                progressFill.style.width = '100%';
                progressText.textContent = '上传完成！100%';
                
                setTimeout(async () => {
                    uploadProgress.classList.add('hidden');
                    await this.init();
                    showMessage('文件上传成功！', 'success');
                }, 1000);
            } else {
                throw new Error('上传失败');
            }
            
        } catch (error) {
            uploadProgress.classList.add('hidden');
            alert('上传失败: ' + error.message);
        }
    }

    async deleteFile(filename, sha) {
        if (!confirm(`确定要删除文件 "${filename}" 吗？此操作不可撤销。`)) {
            return;
        }

        const token = localStorage.getItem('github_token');
        if (!token) {
            alert('请先设置GitHub Token才能删除文件');
            manageGitHubToken();
            return;
        }

        try {
            const success = await deleteFileFromGitHub(filename, sha, token);
            
            if (success) {
                await this.init();
                showMessage('文件删除成功！', 'success');
            } else {
                throw new Error('删除失败');
            }
            
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }
}

// 搜索功能
function filterFiles() {
    if (!cloudDrive) return;
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filteredFiles = cloudDrive.files.filter(file => 
        file.name.toLowerCase().includes(searchTerm)
    );
    cloudDrive.renderFileList(filteredFiles);
}

// 选择文件
function selectFile() {
    document.getElementById('fileInput').click();
}

// 管理GitHub Token
function manageGitHubToken() {
    const token = localStorage.getItem('github_token');
    
    if (token && (token.startsWith('ghp_') || token.startsWith('gho_'))) {
        if (confirm('确定要移除已保存的GitHub Token吗？')) {
            localStorage.removeItem('github_token');
            if (cloudDrive) {
                cloudDrive.updateAuthStatus();
            }
            showMessage('Token 已移除', 'info');
        }
    } else {
        const newToken = prompt(
            '请输入 GitHub Personal Access Token：\n\n' +
            '所需权限：\n' +
            '✅ repo - 完全控制仓库\n' +
            '✅ delete_repo - 删除文件\n\n' +
            '获取地址：https://github.com/settings/tokens'
        );
        
        if (newToken && newToken.trim()) {
            if (newToken.startsWith('ghp_') || newToken.startsWith('gho_')) {
                localStorage.setItem('github_token', newToken.trim());
                if (cloudDrive) {
                    cloudDrive.updateAuthStatus();
                }
                showMessage('Token 保存成功！', 'success');
            } else {
                alert('Token格式不正确，请检查是否复制完整');
            }
        }
    }
}

// 显示消息
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// GitHub API 上传文件
async function uploadFileToGitHub(file, token) {
    try {
        // 读取文件为Base64
        const content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const response = await fetch(`https://api.github.com/repos/${CONFIG.repo}/contents/${encodeURIComponent(file.name)}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Upload file: ${file.name}`,
                content: content.split(',')[1]
            })
        });

        return response.ok;
    } catch (error) {
        console.error('上传错误:', error);
        return false;
    }
}

// GitHub API 删除文件
async function deleteFileFromGitHub(filename, sha, token) {
    try {
        const response = await fetch(`https://api.github.com/repos/${CONFIG.repo}/contents/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete file: ${filename}`,
                sha: sha
            })
        });

        return response.ok;
    } catch (error) {
        console.error('删除错误:', error);
        return false;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('mainContainer') && 
        !document.getElementById('mainContainer').classList.contains('hidden')) {
        initCloudDrive();
    }
});

// 全局导出函数
window.filterFiles = filterFiles;
window.selectFile = selectFile;
window.manageGitHubToken = manageGitHubToken;
window.initCloudDrive = initCloudDrive;