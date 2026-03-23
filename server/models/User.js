const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const UserSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
    maxlength: 80,
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  password: {
    type:     String,
    required: function() { return !this.googleId }, // Required only if not a Google user
    minlength: 6,
    select:   false,
  },
  googleId: {
    type:     String,
    unique:   true,
    sparse:   true,
  },
  isPremium: {
    type:    Boolean,
    default: false,
  },
  paddleTransactionId: {
    type: String,
    default: null,
  },
  interviewQuestionsGenerated: {
    type: Number,
    default: 0,
  },
  coverLettersGenerated: {
    type: Number,
    default: 0,
  },
  cvText: {
    type: String,
    maxLength: 3000,
  },
  gmailIntegration: {
    accessToken:  String,
    refreshToken: String,
  },
  gmailConnected: {
    type: Boolean,
    default: false,
  },
  autoTrackEmails: {
    type: Boolean,
    default: true,
  },
  scannedEmailIds: [
    {
      id: { type: String },
      date: { type: Date, default: Date.now }
    }
  ],
  cvAnalysisCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true })

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
})

// Compare passwords
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', UserSchema)
