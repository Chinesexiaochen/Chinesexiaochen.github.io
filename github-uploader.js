// 这个文件现在可以留空，或者包含一些工具函数
// 主要功能已经整合到 script.js 中

console.log('GitHub Uploader 已加载');

// 如果需要，可以在这里添加一些工具函数
function validateGitHubToken(token) {
    return token && (token.startsWith('ghp_') || token.startsWith('gho_'));
}

// 全局导出
window.validateGitHubToken = validateGitHubToken;