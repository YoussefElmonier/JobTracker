const jwt  = require('jsonwebtoken')
const User = require('../models/User')

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  let token = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token
  }

  if (!token) {
    console.warn('🛡️ Auth Middleware: No token found in header or cookies')
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log('🛡️ Auth Middleware: Verified user ->', decoded.userId)
    req.userId    = decoded.userId
    next()
  } catch (err) {
    console.error('🛡️ Auth Middleware: Verification Failed!', err.message)
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}
