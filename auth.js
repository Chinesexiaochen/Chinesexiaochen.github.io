// 认证功能
const CORRECT_PASSWORD = '668181';

// 显示/隐藏密码
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleIcon = document.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

// 检查密码
function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');
    const authBtn = document.querySelector('.auth-btn');
    
    const password = passwordInput.value.trim();
    
    if (password === CORRECT_PASSWORD) {
        // 密码正确
        errorMessage.classList.add('hidden');
        loginSuccess();
    } else {
        // 密码错误
        errorMessage.classList.remove('hidden');
        passwordInput.value = '';
        passwordInput.focus();
        
        // 添加抖动效果
        authBtn.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            authBtn.style.animation = '';
        }, 500);
    }
}

// 登录成功
function loginSuccess() {
    const authContainer = document.getElementById('authContainer');
    const mainContainer = document.getElementById('mainContainer');
    
    // 显示成功动画
    const authBox = document.querySelector('.auth-box');
    authBox.style.animation = 'fadeOutUp 0.5s ease forwards';
    
    setTimeout(() => {
        authContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
        
        // 记录登录时间
        document.getElementById('loginTime').textContent = new Date().toLocaleString();
        
        // 初始化云盘
        if (typeof cloudDrive !== 'undefined') {
            cloudDrive.init();
        }
    }, 500);
}

// 退出登录
function logout() {
    const authContainer = document.getElementById('authContainer');
    const mainContainer = document.getElementById('mainContainer');
    const passwordInput = document.getElementById('passwordInput');
    
    mainContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    
    // 重置表单
    passwordInput.value = '';
    document.querySelector('.toggle-password i').className = 'fas fa-eye';
    document.getElementById('errorMessage').classList.add('hidden');
    
    // 显示入场动画
    const authBox = document.querySelector('.auth-box');
    authBox.style.animation = 'fadeInDown 0.5s ease forwards';
}

// 回车键支持
document.getElementById('passwordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

// 初始焦点
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('passwordInput').focus();
});

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    
    @keyframes fadeOutUp {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
    
    @keyframes fadeInDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
