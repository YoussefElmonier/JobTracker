# JobTrackr Deployment Blueprint

This plan outlines the steps to move **JobTrackr** from your local machine to the cloud.

## 🏗️ Phase 1: Code Optimization for Production

Before pushing, we need to make the code flexible enough to handle both local and live environments.

### 1.1 Dynamic API URLs (Frontend)
Change hardcoded `localhost` to use environment variables.
- **File:** [client/src/api/axios.js](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/client/src/api/axios.js)
- **Action:**
  ```javascript
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
  });
  ```

### 1.2 Extension Dynamic Config
The extension needs to know if it's talking to a local or live server.
- **File:** [extension/content.js](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/extension/content.js)
- **Action:** Define a `CONFIG` object at the top.
  ```javascript
  const PROD_URL = 'https://your-api.onrender.com';
  const DEV_URL = 'http://localhost:5001';
  const API_BASE = PROD_URL; // Switch this before publishing
  ```

---

## 🚀 Phase 2: Backend Deployment (Render.com)

Render is recommended for Node.js backends.

1. **Database:** Ensure your `MONGO_URI` is correctly set in your environment variables on Render.
2. **Setup:**
   - Connect your GitHub repo.
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `node index.js`
3. **Env Vars:** Add the following in Render's dashboard:
   - `PORT`: 10000 (standard for Render)
   - `MONGO_URI`: Your Atlas string.
   - `JWT_SECRET`: A long, random string.
   - `CLIENT_URL`: `https://your-jobtrackr.vercel.app` (The frontend URL you'll get in Phase 3).

---

## 🎨 Phase 3: Frontend Deployment (Vercel)

Vercel is the gold standard for React deployment.

1. **Setup:**
   - Link your repo to Vercel.
   - Framework Preset: **Vite**
   - Root Directory: `client`
2. **Env Vars:** Add to Vercel:
   - `VITE_API_URL`: `https://your-api.onrender.com/api`
3. **Build:** Vercel will automatically run `npm run build` and serve the production `dist` folder.

---

## 🧩 Phase 4: Chrome Extension Finalization

Once the backend is live:

1. **Update Manifest:**
   - **File:** [extension/manifest.json](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/extension/manifest.json)
   - **Change:** Add your production API URL to `host_permissions`.
     ```json
     "host_permissions": [
       "https://*.linkedin.com/*",
       "https://*.indeed.com/*",
       "https://your-api.onrender.com/*"
     ]
     ```
2. **Switch URL:** Set the `API_BASE` in [content.js](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/extension/content.js) to the production URL.

---

## 🧪 Phase 5: Final "Smoke Test"

1. **Cors Check:** Ensure the backend `CLIENT_URL` matches your Vercel URL exactly.
2. **JWT Check:** Try logging in/out on the live site.
3. **Clipper Check:** Open LinkedIn and hit "Apply"—ensure the toast notification appears on the live backend.

---

> [!IMPORTANT]
> **Security Reminder**: Never upload your [.env](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/server/.env) file to GitHub. Add [.env](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/server/.env) to your root [.gitignore](file:///Users/youssefelmonier/Documents/GitHub/JobTracker/client/.gitignore) if it isn't there already.

> [!TIP]
> Use **MongoDB Atlas** for the database so your data is always available regardless of where your backend is hosted.
