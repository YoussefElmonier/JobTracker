const mongoose = require('mongoose')

const JobSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  company: {
    type:     String,
    required: [true, 'Company is required'],
    trim:     true,
    maxlength: 120,
  },
  title: {
    type:     String,
    required: [true, 'Job title is required'],
    trim:     true,
    maxlength: 150,
  },
  status: {
    type:    String,
    enum:    ['applied', 'interview', 'waiting', 'offer', 'rejected'],
    default: 'applied',
  },
  dateApplied: {
    type:    Date,
    default: Date.now,
  },
  url: {
    type:    String,
    trim:    true,
    default: '',
  },
  contact: {
    type:    String,
    trim:    true,
    default: '',
  },
  notes: {
    type:    String,
    default: '',
  },
  description: {
    type:    String,
    default: '',
  },
  location: {
    type:    String,
    default: '',
  },
  aiSummary: {
    free: { type: [String], default: [] },
    premium: { type: [String], default: [] }
  },
  aiSalary: {
    free: {
      mid: { type: Number, default: null },
      currency: { type: String, default: null },
      period: { type: String, default: 'yearly' },
      location: { type: String, default: null }
    },
    premium: {
      low: { type: Number, default: null },
      mid: { type: Number, default: null },
      high: { type: Number, default: null },
      currency: { type: String, default: null },
      period: { type: String, default: 'yearly' },
      location: { type: String, default: null }
    }
  },
  aiCoverLetter: {
    type: mongoose.Schema.Types.Mixed,
    default: { free: '', premium: '' }
  },
  interviewQuestions: {
    free: { type: Object, default: null },
    premium: { type: Object, default: null }
  },
  questionConfirmations: [{
    questionIndex: Number,
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  companyLogo: {
    type:    String,
    default: '',
  },
  cvAnalysis: {
    type: Object,
    default: null
  },
}, { timestamps: true })

module.exports = mongoose.model('Job', JobSchema)
