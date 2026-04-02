const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Job Summary ──────────────────────────────────────────────────────────────
// Free:    3 bullets, max_tokens 120
// Premium: 5 bullets, max_tokens 200
exports.generateSummary = async (description, isPremium) => {
  if (!description) return []
  try {
    const count = isPremium ? 5 : 3
    const systemPrompt = `Return JSON with key "summary": array of exactly ${count} concise strings, each a bullet summarizing the job. No markdown.`
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: description }
      ],
      model: 'llama-3.1-8b-instant',
      max_tokens: isPremium ? 200 : 120,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
    const data = JSON.parse(res.choices[0]?.message?.content || '{}')
    const arr = data.summary
    return Array.isArray(arr) ? arr.slice(0, count) : []
  } catch (err) {
    console.error('generateSummary error:', err.message)
    return []
  }
}

// ─── Salary Insights ──────────────────────────────────────────────────────────
// Free:    { mid, currency },       max_tokens 60
// Premium: { low, mid, high, currency }, max_tokens 100
exports.generateSalaryInsights = async (description, isPremium, location = '') => {
  if (!description && !location) return null
  try {
    const combined = `${location ? `Provided Location Hint: ${location}\n` : ''}${description}`
    const systemPrompt = isPremium
      ? `You are a compensation analyst. Analyze the job description and:
1. Identify the job location (city/country). Look for: city names, currency symbols, country mentions, work visa info, HQ location, or the provided location hint. If remote/global, use the company's likely HQ location.
2. Estimate a realistic LOCAL market salary range for that specific country — do NOT default to US rates unless the job is US-based.
3. Return ONLY JSON: { "low": number, "mid": number, "high": number, "currency": string (ISO code), "period": "yearly" | "monthly", "location": string (e.g. "Cairo, Egypt") }. No explanation.`
      : `You are a compensation analyst. Analyze the job description and:
1. Identify the job location (city/country). Look for: city names, currency symbols, country mentions, work visa info, HQ location, or the provided location hint. If remote/global, use the company's likely HQ location.
2. Estimate a realistic LOCAL market median salary for that specific country — do NOT default to US rates unless the job is US-based.
3. Return ONLY JSON: { "mid": number, "currency": string (ISO code), "period": "yearly" | "monthly", "location": string (e.g. "Cairo, Egypt") }. No explanation.`
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: combined }
      ],
      model: 'llama-3.1-8b-instant',
      max_tokens: isPremium ? 120 : 80,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
    return JSON.parse(res.choices[0]?.message?.content || 'null')
  } catch (err) {
    console.error('generateSalaryInsights error:', err.message)
    return null
  }
}

// ─── Cover Letter ─────────────────────────────────────────────────────────────
// Free:    max_tokens 600
// Premium: max_tokens 800
exports.generateCoverLetter = async ({ title, company, description, cvText, analysis }) => {
  try {
    const trimmedCV = cvText ? cvText.substring(0, 2000) : ''
    const trimmedDesc = description ? description.substring(0, 1000) : ''
    
    let prompt = `Job Title: ${title}\nCompany: ${company}\n\nJob Description:\n${trimmedDesc}`
    if (trimmedCV) {
      prompt += `\n\nCandidate CV:\n${trimmedCV}`
    } else {
      prompt += `\n\n(No CV provided - generate based on job description only)`
    }

    if (analysis) {
      prompt += `\n\nInsights to include:\n`
      if (analysis.matchedSkills?.length) prompt += `- Focus on these matched skills: ${analysis.matchedSkills.join(', ')}\n`
      if (analysis.highlights?.length) prompt += `- Emphasize these highlights: ${analysis.highlights.join('; ')}\n`
    }

    const systemPrompt = "Write a professional cover letter based on this CV and job description. 3 paragraphs. Match the candidate's real experience to the job requirements. Sound natural and specific. No generic phrases."

    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      temperature: 0.7
    })
    return res.choices[0]?.message?.content || 'Error generating cover letter.'
  } catch (err) {
    console.error('generateCoverLetter error:', err.message)
    return 'Error generating cover letter.'
  }
}


// ─── Interview Questions ──────────────────────────────────────────────────────
// Both: 10 questions (3/4/3), max_tokens 400
exports.generateInterviewQuestions = async ({ title, description }, isPremium) => {
  if (!description) return null
  try {
    const systemPrompt = `Return JSON: { "behavioral": string[], "technical": string[], "company_fit": string[] }. Generate exactly 10 interview questions for a ${title} — 3 behavioral, 4 technical, 3 company_fit. Use the job description.`
    
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: description }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })
    const data = JSON.parse(res.choices[0]?.message?.content || 'null')
    if (!data || !data.behavioral) return null
    return data
  } catch (err) {
    console.error('generateInterviewQuestions error:', err.message)
    return null
  }
}
// ─── Resume Analysis ──────────────────────────────────────────────────────────
exports.analyzeResume = async (cvText, description) => {
  if (!cvText || !description) return null
  try {
    const trimmedCV = cvText.substring(0, 2000)
    const trimmedDesc = description.substring(0, 1000)
    
    const systemPrompt = "Analyze this CV against this job description. Return only JSON: {score: number 0-100, matchedSkills: string[], missingSkills: string[], highlights: string[], verdict: 'Strong Match'|'Good Match'|'Partial Match'|'Weak Match'}"
    
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Candidate CV:\n${trimmedCV}\n\nJob description:\n${trimmedDesc}` }
      ],
      model: 'llama-3.1-8b-instant',
      max_tokens: 400,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
    
    return JSON.parse(res.choices[0]?.message?.content || 'null')
  } catch (err) {
    console.error('analyzeResume error:', err.message)
    return null
  }
}
