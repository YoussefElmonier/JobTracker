import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { format } from 'date-fns'
import {
  RiAddLine, RiExternalLinkLine, RiDeleteBinLine, RiEdit2Line,
  RiBriefcaseLine, RiTimeLine, RiFocus3Line, RiTrophyLine, RiCloseCircleLine,
  RiFileTextLine, RiMoneyDollarCircleLine, RiListCheck, RiArrowDownSLine, RiArrowUpSLine,
  RiLockLine, RiChat3Line, RiToolsLine, RiCommunityLine, RiFireLine, RiHandCoinLine,
  RiLinkM
} from 'react-icons/ri'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../context/AuthContext'
import AddJobModal from '../components/AddJobModal'
import CoverLetterModal from '../components/CoverLetterModal'
import UpgradeModal from '../components/UpgradeModal'
import ImportFromURLModal from '../components/ImportFromURLModal'
import './Kanban.css'

const COLUMNS = [
  { id: 'applied', label: 'Applied', icon: <RiBriefcaseLine /> },
  { id: 'interview', label: 'Interview', icon: <RiTimeLine /> },
  { id: 'waiting', label: 'Waiting', icon: <RiFocus3Line /> },
  { id: 'offer', label: 'Offer', icon: <RiTrophyLine /> },
  // { id: 'rejected', label: 'Rejected', icon: <RiCloseCircleLine /> },
]

function CompanyLogo({ logo, company }) {
  const [error, setError] = useState(false)
  const fallback = company?.trim()?.[0]?.toUpperCase() || '?'

  if (logo && !error) {
    const proxyUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/logo/proxy?url=${encodeURIComponent(logo)}`
    return (
      <img
        src={proxyUrl}
        alt={company}
        onError={() => setError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
      />
    )
  }
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#eee',
      color: '#111',
      fontWeight: 'bold',
      fontSize: '1rem',
      borderRadius: '8px'
    }}>
      {fallback}
    </div>
  )
}

function JobCard({ job, index, user, isPremium, onEdit, onDelete, onGenerateLetter, onGenerateQuestions, onConfirmQuestion }) {
  const [showAI, setShowAI] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [activeTab, setActiveTab] = useState('behavioral')
  const [isGenerating, setIsGenerating] = useState(false)

  const dateStr = job.dateApplied ? format(new Date(job.dateApplied), 'MMM d, yyyy') : ''
  const summary = Array.isArray(job.aiSummary) ? job.aiSummary : []
  const salary = job.aiSalary && job.aiSalary.mid ? job.aiSalary : null
  const questions = job.interviewQuestions && job.interviewQuestions.behavioral ? job.interviewQuestions : null
  const activeQuestions = questions ? (questions[activeTab] || []) : []
  const hasAI = summary.length > 0 || !!salary

  const handleGenerate = async (e) => {
    e.stopPropagation()
    setIsGenerating(true)
    try { await onGenerateQuestions(job._id) } finally { setIsGenerating(false) }
  }

  const getGlobalIndex = (tab, localIdx) => {
    if (tab === 'behavioral') return localIdx
    if (tab === 'technical') return 3 + localIdx
    return 7 + localIdx
  }

  const getCount = (idx) => job.questionConfirmations?.find(c => c.questionIndex === idx)?.userIds?.length || 0
  const hasConfirmed = (idx) => !!job.questionConfirmations?.find(c => c.questionIndex === idx)

  return (
    <Draggable draggableId={job._id} index={index}>
      {(provided, snapshot) => {
        const style = {
          ...provided.draggableProps.style,
          // When portaling, we need to handle the left/top correctly if not using a placeholder
          // But dnd handles this via provided.draggableProps.style
        };

        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={style}
            className={`job-card ${!snapshot.isDragging ? 'animate-scale' : 'job-card--dragging'}`}
          >
            <div className="job-card__header">
              <div className="job-card__logo">
                <CompanyLogo logo={job.companyLogo} company={job.company} />
              </div>
              <div className="job-card__actions">
                {job.url && (
                  <a href={job.url} target="_blank" rel="noreferrer" className="job-card__action-btn" title="Open posting">
                    <RiExternalLinkLine />
                  </a>
                )}
                <button className="job-card__action-btn" onClick={() => onEdit(job)} title="Edit">
                  <RiEdit2Line />
                </button>
                <button className="job-card__action-btn" onClick={() => onDelete(job._id)} title="Delete">
                  <RiDeleteBinLine />
                </button>
              </div>
            </div>

            <p className="job-card__company">{job.company}</p>
            <p className="job-card__title">{job.title}</p>

            <div className="job-card__footer">
              <span className={`badge badge-${job.status}`}>{job.status}</span>
              {dateStr && <span className="job-card__date">{dateStr}</span>}
            </div>

            {/* AI Insights and Interview Prep using the requested styles */}
            {hasAI && (
              <div className="job-card__ai-toggle" onClick={() => setShowAI(!showAI)}>
                <span>AI Insights</span>
                {showAI ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
              </div>
            )}
            {showAI && hasAI && (
              <div className="job-card__ai-content">
                {salary && (
                  <div style={{ marginBottom: '8px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <RiMoneyDollarCircleLine style={{ color: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700 }}>
                        {isPremium && salary.low ? (
                          `${salary.low?.toLocaleString()} – ${salary.high?.toLocaleString()} ${salary.currency}`
                        ) : (
                          `${salary.mid?.toLocaleString()} ${salary.currency}`
                        )}
                      </span>
                      <span style={{ fontWeight: 400, opacity: 0.6, fontSize: '0.75rem' }}>
                        / {salary.period === 'monthly' ? 'mo' : 'yr'}
                        {(salary.location || job.location) && (
                          <> · 📍 {salary.location || job.location}</>
                        )}
                      </span>
                    </div>
                  </div>
                )}
                {summary.slice(0, 2).map((b, i) => <p key={i} style={{ marginBottom: '4px' }}>• {b}</p>)}
                {!isPremium && summary.length > 2 && (
                  <div className="job-card__ai-lock" onClick={e => { e.stopPropagation(); onGenerateLetter(null, 'premium') }}>
                    <RiLockLine /> <span>Upgrade to see full analysis</span>
                  </div>
                )}
              </div>
            )}

            <div className="job-card__ai-toggle" onClick={() => setShowQuestions(!showQuestions)}>
              <span>Interview Prep</span>
              {showQuestions ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
            </div>
            {showQuestions && (
              <div className="job-card__questions-content">
                {!questions ? (
                  <button className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem' }} 
                    onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? 'Generating…' : 'Generate Questions'}
                  </button>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        {['behavioral', 'technical', 'company_fit'].map(tab => (
                          <button key={tab} 
                            onClick={() => setActiveTab(tab)}
                            style={{ 
                              fontSize: '0.65rem', padding: '4px 8px', borderRadius: '4px',
                              background: activeTab === tab ? '#1a1a1a' : '#fff',
                              color: activeTab === tab ? '#fff' : '#111',
                              border: '1px solid #e5e5e0'
                            }}
                          >
                            {tab === 'company_fit' ? 'Fit' : tab}
                          </button>
                        ))}
                    </div>
                    {activeQuestions.slice(0, isPremium ? 10 : 3).map((q, idx) => (
                        <p key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #e5e5e0', paddingBottom: '4px' }}>{q}</p>
                    ))}
                    {!isPremium && (
                      <div className="job-card__ai-lock" style={{ marginTop: '8px' }}
                        onClick={e => { e.stopPropagation(); onGenerateLetter(null, 'premium') }}>
                        <RiLockLine /> <span>Upgrade for 10+ tailored questions</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-secondary job-card__btn-letter"
              onClick={e => { e.stopPropagation(); onGenerateLetter(job) }}>
              <RiFileTextLine /> Generate Cover Letter
            </button>
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(card, document.body);
        }
        return card;
      }}
    </Draggable>
  )
}

export default function Kanban() {
  const { jobs, loading, createJob, updateJob, deleteJob, generateQuestions, generateCoverLetter, confirmQuestion } = useJobs()
  const { user, isPremium, refreshUser } = useAuth()
  const [showModal, setShowModal]           = useState(false)
  const [editJob, setEditJob]               = useState(null)
  const [letterJob, setLetterJob]           = useState(null)
  const [showUpgrade, setShowUpgrade]       = useState(false)
  const [upgradeReason, setUpgradeReason]   = useState('limit')
  const [defaultStatus, setDefault]         = useState('applied')
  const [expandedCols, setExpandedCols]     = useState({})
  const [isDragging, setIsDragging]         = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPrefill, setImportPrefill]   = useState(null)

  const toggleExpand = (colId) => {
    setExpandedCols(prev => ({ ...prev, [colId]: !prev[colId] }))
  }

  const getColumnJobs = (status) =>
    jobs.filter(j => j.status === status).sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied))

  const handleDragEnd = async (result) => {
    setIsDragging(false)
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) return
    try { await updateJob(draggableId, { status: destination.droppableId }) } catch (err) { console.error(err) }
  }

  const handleAddForColumn = (status) => {
    setDefault(status)
    setEditJob(null)
    setShowModal(true)
  }

  const handleSave = async (data) => {
    if (editJob) await updateJob(editJob._id, data)
    else await createJob(data)
    setShowModal(false)
    setEditJob(null)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this application?')) await deleteJob(id)
  }

  return (
    <div className="page-container kanban-page animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban Board</h1>
          <p className="page-subtitle">Drag cards to update their status</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            id="kanban-import-url"
            className="btn btn-import-url"
            onClick={() => setShowImportModal(true)}
          >
            <RiLinkM /> Import from URL
          </button>
          <button className="btn btn-primary" onClick={() => { setEditJob(null); setImportPrefill(null); setShowModal(true) }}>
            <RiAddLine /> Add Application
          </button>
        </div>
      </div>

      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}>
        <div className={`kanban__board ${isDragging ? 'kanban__board--dragging' : ''}`}>
          {COLUMNS.map(col => {
            const colJobs = getColumnJobs(col.id)
            const isExpanded = expandedCols[col.id]
            const hasMore = colJobs.length > 2

            return (
              <div key={col.id} className="kanban__col">
                <div className="kanban__col-header">
                  <div className="kanban__col-title-row">
                    <span className="kanban__col-icon">{col.icon}</span>
                    <h2 className="kanban__col-title">{col.label}</h2>
                    <span className="kanban__col-count">{colJobs.length}</span>
                  </div>
                  <button className="kanban__col-add" onClick={() => handleAddForColumn(col.id)}>
                    <RiAddLine />
                  </button>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <>
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`kanban__drop-zone ${snapshot.isDraggingOver ? 'kanban__drop-zone--over' : ''} ${(!isExpanded && hasMore) ? 'kanban__drop-zone--limited' : ''}`}
                      >
                        {colJobs.length === 0 && !snapshot.isDraggingOver && (
                          <div className="kanban__empty">
                            <RiBriefcaseLine />
                            <span>Empty</span>
                          </div>
                        )}
                        {colJobs.map((job, i) => (
                          <JobCard
                            key={job._id}
                            job={job}
                            index={i}
                            user={user}
                            isPremium={isPremium}
                            onEdit={handleEdit => { setEditJob(handleEdit); setShowModal(true) }}
                            onDelete={handleDelete}
                            onConfirmQuestion={confirmQuestion}
                            onGenerateQuestions={generateQuestions}
                            onGenerateLetter={(j, forcedReason) => {
                              if (forcedReason) { setUpgradeReason(forcedReason); setShowUpgrade(true); return }
                              setLetterJob(j)
                            }}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                      
                      {hasMore && (
                        <button 
                          className="kanban__col-expand" 
                          onClick={() => toggleExpand(col.id)}
                        >
                          {isExpanded ? (
                            <><RiArrowUpSLine /> Show less</>
                          ) : (
                            <><RiArrowDownSLine /> Show all {colJobs.length} cards</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {showModal && (
        <AddJobModal
          onClose={() => { setShowModal(false); setEditJob(null); setImportPrefill(null) }}
          onSave={handleSave}
          onLimitReached={() => { setUpgradeReason('limit'); setShowUpgrade(true) }}
          initial={editJob || importPrefill || { status: defaultStatus }}
          isEdit={!!editJob}
        />
      )}

      {letterJob && (
        <CoverLetterModal
          job={letterJob}
          onClose={() => setLetterJob(null)}
          onGenerate={generateCoverLetter}
          onSuccess={refreshUser}
        />
      )}

      {showUpgrade && (
        <UpgradeModal reason={upgradeReason} onClose={() => setShowUpgrade(false)} />
      )}

      {showImportModal && (
        <ImportFromURLModal
          onClose={() => setShowImportModal(false)}
          onExtracted={(prefilled) => {
            setImportPrefill({ ...prefilled, status: defaultStatus })
            setEditJob(null)
            setShowModal(true)
          }}
        />
      )}
    </div>
  )
}
