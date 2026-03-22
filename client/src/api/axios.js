import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`,
  timeout: 10000,
})

// Attach JWT before every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jt_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error handler
api.interceptors.response.use(
  res => res,
  err => {
    // 401 should redirect to login BUT NOT for login/register themselves!
    const isAuthRoute = err.config.url.includes('/auth/login') || err.config.url.includes('/auth/register')
    
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('jt_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
