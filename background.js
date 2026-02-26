chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['refreshInterval'], (result) => {
        const interval = result.refreshInterval || 5;
        chrome.alarms.create('checkJuejinMessages', { periodInMinutes: interval });
    });
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
                    chrome.storage.local.get(['refreshInterval'], (result) => {
                        const interval = result.refreshInterval || 5;
                        chrome.alarms.create('checkJuejinMessages', { periodInMinutes: interval });
                    });
                }
            });
        });
    } else if (message.type === 'CLEAR_UUID') {
        chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts']);
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
                    chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts'], () => {
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
    } else if (message.type === 'UPDATE_ALARM') {
        const interval = message.interval || 5;
        chrome.alarms.create('checkJuejinMessages', { periodInMinutes: interval });
    }
});

async function checkMessages() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['uuid', 'ignoredTypes'], async (result) => {
            const uuid = result.uuid;
            if (!uuid) return resolve(null);

            const ignoredTypes = result.ignoredTypes || [];
            const allTypes = ['1', '2', '3', '4', '7'];

            // Check if all message types are ignored
            const allIgnored = allTypes.every(t => ignoredTypes.includes(t));
            if (allIgnored) {
                chrome.action.setBadgeText({ text: '' });
                return resolve(null);
            }

            try {
                const response = await fetch(`https://api.juejin.cn/interact_api/v1/message/count?uuid=${uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.err_no === 0 && data.data && data.data.count) {
                        const counts = data.data.count;

                        // Calculate total messages excluding ignored types
                        let totalMessages = 0;
                        allTypes.forEach(type => {
                            if (!ignoredTypes.includes(type)) {
                                totalMessages += (counts[type] || 0);
                            }
                        });

                        if (totalMessages > 0) {
                            chrome.action.setBadgeText({ text: '' + totalMessages });
                            // Red badge color
                            chrome.action.setBadgeBackgroundColor({ color: '#F53F3F' });
                        } else {
                            chrome.action.setBadgeText({ text: '' });
                        }

                        // Store the count to display in popup
                        chrome.storage.local.set({
                            lastMessageCount: totalMessages,
                            lastMessageCounts: counts
                        });
                        return resolve(counts);
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
