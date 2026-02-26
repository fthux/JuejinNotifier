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
    if (message.type === 'SYNC_NOW') {
        // Active UUID check
        fetchUuidFromTabs().then(async uuid => {
            // Check messages against API, which naturally purges invalid UUIDs
            const response = await checkMessages();
            // Return validation result (counts if true login, null if failed/empty)
            sendResponse({ verified: !!response, counts: response });
        });
        return true;
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

async function fetchUuidFromTabs() {
    return new Promise((resolve) => {
        chrome.tabs.query({ url: ["*://juejin.cn/*", "*://juejin.im/*"] }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                return resolve(null);
            }

            let responded = false;
            let expectedResponses = tabs.length;

            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_UUID' }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Ignore errors from tabs where content script isn't loaded
                        expectedResponses--;
                        if (expectedResponses === 0 && !responded) {
                            resolve(null);
                        }
                        return;
                    }

                    if (response && response.uuid) {
                        if (!responded) {
                            responded = true;
                            // Found a UUID, check if it's the logged-out one. DO NOT store it yet.
                            chrome.storage.local.get(['uuid', 'loggedOutUuid'], (result) => {
                                if (result.loggedOutUuid === response.uuid) {
                                    resolve(null);
                                    return;
                                }
                                resolve(response.uuid);
                            });
                        }
                    } else {
                        expectedResponses--;
                        if (expectedResponses === 0 && !responded) {
                            resolve(null);
                        }
                    }
                });
            });

            // Timeout safety
            setTimeout(() => {
                if (!responded) {
                    responded = true;
                    resolve(null);
                }
            }, 2000);
        });
    });
}

async function checkMessages() {
    // First try to fetch the latest UUID from any open tabs
    const fetchedUuid = await fetchUuidFromTabs();

    return new Promise((resolve) => {
        chrome.storage.local.get(['uuid', 'ignoredTypes'], async (result) => {
            const uuid = fetchedUuid || result.uuid;
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

                        // Store the validated uuid and counts to display in popup
                        chrome.storage.local.remove(['loggedOutUuid'], () => {
                            chrome.storage.local.set({
                                uuid: uuid,
                                lastMessageCount: totalMessages,
                                lastMessageCounts: counts
                            });
                        });
                        return resolve(counts);
                    } else {
                        // API indicates the UUID is invalid or expired
                        chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts']);
                        chrome.action.setBadgeText({ text: '' });
                    }
                } else {
                    // HTTP error (e.g., 401, 403), likely invalid credentials
                    chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts']);
                    chrome.action.setBadgeText({ text: '' });
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
