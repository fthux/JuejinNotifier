(function () {
    function checkLoginState() {
        try {
            const dataStr = window.localStorage.getItem('__tea_cache_tokens_2608');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data && data.user_unique_id) {
                    const uuid = data.user_unique_id;
                    chrome.runtime.sendMessage({ type: "SYNC_UUID", uuid: uuid });
                } else {
                    chrome.runtime.sendMessage({ type: "CLEAR_UUID" });
                }
            } else {
                chrome.runtime.sendMessage({ type: "CLEAR_UUID" });
            }
        } catch (e) {
            console.error("Juejin Notifier: Error reading localStorage", e);
        }
    }

    // Check immediately
    checkLoginState();

    // Poll locally every 10 seconds to detect login without page reload
    setInterval(checkLoginState, 10000);
})();
