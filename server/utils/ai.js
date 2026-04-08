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
    const trimmedCV = cvText ? cvText.substring(0, 6000) : ''
    const trimmedDesc = description ? description.substring(0, 4000) : ''
    
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

    const systemPrompt = "Write a professional 3-paragraph cover letter. Sound natural and link candidate's real experience to the job requirements. No generic boilerplate."

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
    const systemPrompt = `Generate 10 interview questions for a ${title} based on the job description. Return JSON: { "behavioral": string[], "technical": string[], "company_fit": string[] }.`
    
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: description.substring(0, 5000) }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
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
    const trimmedCV = cvText.substring(0, 6000)
    const trimmedDesc = description.substring(0, 4000)
    
    const systemPrompt = "Analyze CV against Job Description. Return JSON: {score: 0-100, matchedSkills: [], missingSkills: [], highlights: [], verdict: string}"
    
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CV:\n${trimmedCV}\n\nDesc:\n${trimmedDesc}` }
      ],
      model: 'llama-3.1-8b-instant',
      max_tokens: 500,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
    
    return JSON.parse(res.choices[0]?.message?.content || 'null')
  } catch (err) {
    console.error('analyzeResume error:', err.message)
    return null
  }
}

// ─── CV Optimization (ATS-Ready) ──────────────────────────────────────────
exports.optimizeCV = async (inputText) => {
  if (!inputText || inputText.length < 50) return { insufficient: true, missing: ['More detailed work history or skills'] }
  try {
    const systemPrompt = `Expert ATS Resume Optimizer. Your task is to transform input info into a professional, ATS-friendly resume structure. 
You MUST return your output as a valid JSON object with specific keys.
- If insufficient info (<3 roles/projects), return: {"insufficient": true, "missing": string[]} 
- If sufficient, return: {"cv": "markdown_string", "score": 85, "improvements": ["list", "of", "strings"]}`

    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Provided Info (Return JSON):\n${inputText.substring(0, 10000)}` }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })
    
    return JSON.parse(res.choices[0]?.message?.content || 'null')
  } catch (err) {
    console.error('optimizeCV error:', err.message)
    return null
  }
}




