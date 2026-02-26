chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['refreshInterval'], (result) => {
        const interval = result.refreshInterval || 5;
        chrome.alarms.create('checkJuejinMessages', { periodInMinutes: interval });
    });
    checkMessages();
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkJuejinMessages') {
        checkMessages();
    }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SYNC_NOW') {
        fetchUuidFromTabs().then(async uuid => {
            const response = await checkMessages();
            sendResponse({ verified: !!response, counts: response });
        });
        return true;
    } else if (message.type === 'CLEAR_UUID') {
        chrome.storage.session.remove(['memoryMessageCounts']);
        chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts']);
        chrome.action.setBadgeText({ text: '' });
    } else if (message.type === 'MANUAL_REFRESH') {
        checkMessages().then(count => {
            sendResponse({ count: count });
        });
        return true;
    } else if (message.type === 'LOGOUT') {
        chrome.storage.session.remove(['memoryMessageCounts']);
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
                        expectedResponses--;
                        if (expectedResponses === 0 && !responded) {
                            resolve(null);
                        }
                        return;
                    }
                    if (response && response.uuid) {
                        if (!responded) {
                            responded = true;
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
    const fetchedUuid = await fetchUuidFromTabs();
    return new Promise((resolve) => {
        chrome.storage.local.get(['uuid', 'ignoredTypes'], async (result) => {
            const uuid = fetchedUuid || result.uuid;
            if (!uuid) return resolve(null);

            let memoryMessageCounts = null;
            try {
                const sessionResult = await chrome.storage.session.get(['memoryMessageCounts']);
                memoryMessageCounts = sessionResult.memoryMessageCounts || null;
            } catch (e) {
                console.warn("Session storage not fully supported or failed", e);
            }

            const ignoredTypes = result.ignoredTypes || [];
            const allTypes = ['1', '2', '3', '4', '7'];
            const typeNames = {
                '1': '赞和收藏',
                '2': '新增粉丝',
                '3': '评论',
                '4': '系统通知',
                '7': '私信'
            };
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
                        let totalMessages = 0;
                        let newMsgTypes = [];
                        const oldCounts = memoryMessageCounts || {};
                        allTypes.forEach(type => {
                            if (!ignoredTypes.includes(type)) {
                                const currentCount = counts[type] || 0;
                                totalMessages += currentCount;
                                const oldCount = oldCounts[type] || 0;
                                if (currentCount > oldCount) {
                                    newMsgTypes.push(typeNames[type]);
                                }
                            }
                        });
                        if (newMsgTypes.length > 0) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icon128.png',
                                title: 'Juejin Notifier',
                                message: `您有新的 ${newMsgTypes.join('、')}，请及时查看！`,
                                priority: 1
                            });
                        }
                        if (totalMessages > 0) {
                            chrome.action.setBadgeText({ text: '' + totalMessages });
                            chrome.action.setBadgeBackgroundColor({ color: '#F53F3F' });
                        } else {
                            chrome.action.setBadgeText({ text: '' });
                        }
                        chrome.storage.local.remove(['loggedOutUuid'], () => {
                            chrome.storage.local.set({
                                uuid: uuid,
                                lastMessageCount: totalMessages,
                                lastMessageCounts: counts
                            });
                        });
                        chrome.storage.session.set({ memoryMessageCounts: counts });
                        // Fetch user info if not already cached for this uuid
                        chrome.storage.local.get(['userInfo', 'userInfoUuid'], (userRes) => {
                            if (!userRes.userInfo || userRes.userInfoUuid !== uuid) {
                                fetchUserInfo(uuid);
                            }
                        });
                        return resolve(counts);
                    } else {
                        chrome.storage.session.remove(['memoryMessageCounts']);
                        chrome.storage.local.remove(['uuid', 'lastMessageCount', 'lastMessageCounts']);
                        chrome.action.setBadgeText({ text: '' });
                    }
                } else {
                    chrome.storage.session.remove(['memoryMessageCounts']);
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
async function fetchUserInfo(uuid) {
    try {
        const response = await fetch(`https://api.juejin.cn/user_api/v1/user/get?uuid=${uuid}`);
        if (response.ok) {
            const data = await response.json();
            if (data.err_no === 0 && data.data) {
                const { avatar_large, user_name, level, description } = data.data;
                chrome.storage.local.set({
                    userInfo: { avatar_large, user_name, level, description },
                    userInfoUuid: uuid
                });
            }
        }
    } catch (e) {
        console.error('Juejin Notifier: Error fetching user info', e);
    }
}
checkMessages();
