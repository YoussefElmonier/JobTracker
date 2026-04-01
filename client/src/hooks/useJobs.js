import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

export function useJobs() {
  const [jobs, setJobs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/jobs')
      setJobs(res.data)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const createJob = useCallback(async (data) => {
    try {
      const res = await api.post('/jobs', data)
      setJobs(prev => [res.data, ...prev])
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to create job'
      const e    = new Error(msg)
      e.code     = code
      throw e
    }
  }, [])

  const updateJob = useCallback(async (id, data) => {
    const res = await api.put(`/jobs/${id}`, data)
    setJobs(prev => prev.map(j => j._id === id ? res.data : j))
    return res.data
  }, [])

  const deleteJob = useCallback(async (id) => {
    await api.delete(`/jobs/${id}`)
    setJobs(prev => prev.filter(j => j._id !== id))
  }, [])

  // Returns the questions object { behavioral, technical, company_fit } for that tier
  const generateQuestions = useCallback(async (id) => {
    try {
      const res = await api.post(`/jobs/${id}/interview-questions`)
      setJobs(prev => prev.map(j => j._id === id ? { ...j, interviewQuestions: res.data } : j))
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to generate questions'
      const e    = new Error(msg)
      e.code     = code
      throw e
    }
  }, [])

  // Returns { coverLetter, warning?, used?, limit?, remaining? }
  const generateCoverLetter = useCallback(async (id, regenerate = false) => {
    try {
      const res = await api.post(`/jobs/${id}/cover-letter`, { regenerate })
      setJobs(prev => prev.map(j => j._id === id ? { ...j, aiCoverLetter: res.data.coverLetter } : j))
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to generate cover letter'
      const e    = new Error(msg)
      e.code     = code
      throw e
    }
  }, [])

  const confirmQuestion = useCallback(async (jobId, questionIndex) => {
    try {
      const res = await api.post(`/jobs/${jobId}/interview-questions/${questionIndex}/confirm`)
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, questionConfirmations: res.data } : j))
      return res.data
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to confirm question')
    }
  }, [])

  const analyzeCV = useCallback(async (jobId, regenerate = false) => {
    try {
      const res = await api.post(`/jobs/${jobId}/analyze-cv`, { regenerate })
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, cvAnalysis: res.data } : j))
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to analyze CV'
      const e    = new Error(msg)
      e.code     = code
      throw e
    }
  }, [])

  const generateSalaryInsights = useCallback(async (jobId, regenerate = false) => {
    try {
      const res = await api.post(`/jobs/${jobId}/salary-insights`, { regenerate })
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, salaryInsights: res.data } : j))
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to fetch salary insights'
      const e    = new Error(msg)
      e.code     = code
      throw e
    }
  }, [])

  // Claim a free "Premium Preview" slot for this job.
  // Returns { job, premiumCardsConsumed, slotsRemaining, slotJustActivated, isLastSlot }
  const activatePreview = useCallback(async (jobId) => {
    try {
      const res = await api.post(`/jobs/${jobId}/activate-preview`)
      // Merge the upgraded job object back into state
      if (res.data.job) {
        setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...res.data.job } : j))
      }
      return res.data
    } catch (err) {
      const code = err.response?.data?.error
      const msg  = err.response?.data?.message || 'Failed to activate preview'
      const e    = new Error(msg)
      e.code     = code
      // Expose usage info so the UI can render the "limit reached" banner
      e.premiumCardsConsumed = err.response?.data?.premiumCardsConsumed
      e.slotsRemaining       = err.response?.data?.slotsRemaining ?? 0
      throw e
    }
  }, [])

  return { 
    jobs, loading, error, 
    setJobs, // Exported for optimistic updates
    fetchJobs, createJob, updateJob, deleteJob, 
    generateQuestions, generateCoverLetter, confirmQuestion,
    analyzeCV, generateSalaryInsights, activatePreview
  }
}
