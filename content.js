(function () {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'REQUEST_UUID') {
            try {
                const dataStr = window.localStorage.getItem('__tea_cache_tokens_2608');
                if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data && data.user_unique_id) {
                        sendResponse({ uuid: data.user_unique_id });
                        return true;
                    }
                }
            } catch (e) {
                console.error("Juejin Notifier: Error reading localStorage", e);
            }
            sendResponse({ uuid: null });
        }
        return true;
    });
})();
