chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('checkJuejinMessages', { periodInMinutes: 5 });
    // Initial check on install
    checkMessages();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkJuejinMessages') {
        checkMessages();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_UUID') {
        chrome.storage.local.get(['uuid', 'loggedOutUuid'], (result) => {
            if (result.loggedOutUuid && result.loggedOutUuid === message.uuid) {
                return;
            }
            if (result.uuid !== message.uuid) {
                chrome.storage.local.remove(['loggedOutUuid'], () => {
                    chrome.storage.local.set({ uuid: message.uuid }, () => {
                        // Immediately check messages when UUID updates
                        checkMessages();
                    });
                });
            }

            // Ensure alarm is active
            chrome.alarms.get('checkJuejinMessages', (alarm) => {
                if (!alarm) {
                    chrome.alarms.create('checkJuejinMessages', { periodInMinutes: 5 });
                }
            });
        });
    } else if (message.type === 'CLEAR_UUID') {
        chrome.storage.local.remove(['uuid', 'lastMessageCount']);
        chrome.action.setBadgeText({ text: '' });
    } else if (message.type === 'MANUAL_REFRESH') {
        checkMessages().then(count => {
            sendResponse({ count: count });
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'LOGOUT') {
        chrome.storage.local.get(['uuid'], (result) => {
            if (result.uuid) {
                chrome.storage.local.set({ loggedOutUuid: result.uuid }, () => {
                    chrome.storage.local.remove(['uuid', 'lastMessageCount'], () => {
                        chrome.action.setBadgeText({ text: '' });
                        sendResponse({ success: true });
                    });
                });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;
    } else if (message.type === 'INTENT_LOGIN') {
        chrome.storage.local.remove(['loggedOutUuid']);
    }
});

async function checkMessages() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['uuid'], async (result) => {
            const uuid = result.uuid;
            if (!uuid) return resolve(null);

            try {
                const response = await fetch(`https://api.juejin.cn/interact_api/v1/message/count?uuid=${uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.err_no === 0 && data.data && data.data.count) {
                        const systemMessages = data.data.count["4"] || 0;

                        if (systemMessages > 0) {
                            chrome.action.setBadgeText({ text: '' + systemMessages });
                            // Red badge color
                            chrome.action.setBadgeBackgroundColor({ color: '#F53F3F' });
                        } else {
                            chrome.action.setBadgeText({ text: '' });
                        }

                        // Store the count to display in popup
                        chrome.storage.local.set({ lastMessageCount: systemMessages });
                        return resolve(systemMessages);
                    }
                }
            } catch (e) {
                console.error("Juejin Notifier: Error fetching messages", e);
            }
            resolve(null);
        });
    });
}

// Check when script starts to catch up any missed alarms
checkMessages();
