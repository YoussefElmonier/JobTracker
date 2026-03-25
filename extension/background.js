/**
 * background.js - Handles API requests and SPA navigation for the extension
 */

// 1. Handle Navigation for SPAs (LinkedIn, Indeed)
// In SPAs like LinkedIn, clicking a job changes the URL via history.pushState 
// which doesn't reload the content script. This ensure we re-inject/detect that.
chrome.webNavigation?.onHistoryStateUpdated.addListener((details) => {
  if (details.url.includes("linkedin.com") || details.url.includes("indeed.com") || details.url.includes(":3000") || details.url.includes(":3001") || details.url.includes("trkr-job.vercel.app")) {
    console.log("📬 Background: SPA Navigation detected ->", details.url);
    // Explicitly re-inject or signal the content script
    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ["content.js"]
    }).catch(err => console.log("JobTrackr: Script already present or injection blocked."));
  }
});

// Also listen for simple updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('linkedin.com') || tab.url.includes('indeed.com') || tab.url.includes(':3000') || tab.url.includes(':3001') || tab.url.includes('trkr-job.vercel.app'))) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SAVE_JOB') {
    const { token, data } = request;
    const bearerToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    
    console.log('📬 Background: Incoming SAVE_JOB request');
    console.log('🔑 Token check:', bearerToken.substring(0, 15) + '...');

    fetch('https://trkr-job.vercel.app/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': bearerToken
      },
      body: JSON.stringify(data)
    })
    .then(async response => {
      console.log('📡 Background: Response Status ->', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Background: API Error ->', errorData.message);
        throw new Error(errorData.message || 'Failed to save job');
      }
      return response.json();
    })
    .then(result => {
      console.log('✅ Background: Job saved successfully!');
      sendResponse({ success: true, job: result });
    })
    .catch(error => {
      console.error('🚫 Background: Fetch failed ->', error.message);
      sendResponse({ success: false, error: error.message });
    });

    return true; // async sendResponse
  }
});
