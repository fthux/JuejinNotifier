document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loading-state');
    const loginState = document.getElementById('login-state');
    const statusState = document.getElementById('status-state');

    const loginBtn = document.getElementById('login-btn');
    const viewMsgBtn = document.getElementById('view-msg-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const msgCountEl = document.getElementById('msg-count');

    function updateDisplay(count) {
        msgCountEl.textContent = count;
        if (count > 0) {
            msgCountEl.style.color = '#F53F3F'; // Red for unread
        } else {
            msgCountEl.style.color = '#1e80ff'; // Blue for zero
        }
    }

    function showState(state) {
        loadingState.classList.add('hidden');
        loginState.classList.add('hidden');
        statusState.classList.add('hidden');

        if (state === 'login') {
            loginState.classList.remove('hidden');
        } else if (state === 'status') {
            statusState.classList.remove('hidden');
        }
    }

    // Retrieve current status
    chrome.storage.local.get(['uuid', 'lastMessageCount'], (result) => {
        if (result.uuid) {
            showState('status');
            const count = result.lastMessageCount || 0;
            updateDisplay(count);
        } else {
            showState('login');
        }
    });

    loginBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://juejin.cn/' });
    });

    viewMsgBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://juejin.cn/notification/system' });
    });

    refreshBtn.addEventListener('click', () => {
        refreshBtn.textContent = '...';
        refreshBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'MANUAL_REFRESH' }, (response) => {
            refreshBtn.textContent = '刷新';
            refreshBtn.disabled = false;
            if (response && response.count !== null && response.count !== undefined) {
                updateDisplay(response.count);
            }
        });
    });
});
