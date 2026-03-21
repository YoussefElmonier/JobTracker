const companyEl = document.getElementById('company');
const titleEl = document.getElementById('title');
const saveBtn = document.getElementById('save-btn');
const statusEl = document.getElementById('status');
const authStatusEl = document.getElementById('auth-status');

let jobData = null;
let currentToken = null;

async function checkAuth(token) {
  if (!token) {
    authStatusEl.innerHTML = '<span style="color:#f43f5e">⚠️ No Token</span>';
    saveBtn.disabled = true;
    return;
  }
  
  try {
    const res = await fetch('http://localhost:3001/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      authStatusEl.innerHTML = '<span style="color:#10b981">● Connected</span>';
      saveBtn.disabled = false;
      currentToken = token;
    } else {
      authStatusEl.innerHTML = '<span style="color:#f43f5e">❌ Invalid Session</span>';
      saveBtn.disabled = true;
    }
  } catch (err) {
    authStatusEl.innerHTML = '<span style="color:#f43f5e">⚠️ Server Offline</span>';
    saveBtn.disabled = true;
  }
}

// Load saved token on popup open
chrome.storage.local.get(['jt_token'], (result) => {
  if (result.jt_token) {
    checkAuth(result.jt_token);
  } else {
    checkAuth(null);
  }
});

// Inject content script and get data from current tab
async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("linkedin.com") && !tab.url.includes("indeed.com")) {
      companyEl.innerText = "N/A";
      titleEl.innerText = "Not a Job Page";
      saveBtn.disabled = true;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'GET_DATA' }, (response) => {
      if (response && !response.error) {
        jobData = response;
        companyEl.innerText = jobData.company || "Unknown Company";
        titleEl.innerText = jobData.title || "Job Listing";
      }
    });
  } catch (err) {
    console.error(err);
  }
}

saveBtn.addEventListener('click', async () => {
  if (!currentToken || !jobData) return;

  saveBtn.disabled = true;
  statusEl.innerText = "Saving to Dashboard...";
  statusEl.className = "";

  chrome.runtime.sendMessage({
    type: 'SAVE_JOB',
    token: currentToken,
    data: jobData
  }, (response) => {
    if (response && response.success) {
      statusEl.innerText = "Successfully saved!";
      statusEl.className = "success";
      saveBtn.innerText = "✅ Saved!";
      setTimeout(() => window.close(), 1500);
    } else {
      statusEl.innerText = response?.error || "Failed to save.";
      statusEl.className = "error";
      saveBtn.disabled = false;
    }
  });
});

init();
