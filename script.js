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

class CloudDrive {
    constructor() {
        this.files = [];
        this.initEventListeners();
    }

    async init() {
        await this.loadFiles();
        this.renderFileList();
        this.updateStats();
    }

    initEventListeners() {
        // 文件选择事件
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
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
            'style.css', 'script.js', 'auth.js'
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

        const uploadProgress = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        // 显示上传进度
        uploadProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '准备上传... 0%';

        try {
            // 这里应该是实际的上传逻辑
            // 由于GitHub Pages是静态的，需要其他方式实现上传
            // 这里使用模拟上传
            
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                progressFill.style.width = i + '%';
                progressText.textContent = `上传中... ${i}%`;
            }

            // 模拟上传完成
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            uploadProgress.classList.add('hidden');
            alert('由于GitHub Pages是静态托管，实际文件上传需要通过GitHub仓库直接进行。\n\n请通过GitHub网站或App将文件上传到仓库。');
            
            // 重新加载文件列表
            await this.init();
            
        } catch (error) {
            uploadProgress.classList.add('hidden');
            alert('上传失败: ' + error.message);
        }
    }

    async deleteFile(filename, sha) {
        if (!confirm(`确定要删除文件 "${filename}" 吗？此操作不可撤销。`)) {
            return;
        }

        try {
            // 这里应该是实际的删除逻辑
            // 由于GitHub Pages是静态的，需要其他方式实现删除
            alert('由于GitHub Pages是静态托管，文件删除需要通过GitHub仓库直接进行。\n\n请通过GitHub网站或App从仓库中删除文件。');
            
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }
}

// 搜索功能
function filterFiles() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filteredFiles = cloudDrive.files.filter(file => 
        file.name.toLowerCase().includes(searchTerm)
    );
    cloudDrive.renderFileList(filteredFiles);
}

// 初始化云盘
const cloudDrive = new CloudDrive();

// 页面加载完成后初始化
if (document.getElementById('mainContainer') && 
    !document.getElementById('mainContainer').classList.contains('hidden')) {
    cloudDrive.init();
                                        }
// 管理GitHub Token
function manageGitHubToken() {
    console.log('manageGitHubToken 函数被调用');
    
    if (typeof githubUploader === 'undefined') {
        console.error('githubUploader 未定义');
        alert('GitHub上传器未正确加载，请刷新页面重试');
        return;
    }
    
    if (githubUploader.isAuthenticated) {
        if (confirm('确定要移除已保存的GitHub Token吗？')) {
            githubUploader.clearToken();
            if (typeof cloudDrive !== 'undefined') {
                cloudDrive.updateAuthStatus();
            }
            // 显示成功消息
            const message = document.createElement('div');
            message.className = 'message success';
            message.innerHTML = '<i class="fas fa-check-circle"></i> Token 已移除';
            document.body.appendChild(message);
            setTimeout(() => message.remove(), 3000);
        }
    } else {
        console.log('显示认证弹窗');
        githubUploader.showAuthModal();
    }
}

// 确保函数在全局可访问
window.manageGitHubToken = manageGitHubToken;