// 配置文件
const CONFIG = {
    repo: 'Chinesexiaochen/mycloudrive.github.io',
    username: 'Chinesexiaochen'
};

// 文件类型图标映射
const FILE_ICONS = {
    'pdf': '📕', 'doc': '📘', 'docx': '📘', 'txt': '📄',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬',
    'mp3': '🎵', 'wav': '🎵',
    'zip': '📦', 'rar': '📦', '7z': '📦',
    'exe': '⚙️', 'msi': '⚙️',
    'default': '📁'
};

// 全局变量
let cloudDrive;

// 错误显示函数
function showError(message) {
    alert('❌ ' + message); // 先用简单的alert
    console.error('错误:', message);
}

// 显示消息
function showMessage(message, type = 'info') {
    alert((type === 'success' ? '✅ ' : 'ℹ️ ') + message);
}

// 简化的上传函数
async function uploadFileToGitHub(file, token) {
    console.log('开始上传文件:', file.name, '大小:', file.size, '类型:', file.type);
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function() {
            try {
                const content = reader.result;
                console.log('文件读取完成，内容长度:', content.length);
                
                const contentB64 = content.split(',')[1];
                console.log('Base64内容长度:', contentB64.length);
                
                console.log('开始API调用...');
                
                const CONFIG = {
    repo: 'Chinesexiaochen/Chinesexiaochen.github.io',  // ✅ 正确的
    username: 'Chinesexiaochen'
}; {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: `Upload file: ${file.name}`,
                        content: contentB64
                    })
                });
                
                console.log('API响应状态:', response.status);
                const result = await response.json();
                console.log('API响应结果:', result);
                
                if (response.ok) {
                    console.log('✅ 上传成功！');
                    resolve(true);
                } else {
                    console.error('❌ 上传失败:', result);
                    let errorMsg = result.message || `上传失败: ${response.status}`;
                    
                    if (response.status === 401) {
                        errorMsg = 'Token无效或已过期，请重新设置';
                    } else if (response.status === 403) {
                        errorMsg = '权限不足，请检查Token权限';
                    } else if (response.status === 404) {
                        errorMsg = '仓库不存在或无权访问';
                    } else if (response.status === 422) {
                        errorMsg = '文件已存在或路径无效';
                    }
                    
                    reject(new Error(errorMsg));
                }
            } catch (error) {
                console.error('上传过程错误:', error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            console.error('文件读取错误');
            reject(new Error('文件读取失败'));
        };
        
        console.log('开始读取文件...');
        reader.readAsDataURL(file);
    });
}

// GitHub API 删除文件
async function deleteFileFromGitHub(filename, sha, token) {
    try {
        const response = await fetch(`https://api.github.com/repos/Chinesexiaochen/mycloudrive.github.io/contents/${encodeURIComponent(filename)}`, {
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

// 文件验证函数
function validateFile(file) {
    if (file.size > 25 * 1024 * 1024) {
        throw new Error('文件大小不能超过25MB');
    }
    
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
    if (invalidChars.test(file.name)) {
        throw new Error('文件名包含无效字符');
    }
    
    return true;
}

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
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

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
                throw new Error(`无法加载文件列表: ${response.status}`);
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
            this.showError('无法加载文件列表: ' + error.message);
        }
    }

    isSystemFile(filename) {
        const systemFiles = ['.gitignore', 'README.md', 'index.html', 'style.css', 'script.js', 'auth.js'];
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
        try {
            validateFile(file);
            
            const token = localStorage.getItem('github_token');
            if (!token || (!token.startsWith('ghp_') && !token.startsWith('gho_'))) {
                showError('请先设置GitHub Token才能上传文件');
                manageGitHubToken();
                return;
            }

            const uploadProgress = document.getElementById('uploadProgress');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');

            uploadProgress.classList.remove('hidden');
            progressFill.style.width = '0%';
            progressText.textContent = '准备上传... 0%';

            progressFill.style.width = '30%';
            progressText.textContent = '验证文件中... 30%';

            progressFill.style.width = '60%';
            progressText.textContent = '上传中... 60%';

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
            const uploadProgress = document.getElementById('uploadProgress');
            if (uploadProgress) uploadProgress.classList.add('hidden');
            showError('上传失败: ' + error.message);
        }
    }

    async deleteFile(filename, sha) {
        if (!confirm(`确定要删除文件 "${filename}" 吗？`)) return;

        const token = localStorage.getItem('github_token');
        if (!token) {
            showError('请先设置GitHub Token');
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
            showError('删除失败: ' + error.message);
        }
    }
}

// 搜索功能
function filterFiles() {
    if (!cloudDrive) return;
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filteredFiles = cloudDrive.files.filter(file => file.name.toLowerCase().includes(searchTerm));
    cloudDrive.renderFileList(filteredFiles);
}

// 选择文件
function selectFile() {
    document.getElementById('fileInput').click();
}

// 管理GitHub Token
function manageGitHubToken() {
    const token = localStorage.getItem('github_token');
    
    if (token) {
        if (confirm('确定要移除Token吗？')) {
            localStorage.removeItem('github_token');
            if (cloudDrive) cloudDrive.updateAuthStatus();
            showMessage('Token 已移除', 'info');
        }
    } else {
        const newToken = prompt('请输入GitHub Token:\n\n权限要求: repo, delete_repo\n\n获取: https://github.com/settings/tokens');
        if (newToken && newToken.trim()) {
            if (newToken.startsWith('ghp_') || newToken.startsWith('gho_')) {
                localStorage.setItem('github_token', newToken.trim());
                if (cloudDrive) cloudDrive.updateAuthStatus();
                showMessage('Token 保存成功！', 'success');
            } else {
                showError('Token格式不正确');
            }
        }
    }
}

// 测试上传功能
function testUpload() {
    const token = localStorage.getItem('github_token');
    if (!token) {
        showError('请先设置GitHub Token');
        return;
    }

    const testContent = '测试文件 ' + new Date().toLocaleString();
    const contentB64 = btoa(unescape(encodeURIComponent(testContent)));
    
    fetch(`https://api.github.com/repos/Chinesexiaochen/mycloudrive.github.io/contents/test-${Date.now()}.txt`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: '测试上传',
            content: contentB64
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.content) {
            showMessage('测试上传成功！', 'success');
            if (cloudDrive) cloudDrive.init();
        } else {
            showError('测试失败: ' + (result.message || '未知错误'));
        }
    })
    .catch(error => {
        showError('测试错误: ' + error.message);
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('mainContainer') && !document.getElementById('mainContainer').classList.contains('hidden')) {
        initCloudDrive();
    }
});

// 全局导出函数
window.filterFiles = filterFiles;
window.selectFile = selectFile;
window.manageGitHubToken = manageGitHubToken;
window.initCloudDrive = initCloudDrive;
window.testUpload = testUpload;