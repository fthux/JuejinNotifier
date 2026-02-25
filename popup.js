document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loading-state');
    const loginState = document.getElementById('login-state');
    const statusState = document.getElementById('status-state');

    const loginBtn = document.getElementById('login-btn');
    const viewMsgBtn = document.getElementById('view-msg-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const msgCountEl = document.getElementById('msg-count');
    const refreshIntervalSelect = document.getElementById('refresh-interval');
    const sponsorLink = document.getElementById('sponsor-link');

    const msg4El = document.getElementById('msg-4');
    const msg1El = document.getElementById('msg-1');
    const msg2El = document.getElementById('msg-2');
    const msg3El = document.getElementById('msg-3');
    const msg7El = document.getElementById('msg-7');

    function updateDisplay(countsObj) {
        if (!countsObj) countsObj = {};

        const c1 = countsObj['1'] || 0;
        const c2 = countsObj['2'] || 0;
        const c3 = countsObj['3'] || 0;
        const c4 = countsObj['4'] || 0;
        const c7 = countsObj['7'] || 0;

        msg1El.textContent = c1;
        msg2El.textContent = c2;
        msg3El.textContent = c3;
        msg4El.textContent = c4;
        msg7El.textContent = c7;

        msg1El.style.color = c1 > 0 ? '#F53F3F' : '#1e80ff';
        msg2El.style.color = c2 > 0 ? '#F53F3F' : '#1e80ff';
        msg3El.style.color = c3 > 0 ? '#F53F3F' : '#1e80ff';
        msg4El.style.color = c4 > 0 ? '#F53F3F' : '#1e80ff';
        msg7El.style.color = c7 > 0 ? '#F53F3F' : '#1e80ff';
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
    chrome.storage.local.get(['uuid', 'lastMessageCount', 'lastMessageCounts', 'refreshInterval'], (result) => {
        if (result.refreshInterval) {
            refreshIntervalSelect.value = result.refreshInterval.toString();
        } else {
            refreshIntervalSelect.value = '5'; // default
        }

        if (result.uuid) {
            showState('status');
            const counts = result.lastMessageCounts || { '4': result.lastMessageCount || 0 };
            updateDisplay(counts);
        } else {
            showState('login');
        }
    });

    // Handle interval change
    refreshIntervalSelect.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value, 10);
        chrome.storage.local.set({ refreshInterval: newInterval }, () => {
            chrome.runtime.sendMessage({ type: 'UPDATE_ALARM', interval: newInterval });
        });
    });

    // Listen for changes so popup updates instantly when user logs in/out
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.uuid) {
                if (changes.uuid.newValue) {
                    showState('status');
                    chrome.storage.local.get(['lastMessageCounts', 'lastMessageCount'], (res) => {
                        updateDisplay(res.lastMessageCounts || { '4': res.lastMessageCount || 0 });
                    });
                } else {
                    showState('login');
                }
            }
            if (changes.lastMessageCounts) {
                updateDisplay(changes.lastMessageCounts.newValue || {});
            } else if (changes.lastMessageCount) {
                updateDisplay({ '4': changes.lastMessageCount.newValue || 0 });
            }
        }
    });

    loginBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'INTENT_LOGIN' });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && (currentTab.url.includes('juejin.cn') || currentTab.url.includes('juejin.im'))) {
                // 如果当前已经是掘金页面，则不打开新标签页，直接关闭弹窗即可
                window.close();
            } else {
                chrome.tabs.create({ url: 'https://juejin.cn/' });
            }
        });
    });

    viewMsgBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://juejin.cn/notification/system' });
    });

    logoutBtn.addEventListener('click', () => {
        confirmModal.classList.remove('hidden');
    });

    modalCancelBtn.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
    });

    modalConfirmBtn.addEventListener('click', () => {
        modalConfirmBtn.textContent = '退出中...';
        modalConfirmBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'LOGOUT' }, (response) => {
            confirmModal.classList.add('hidden');
            modalConfirmBtn.textContent = '确定退出';
            modalConfirmBtn.disabled = false;
            showState('login');
        });
    });

    refreshBtn.addEventListener('click', () => {
        refreshBtn.textContent = '...';
        refreshBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'MANUAL_REFRESH' }, (response) => {
            refreshBtn.textContent = '刷新';
            refreshBtn.disabled = false;
            // Background js sends back {count: countsObj}
            if (response && response.count) {
                updateDisplay(response.count);
            }
        });
    });

    if (sponsorLink) {
        sponsorLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://fthux.com' });
        });
    }
});
