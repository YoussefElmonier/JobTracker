const express  = require('express')
const Job      = require('../models/Job')
const User     = require('../models/User')
const auth     = require('../middleware/auth')
const ai       = require('../utils/ai')
const logo     = require('../utils/logo')
const axios    = require('axios')
const cheerio  = require('cheerio')
const Groq     = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const router = express.Router()
router.use(auth)

// ─── Helper: enrich logo only ─────────────────────────────────────────────────
const enrichLogo = async (jobData) => {
  if (jobData.company && !jobData.companyLogo) {
    const url = await logo.getLogoByName(jobData.company)
    if (url) jobData.companyLogo = url
  }
  return jobData
}

// ─── Helper: run tiered AI for Summary + Salary on job create/update ──────────
// Respects existing cache — never calls Groq if data already exists for that tier
const runAI = async (job, isPremium) => {
  if (!job.description) return

  const tier = isPremium ? 'premium' : 'free'

  // Summary
  const summaryEmpty =
    !job.aiSummary?.[tier] || job.aiSummary[tier].length === 0
  if (summaryEmpty) {
    job.aiSummary = job.aiSummary || { free: [], premium: [] }
    job.aiSummary[tier] = await ai.generateSummary(job.description, isPremium)
  }

  // Salary — re-run if mid is missing OR if location was never detected
  const salaryEmpty = !job.aiSalary?.[tier]?.mid || !job.aiSalary?.[tier]?.location
  if (salaryEmpty) {
    job.aiSalary = job.aiSalary || {
      free: { mid: null, currency: null, period: 'yearly', location: null },
      premium: { low: null, mid: null, high: null, currency: null, period: 'yearly', location: null }
    }
    job.aiSalary[tier] = await ai.generateSalaryInsights(job.description, isPremium, job.location)
  }
}

// ─── Helper: strip AI data the user is not allowed to see ────────────────────
// The GET /jobs route always calls this before responding
// effectivePremium = isPremium || isPremiumPreview (free user's trial slot)
const filterJobForUser = (job, isPremium) => {
  const j = job.toObject ? job.toObject() : { ...job }

  // A free user on a preview job gets premium-tier content
  const effectivePremium = isPremium || !!j.isPremiumPreview

  // Summary — return a plain array for the effective tier
  const rawSummary = j.aiSummary
  if (rawSummary && typeof rawSummary === 'object' && !Array.isArray(rawSummary)) {
    j.aiSummary = effectivePremium
      ? (rawSummary.premium?.length ? rawSummary.premium : rawSummary.free || [])
      : (rawSummary.free || [])
  } else if (!Array.isArray(j.aiSummary)) {
    j.aiSummary = []
  }

  // Salary — return a plain object for the effective tier
  const rawSalary = j.aiSalary
  if (rawSalary && typeof rawSalary === 'object' && ('free' in rawSalary || 'premium' in rawSalary)) {
    j.aiSalary = effectivePremium
      ? (rawSalary.premium?.mid ? rawSalary.premium : rawSalary.free || null)
      : (rawSalary.free || null)
  }

  // Interview questions — return the flat { behavioral,technical,company_fit } for the effective tier
  const rawQ = j.interviewQuestions
  if (rawQ && typeof rawQ === 'object') {
    if (rawQ.free !== undefined || rawQ.premium !== undefined) {
      const tierResult = effectivePremium
        ? (rawQ.premium || rawQ.free || null)
        : (rawQ.free || null)
      j.interviewQuestions = tierResult
    } else if (rawQ.behavioral) {
      j.interviewQuestions = rawQ
    } else {
      j.interviewQuestions = null
    }
  } else {
    j.interviewQuestions = null
  }

  // Cover letter — return a plain string for the effective tier
  const rawCL = j.aiCoverLetter
  if (rawCL && typeof rawCL === 'object') {
    j.aiCoverLetter = effectivePremium
      ? (rawCL.premium || rawCL.free || '')
      : (rawCL.free || '')
  } else if (typeof rawCL !== 'string') {
    j.aiCoverLetter = ''
  }

  return j
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/jobs
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const jobs = await Job.find({ user: req.userId }).sort({ createdAt: -1 })
    res.json(jobs.map(j => filterJobForUser(j, !!user?.isPremium)))
  } catch (err) {
    console.error('GET /jobs error:', err)
    res.status(500).json({ message: 'Failed to fetch jobs' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs — create
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const isPremium = !!user?.isPremium

    let jobData = req.body
    if (!jobData.company || !jobData.title) {
      return res.status(400).json({ message: 'Company and title are required' })
    }
    jobData.user = req.userId

    // Free plan job limit
    if (!isPremium) {
      const count = await Job.countDocuments({ user: req.userId })
      if (count >= 10) {
        return res.status(403).json({ error: 'limit_reached', message: 'Free plan limit of 10 jobs reached.' })
      }
    }

    // Dedupe within 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10000)
    const dup = await Job.findOne({
      user: req.userId, company: jobData.company, title: jobData.title,
      createdAt: { $gte: tenSecondsAgo }
    })
    if (dup) return res.status(200).json(filterJobForUser(dup, isPremium))

    // Logo
    jobData = await enrichLogo(jobData)

    // Initialise AI fields with proper tiered structure
    jobData.aiSummary = { free: [], premium: [] }
    jobData.aiSalary  = {
      free: { mid: null, currency: null, period: 'yearly' },
      premium: { low: null, mid: null, high: null, currency: null, period: 'yearly' }
    }
    jobData.aiCoverLetter      = { free: '', premium: '' }
    jobData.interviewQuestions = { free: null, premium: null }

    // Run AI for the user's tier
    await runAI(jobData, isPremium)

    const job = await Job.create(jobData)
    res.status(201).json(filterJobForUser(job, isPremium))
  } catch (err) {
    console.error('POST /jobs error:', err)
    res.status(500).json({ message: 'Failed to create job' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/jobs/:id — update
// ═══════════════════════════════════════════════════════════════════════════════
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const isPremium = !!user?.isPremium

    const existing = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!existing) return res.status(404).json({ message: 'Job not found' })

    const updates = req.body
    const descriptionChanged = updates.description && updates.description !== existing.description
    const companyChanged     = updates.company     && updates.company     !== existing.company

    // Merge basic fields
    const merged = {
      ...existing.toObject(),
      ...updates,
    }

    if (descriptionChanged) {
      // Reset AI caches when description changes
      merged.aiSummary          = { free: [], premium: [] }
      merged.aiSalary           = { 
        free: { mid: null, currency: null, period: 'yearly' }, 
        premium: { low: null, mid: null, high: null, currency: null, period: 'yearly' } 
      }
      merged.interviewQuestions = { free: null, premium: null }
      merged.aiCoverLetter      = { free: '', premium: '' }
      merged.salaryInsights     = null
    }

    if (descriptionChanged || companyChanged) {
      await enrichLogo(merged)
      await runAI(merged, isPremium)
    }

    const job = await Job.findByIdAndUpdate(req.params.id, merged, { new: true, runValidators: true })
    res.json(filterJobForUser(job, isPremium))
  } catch (err) {
    console.error('PUT /jobs/:id error:', err)
    res.status(500).json({ message: 'Failed to update job' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/activate-preview
// Free users can activate 3 "Premium Preview" job cards.
// Each activation: marks job.isPremiumPreview=true, runs premium AI, increments
// user.premiumCardsConsumed. Idempotent if job already a preview.
// Returns: { job, premiumCardsConsumed, slotsRemaining, slotJustActivated }
// ═══════════════════════════════════════════════════════════════════════════════
const PREVIEW_SLOT_LIMIT = 3

router.post('/:id/activate-preview', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Premium users don't need preview — they already have full access
    if (user.isPremium) {
      const job = await Job.findOne({ _id: req.params.id, user: req.userId })
      if (!job) return res.status(404).json({ message: 'Job not found' })
      return res.json({ job: filterJobForUser(job, true), premiumCardsConsumed: null, slotsRemaining: null, slotJustActivated: false })
    }

    const job = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })

    const consumed = user.premiumCardsConsumed || 0

    // Idempotent: already a preview — just return current state
    if (job.isPremiumPreview) {
      return res.json({
        job: filterJobForUser(job, false),
        premiumCardsConsumed: consumed,
        slotsRemaining: Math.max(0, PREVIEW_SLOT_LIMIT - consumed),
        slotJustActivated: false
      })
    }

    // No slots left — return 403 so UI can show the conversion banner
    if (consumed >= PREVIEW_SLOT_LIMIT) {
      return res.status(403).json({
        error: 'preview_limit_reached',
        message: 'You have used all 3 Premium Preview job cards.',
        premiumCardsConsumed: consumed,
        slotsRemaining: 0
      })
    }

    // ── Claim the slot ────────────────────────────────────────────────────────
    // Run premium-tier AI for this job so data is immediately available
    const jobData = job.toObject()
    if (job.description) {
      await runAI(jobData, true /* treat as premium */)
      // Persist the AI results back into the job document
      await Job.findByIdAndUpdate(job._id, {
        $set: {
          aiSummary: jobData.aiSummary,
          aiSalary:  jobData.aiSalary,
          isPremiumPreview: true
        }
      })
    } else {
      await Job.findByIdAndUpdate(job._id, { $set: { isPremiumPreview: true } })
    }

    // Increment user counter
    user.premiumCardsConsumed = consumed + 1
    await user.save()

    const updatedJob = await Job.findById(job._id)
    const newConsumed = user.premiumCardsConsumed

    res.json({
      job: filterJobForUser(updatedJob, false),
      premiumCardsConsumed: newConsumed,
      slotsRemaining: Math.max(0, PREVIEW_SLOT_LIMIT - newConsumed),
      slotJustActivated: true,
      isLastSlot: newConsumed === PREVIEW_SLOT_LIMIT
    })
  } catch (err) {
    console.error('POST /jobs/:id/activate-preview error:', err)
    res.status(500).json({ message: 'Failed to activate preview' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/cover-letter
// Free:    max 3 generations ever, tracked by coverLettersGenerated on User
// Premium: unlimited
// ═══════════════════════════════════════════════════════════════════════════════
const FREE_COVER_LETTER_LIMIT = 3

router.post('/:id/cover-letter', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const isPremium = !!user?.isPremium
    const tier = isPremium ? 'premium' : 'free'

    console.log(`[cover-letter] user=${req.userId} isPremium=${isPremium} tier=${tier} coverLettersGenerated=${user?.coverLettersGenerated}`)

    const regenerate = req.body?.regenerate === true
    const job = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // Check cache FIRST — if we already have a letter for this tier, return it regardless of count
    const clObj = job.aiCoverLetter
    const cached = typeof clObj === 'string' && clObj
      ? clObj
      : (clObj && typeof clObj === 'object' ? clObj[tier] : null)
    
    if (cached && !regenerate) {
      console.log('[cover-letter] cache hit, returning cached')
      return res.json({ coverLetter: cached, used: user.coverLettersGenerated || 0, limit: isPremium ? null : FREE_COVER_LETTER_LIMIT })
    }

    // Free limit guard — only block if no cached letter AND limit already exhausted
    if (!isPremium && (user.coverLettersGenerated || 0) >= FREE_COVER_LETTER_LIMIT) {
      console.log('[cover-letter] free limit reached, blocking')
      return res.status(403).json({ error: 'limit_reached', message: `Free limit reached (${FREE_COVER_LETTER_LIMIT} cover letters). Upgrade for unlimited.` })
    }

    if (!job.description) {
      return res.status(400).json({ message: 'Add a job description to generate a cover letter' })
    }

    console.log('[cover-letter] calling Groq...')
    const coverLetter = await ai.generateCoverLetter({
      title: job.title, 
      company: job.company, 
      description: job.description, 
      cvText: user.cvText,
      analysis: job.cvAnalysis
    })
    console.log('[cover-letter] Groq returned length:', coverLetter?.length)

    // Save using $set to avoid schema validation issues with mixed legacy format
    const newCL = { free: '', premium: '', [tier]: coverLetter }
    await Job.findByIdAndUpdate(job._id, { $set: { aiCoverLetter: newCL } })

    if (!isPremium) {
      user.coverLettersGenerated = (user.coverLettersGenerated || 0) + 1
      await user.save()
    }

    const remaining = isPremium ? null : Math.max(0, FREE_COVER_LETTER_LIMIT - (user.coverLettersGenerated || 0))

    const warning = !user.cvText ? "Add your CV in your profile for a more personalized cover letter" : undefined

    console.log('[cover-letter] saved, returning to client')
    res.json({ coverLetter, warning, used: user.coverLettersGenerated || 0, limit: isPremium ? null : FREE_COVER_LETTER_LIMIT, remaining })
  } catch (err) {
    console.error('POST /jobs/:id/cover-letter error:', err)
    res.status(500).json({ message: 'Failed to generate cover letter' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/interview-questions
// Free:    3 questions (1/1/1)
// Premium: 10 questions (3/4/3)
// Both tiers can generate — cached separately
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/interview-questions', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const isPremium = !!user?.isPremium
    const tier = isPremium ? 'premium' : 'free'

    const job = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // Normalise to tiered structure, migrating legacy if needed
    const rawQ = job.interviewQuestions
    let iqObj
    if (!rawQ || typeof rawQ !== 'object') {
      iqObj = { free: null, premium: null }
    } else if (rawQ.behavioral) {
      // Legacy flat format — migrate to free tier
      iqObj = { free: rawQ, premium: null }
    } else {
      iqObj = rawQ
    }

    // Cache hit — return existing questions for this tier
    const cachedQ = iqObj[tier]
    if (cachedQ && cachedQ.behavioral) {
      return res.json(cachedQ)
    }

    if (!job.description) {
      return res.status(400).json({ message: 'Add a job description to generate interview questions' })
    }

    const questions = await ai.generateInterviewQuestions({
      title: job.title, description: job.description
    }, isPremium)

    if (!questions || !questions.behavioral) {
      return res.status(500).json({ message: 'Failed to generate questions. Please try again.' })
    }

    // Save with $set to ensure it persists correctly for Mixed type
    iqObj[tier] = questions
    await Job.findByIdAndUpdate(job._id, { $set: { interviewQuestions: iqObj } })

    res.json(questions)
  } catch (err) {
    console.error('POST /jobs/:id/interview-questions error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/interview-questions/:questionIndex/confirm  (Premium only)
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/interview-questions/:questionIndex/confirm', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user?.isPremium) {
      return res.status(403).json({ error: 'premium_required', message: 'Premium feature.' })
    }

    const { id, questionIndex } = req.params
    const qIndex = parseInt(questionIndex)

    const job = await Job.findOne({ _id: id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })

    if (!job.questionConfirmations) job.questionConfirmations = []

    let conf = job.questionConfirmations.find(c => c.questionIndex === qIndex)
    if (!conf) {
      job.questionConfirmations.push({ questionIndex: qIndex, userIds: [req.userId] })
    } else {
      if (conf.userIds.some(uid => uid.toString() === req.userId.toString())) {
        return res.status(400).json({ message: 'Already confirmed' })
      }
      conf.userIds.push(req.userId)
    }

    await job.save()
    res.json(job.questionConfirmations)
  } catch (err) {
    console.error('POST confirmation error:', err)
    res.status(500).json({ message: 'Failed to confirm question' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/salary-insights
// Available to ALL users (free & premium) — no usage cap
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/salary-insights', async (req, res) => {
  try {
    // Salary insights are unlimited for all tiers
    const job = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })

    const regenerate = req.body?.regenerate === true
    if (job.salaryInsights && !regenerate) {
        return res.json(job.salaryInsights)
    }

    const title = job.title.toLowerCase()
    const isJunior = title.includes('junior') || title.includes('entry') || title.includes('graduate') || title.includes('intern')
    const isSenior = title.includes('senior') || title.includes('lead') || title.includes('principal') || title.includes('head') || title.includes('manager')
    const isMid = !isJunior && !isSenior

    const seniority = isJunior ? 'junior' : isSenior ? 'senior' : 'mid'
    const fallbackRanges = {
      junior: { monthlyMin: 8000, monthlyMax: 15000, monthlySalary: 11000, currency: 'EGP', period: 'monthly', source: 'Fallback estimate' },
      mid: { monthlyMin: 15000, monthlyMax: 30000, monthlySalary: 22000, currency: 'EGP', period: 'monthly', source: 'Fallback estimate' },
      senior: { monthlyMin: 30000, monthlyMax: 60000, monthlySalary: 45000, currency: 'EGP', period: 'monthly', source: 'Fallback estimate' }
    }

    const location = job.location || ''
    const egyptKeywords = ['egypt', 'cairo', 'alexandria', 'giza', 'masr', 'مصر', 'القاهرة']
    const isEgypt = egyptKeywords.some(k => location.toLowerCase().includes(k)) || !location

    // Groq call
    let result
    try {
        const titleTrimmed = job.title.slice(0, 100)
        const locTrimmed = location.slice(0, 100)
        
        const systemPrompt = "You are a salary expert for the Egyptian job market. Return only valid JSON with no explanation: {monthlyMin: number, monthlyMax: number, monthlySalary: number, currency: 'EGP', period: 'monthly', source: 'Egyptian market estimate'}. All values must be realistic Egyptian monthly salaries in EGP. For tech roles in Egypt: junior 8000-15000 EGP, mid 15000-30000 EGP, senior 30000-60000 EGP. Never return yearly values. Never return USD unless job is explicitly remote for US company."
        
        const chat = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Job Title: ${titleTrimmed}\nLocation: ${locTrimmed}\nDescription: ${job.description.slice(0, 500)}` }
          ],
          model: 'llama-3.1-8b-instant',
          max_tokens: 150,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
        
        result = JSON.parse(chat.choices[0]?.message?.content || '{}')
        
        // Validation/Correction
        if (result.monthlySalary > 500000) {
          result.monthlySalary = Math.round(result.monthlySalary / 12)
          result.monthlyMin = Math.round(result.monthlyMin / 12)
          result.monthlyMax = Math.round(result.monthlyMax / 12)
        }
        
        if (result.monthlySalary > 500000 || result.monthlySalary < 1000) {
            result = fallbackRanges[seniority]
        }

    } catch (err) {
        console.error('Groq Salary Error:', err)
        result = fallbackRanges[seniority]
    }
    
    // Final strict validation for EGP local jobs
    if (isEgypt && result.currency === 'EGP') {
        if (result.monthlySalary > 200000 || result.monthlySalary < 3000) {
            result = fallbackRanges[seniority]
        }
    }

    job.salaryInsights = result
    await job.save()
    
    res.json(result)
  } catch (err) {
    console.error('POST /salary-insights error:', err)
    res.status(500).json({ message: 'Failed to fetch salary insights' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/:id/analyze-cv
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/analyze-cv', async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    const isPremium = !!user?.isPremium
    
    const job = await Job.findOne({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })
    
    const regenerate = req.body?.regenerate === true
    
    // Return cache if it exists and no re-analyze requested
    if (job.cvAnalysis && !regenerate) {
      console.log('Returning cached CV analysis')
      return res.json(job.cvAnalysis)
    }
    
    if (!user.cvText) {
      return res.json({ error: 'no_cv' })
    }
    
    // Limit for free users
    if (!isPremium && (user.cvAnalysisCount || 0) >= 3) {
      return res.status(403).json({ error: 'limit_reached', message: 'Free limit reached (3 CV analyses). Upgrade for unlimited.' })
    }
    
    if (!job.description) {
      return res.status(400).json({ message: 'Add a job description to analyze your CV match.' })
    }
    
    const analysis = await ai.analyzeResume(user.cvText, job.description)
    if (!analysis) return res.status(500).json({ message: 'Failed to analyze CV.' })
    
    // Cache result
    job.cvAnalysis = analysis
    await job.save()
    
    // Increment count for free users
    if (!isPremium) {
      user.cvAnalysisCount = (user.cvAnalysisCount || 0) + 1
      await user.save()
    }
    
    res.json(analysis)
  } catch (err) {
    console.error('POST /jobs/:id/analyze-cv error:', err)
    res.status(500).json({ message: 'Failed to analyze CV' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/jobs/:id
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/:id', async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, user: req.userId })
    if (!job) return res.status(404).json({ message: 'Job not found' })
    res.json({ message: 'Job deleted successfully' })
  } catch (err) {
    console.error('DELETE /jobs/:id error:', err)
    res.status(500).json({ message: 'Failed to delete job' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/jobs/fetch-from-url — extract job details from a URL via Groq
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/fetch-from-url', async (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL is required' })

  // 1. Fetch the page HTML
  let html
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    html = response.data
  } catch (err) {
    console.error('[fetch-from-url] fetch error:', err.message)
    return res.status(422).json({ error: 'Could not fetch this URL. Try copying the job description manually.' })
  }

  // 2. Extract visible text using cheerio
  let pageText
  try {
    const $ = cheerio.load(html)
    $('script, style, noscript, header, footer, nav').remove()
    pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000)
  } catch (err) {
    console.error('[fetch-from-url] cheerio error:', err.message)
    return res.status(422).json({ error: 'Could not parse this page.' })
  }

  if (!pageText || pageText.length < 50) {
    return res.status(422).json({ error: 'Could not fetch this URL. Try copying the job description manually.' })
  }

  // 3. Send trimmed text to Groq
  let extracted
  try {
    const chat = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 350,
      messages: [
        {
          role: 'system',
          content: 'Extract job details from this text. Return only valid JSON: {jobTitle, company, location, description, requirements}. Return null for any missing field. No explanation.'
        },
        { role: 'user', content: pageText }
      ]
    })

    const raw = chat.choices[0]?.message?.content?.trim() || ''
    // Find JSON block in response
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Groq response')
    extracted = JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('[fetch-from-url] Groq error:', err.message)
    return res.status(422).json({ error: 'Could not extract job details. Try a different URL.' })
  }

  return res.json(extracted)
})

module.exports = router
