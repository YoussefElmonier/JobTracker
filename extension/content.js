(function() {
  // --- 1. Magic Token Sync (Dashboard Only) ---
  // We run this ALWAYS when the URL matches, even if jt_injected is true,
  // because SPA navigation (Login -> Dashboard) doesn't reload the page.
  const url = window.location.href;
  const isTrkrSite = url.includes(":3000") || url.includes(":3001") || url.includes("trkr-job.vercel.app");
  if (isTrkrSite) {
    const token = localStorage.getItem('jt_token');
    if (token) {
      chrome.storage.local.set({ jt_token: token.replace(/Bearer /i, '').trim() }, () => {
        console.log("trkr: API Token synced successfully from platform.");
      });
    }
  }

  if (window.jt_injected && !isTrkrSite) {
    return;
  }
  window.jt_injected = true;
  console.log("trkr: Clipper Active.");

  if (isTrkrSite) return;

  // --- 2. Robust Scraper Logic ---
  function scrapJobData() {
    const currentUrl = window.location.href;
    let company = "Unknown Company", title = "Job Listing", location = "", description = "", companyLogo = "";

    if (currentUrl.includes("linkedin.com")) {
      const root = document.querySelector('.jobs-search__job-details--container, .jobs-search-two-pane__details, .job-view-layout, .details-pane') || document;
      
      const titleEl = root.querySelector(".job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24, h1");
      if (titleEl) title = titleEl.innerText.trim();

      const companyEl = root.querySelector(".job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .top-card-layout__subtitle-line-v1 a");
      if (companyEl) company = companyEl.innerText.trim();

      const logoEl = root.querySelector(".job-details-jobs-unified-top-card__company-logo img, .jobs-unified-top-card__company-logo img, .top-card-layout__entity-image-container img, img.topcard__logo-image");
      const imgUrl = logoEl?.getAttribute('src') || logoEl?.getAttribute('data-delayed-url') || logoEl?.getAttribute('data-ghost-url');
      if (imgUrl && !imgUrl.includes('data:image')) companyLogo = imgUrl;

      const locEl = root.querySelector(".job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .topcard__flavor--bullet, .jobs-unified-top-card__primary-description span:nth-child(2), .job-details-jobs-unified-top-card__primary-description span:nth-child(2)");
      const locationText = locEl?.innerText || root.querySelector("[data-job-location]")?.innerText || "";
      location = locationText.trim();

      const descEl = root.querySelector("div#job-details, .jobs-description-content__text, article");
      if (descEl) description = descEl.innerText.trim();
    } 
    else if (currentUrl.includes("indeed.com")) {
      const root = document.querySelector("#jobsearch-ViewJobButtons-container")?.closest('.jobsearch-ViewJobLayout-jobDisplay') || document;
      title = root.querySelector("h1.jobsearch-JobInfoHeader-title")?.innerText || "Indeed Job";
      company = root.querySelector("div[data-company-name='true']")?.innerText || "Unknown Company";
      location = root.querySelector("div[data-testid='inline-custom-employer-location'], div[data-testid='job-location']")?.innerText || "";
      description = root.querySelector("div#jobDescriptionText")?.innerText || "";
    }

    return { title: title.trim(), company: company.trim(), companyLogo, location: location.trim(), description: description.trim(), url: currentUrl };
  }

  // --- 3. Save Logic ---
  async function saveToJobTrackr() {
    const data = scrapJobData();
    chrome.storage.local.get(['jt_token'], (res) => {
      const token = res.jt_token;
      if (!token) {
        showToast("⚠️ API Token missing. Visit Dashboard to sync!", true);
        return;
      }

      chrome.runtime.sendMessage({ type: 'SAVE_JOB', token, data }, (response) => {
        if (response && response.success) {
          showToast(`✅ Saved ${data.company}!`);
        } else {
          showToast(`❌ Save failed: ${response?.error || 'Unknown Error'}`, true);
        }
      });
    });
  }

  // --- 4. Observers & Listeners ---
  function showToast(message, isError = false) {
    let t = document.getElementById('jt-toast') || document.createElement('div');
    t.id = 'jt-toast';
    t.style.cssText = `position:fixed; bottom:32px; right:32px; padding:12px 24px; border-radius:16px; z-index:9999999; font-weight:700; font-family:'Sora', -apple-system, sans-serif; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 10px 40px rgba(0,0,0,0.1); border:1px solid ${isError ? '#fecdd3' : '#eef2ff'}; background:#ffffff; color:#111111; display:flex; align-items:center; gap:10px;`;
    t.innerText = message;
    if (!document.body.contains(t)) document.body.appendChild(t);
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 4000);
  }

  function startListening() {
    console.log("JobTrackr: Listening for Apply clicks...");
    document.body.addEventListener('click', (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      let isApply = false;
      for (const el of path) {
        if (!el?.tagName) continue;
        const txt = el.innerText?.toLowerCase().trim() || "";
        const cls = el.className?.toString() || "";
        const role = el.getAttribute('role') || "";
        
        if (cls.includes('jobs-apply-button') || 
            cls.includes('jobs-s-apply') || 
            txt === 'apply' || 
            txt === 'easy apply' || 
            txt === 'apply now' ||
            (el.tagName === 'BUTTON' && txt.includes('apply')) ||
            role === 'button' && txt.includes('apply')) {
          isApply = true;
          break;
        }
      }
      if (isApply) {
        console.log("JobTrackr: Apply button detected.");
        setTimeout(saveToJobTrackr, 800);
      }
    }, true);
  }

  // Start
  startListening();
  
  // Listen for popup requests
  chrome.runtime.onMessage.addListener((req, s, res) => {
    if (req.type === 'GET_DATA') res(scrapJobData());
    return true;
  });

})();
