const jwt  = require('jsonwebtoken')
const User = require('../models/User')

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  console.log('🛡️ Auth Middleware: Header ->', authHeader ? 'Present' : 'Missing')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('🛡️ Auth Middleware: Malformed header')
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = authHeader.split(' ')[1]

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
