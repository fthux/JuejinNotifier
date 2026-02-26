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
    let ignoredTypes = [];
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
        msg1El.style.color = (c1 > 0 && !ignoredTypes.includes('1')) ? '#F53F3F' : '';
        msg2El.style.color = (c2 > 0 && !ignoredTypes.includes('2')) ? '#F53F3F' : '';
        msg3El.style.color = (c3 > 0 && !ignoredTypes.includes('3')) ? '#F53F3F' : '';
        msg4El.style.color = (c4 > 0 && !ignoredTypes.includes('4')) ? '#F53F3F' : '';
        msg7El.style.color = (c7 > 0 && !ignoredTypes.includes('7')) ? '#F53F3F' : '';
        document.querySelectorAll('.msg-item').forEach(item => {
            const type = item.getAttribute('data-type');
            const btn = item.querySelector('.toggle-ignore-btn');
            const label = item.querySelector('.ignored-label');
            const countSpan = item.querySelector('.highlight');
            if (ignoredTypes.includes(type)) {
                item.classList.add('ignored');
                btn.textContent = '开启';
                label.classList.remove('hidden');
                countSpan.classList.remove('hidden');
            } else {
                item.classList.remove('ignored');
                btn.textContent = '忽略';
                label.classList.add('hidden');
                countSpan.classList.remove('hidden');
            }
        });
    }
    document.querySelectorAll('.toggle-ignore-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.msg-item');
            const type = item.getAttribute('data-type');
            if (ignoredTypes.includes(type)) {
                ignoredTypes = ignoredTypes.filter(t => t !== type);
            } else {
                ignoredTypes.push(type);
            }
            chrome.storage.local.set({ ignoredTypes: ignoredTypes }, () => {
                refreshBtn.click();
            });
        });
    });
    function showState(state) {
        loadingState.classList.add('hidden');
        loginState.classList.add('hidden');
        statusState.classList.add('hidden');
        if (state === 'login') {
            loginState.classList.remove('hidden');
        } else if (state === 'status') {
            statusState.classList.remove('hidden');
        } else if (state === 'loading') {
            loadingState.classList.remove('hidden');
        }
    }
    const themeSelect = document.getElementById('theme-select');
    let currentSystemThemeListener = null;
    function applyTheme(themeSetting) {
        if (themeSetting === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (themeSetting === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        }
    }
    function updateSystemThemeListener(themeSetting) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (currentSystemThemeListener) {
            mediaQuery.removeEventListener('change', currentSystemThemeListener);
            currentSystemThemeListener = null;
        }
        if (themeSetting === 'system') {
            currentSystemThemeListener = (e) => {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            };
            mediaQuery.addEventListener('change', currentSystemThemeListener);
        }
    }
    showState('loading');
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (response) => {
        chrome.storage.local.get(['refreshInterval', 'ignoredTypes', 'theme'], (result) => {
            ignoredTypes = result.ignoredTypes || [];
            const themePref = result.theme || 'system';
            themeSelect.value = themePref;
            applyTheme(themePref);
            updateSystemThemeListener(themePref);
            if (result.refreshInterval) {
                refreshIntervalSelect.value = result.refreshInterval.toString();
            } else {
                refreshIntervalSelect.value = '5';
            }
            if (response && response.verified) {
                showState('status');
                updateDisplay(response.counts);
            } else {
                showState('login');
            }
        });
    });
    themeSelect.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        chrome.storage.local.set({ theme: newTheme }, () => {
            applyTheme(newTheme);
            updateSystemThemeListener(newTheme);
        });
    });
    refreshIntervalSelect.addEventListener('change', (e) => {
        const newInterval = parseInt(e.target.value, 10);
        chrome.storage.local.set({ refreshInterval: newInterval }, () => {
            chrome.runtime.sendMessage({ type: 'UPDATE_ALARM', interval: newInterval });
            refreshBtn.click();
        });
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            let requiresUpdateDisplay = false;
            if (changes.ignoredTypes) {
                ignoredTypes = changes.ignoredTypes.newValue || [];
                requiresUpdateDisplay = true;
            }
            if (changes.uuid) {
                if (changes.uuid.newValue) {
                    showState('status');
                    requiresUpdateDisplay = true;
                } else {
                    showState('login');
                }
            }
            if (changes.lastMessageCounts || changes.lastMessageCount) {
                requiresUpdateDisplay = true;
            }
            if (requiresUpdateDisplay) {
                chrome.storage.local.get(['lastMessageCounts', 'lastMessageCount'], (res) => {
                    updateDisplay(res.lastMessageCounts || { '4': res.lastMessageCount || 0 });
                });
            }
        }
    });
    loginBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'INTENT_LOGIN' });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.url && (currentTab.url.includes('juejin.cn') || currentTab.url.includes('juejin.im'))) {
                window.close();
            } else {
                chrome.tabs.create({ url: 'https://juejin.cn/' });
            }
        });
    });
    viewMsgBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://juejin.cn/notification' });
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
        refreshBtn.textContent = '刷新中...';
        refreshBtn.disabled = true;
        chrome.runtime.sendMessage({ type: 'MANUAL_REFRESH' }, (response) => {
            refreshBtn.textContent = '刷新';
            refreshBtn.disabled = false;
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
