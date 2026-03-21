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
exports.generateCoverLetter = async ({ title, company, description }, isPremium) => {
  try {
    const prompt = `Write a concise 3 paragraph professional cover letter for a ${title} at ${company}. Use the job description. Be specific and natural.\n\nJob Description:\n${description}`
    const res = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: isPremium ? 800 : 600,
      temperature: 0.7
    })
    return res.choices[0]?.message?.content || 'Error generating cover letter.'
  } catch (err) {
    console.error('generateCoverLetter error:', err.message)
    return 'Error generating cover letter.'
  }
}

// ─── Interview Questions ──────────────────────────────────────────────────────
// Free:    3 questions (1/1/1), max_tokens 150
// Premium: 10 questions (3/4/3), max_tokens 400
exports.generateInterviewQuestions = async ({ title, description }, isPremium) => {
  if (!description) return null
  try {
    const systemPrompt = isPremium
      ? `Return JSON: { "behavioral": string[], "technical": string[], "company_fit": string[] }. Generate exactly 10 interview questions for a ${title} — 3 behavioral, 4 technical, 3 company_fit. Use the job description.`
      : `Return JSON: { "behavioral": string[], "technical": string[], "company_fit": string[] }. Generate exactly 3 interview questions for a ${title} — 1 behavioral, 1 technical, 1 company_fit. Use the job description.`
    const res = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: description }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: isPremium ? 400 : 150,
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
