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
      // Backend returns the flat { behavioral, technical, company_fit } for the user's tier
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

  // Returns { coverLetter: string }
  const generateCoverLetter = useCallback(async (id) => {
    try {
      const res = await api.post(`/jobs/${id}/cover-letter`)
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

  return { jobs, loading, error, fetchJobs, createJob, updateJob, deleteJob, generateQuestions, generateCoverLetter, confirmQuestion }
}
