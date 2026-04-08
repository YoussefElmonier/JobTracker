import React, { useState } from 'react';
import { 
  RiRocketLine, RiBriefcaseLine, RiChromeLine, 
  RiMailCheckLine, RiSettings4Line, RiArrowRightLine, RiCheckLine 
} from 'react-icons/ri';
import './OnboardingTour.css';

const STEPS = [
  {
    title: "Welcome to TRKR",
    desc: "Your command center for landing the dream job. We've built the most powerful career pipeline tool ever — and you're at the helm.",
    icon: <RiRocketLine />,
    bullet: "Let's take a 60-second tour of your new powers."
  },
  {
    title: "The Visual Pipeline",
    desc: "Move jobs through stages like 'Wishlist', 'Applied', and 'Interview'. Drag and drop cards to stay organized and never miss a follow-up.",
    icon: <RiBriefcaseLine />,
    bullet: "Pro Tip: Use the Kanban board for a bird's eye view."
  },
  {
    title: "Supercharged Clipping",
    desc: "Don't copy-paste. Our Chrome extension 'TRKR Clipper' imports jobs from LinkedIn and Indeed with one single click.",
    icon: <RiChromeLine />,
    bullet: "Pro Tip: Install the extension from the Dashboard banner."
  },
  {
    title: "Gmail Automation",
    desc: "Connect your Gmail, and we'll automatically scan and update your job statuses when recruiter emails arrive.",
    icon: <RiMailCheckLine />,
    bullet: "Pro Tip: Enable 'Auto-track' in your Profile settings."
  },
  {
    title: "AI & Career Maps",
    desc: "Upload your CV once. Our AI will analyze job descriptions, give you a match score, and draft tailored cover letters.",
    icon: <RiSettings4Line />,
    bullet: "Pro Tip: Keep your CV updated for the best AI accuracy."
  }
];

export default function OnboardingTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onComplete, 500); // Wait for fade-out animation
  };

  const current = STEPS[currentStep];

  return (
    <div className={`onboarding-overlay ${isClosing ? 'onboarding-overlay--closing' : ''}`}>
      <div className="onboarding-card animate-scale-up">
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`progress-dot ${i <= currentStep ? 'active' : ''}`} 
            />
          ))}
        </div>

        <div className="onboarding-icon">
          {current.icon}
        </div>

        <div className="onboarding-content">
          <h2 className="onboarding-title">{current.title}</h2>
          <p className="onboarding-desc">{current.desc}</p>
          <div className="onboarding-tip">
            <span className="tip-badge">Success Secret</span>
            <p>{current.bullet}</p>
          </div>
        </div>

        <div className="onboarding-footer">
          {currentStep === STEPS.length - 1 ? (
            <button className="btn btn-primary btn-lg onboarding-btn" onClick={handleClose}>
              Ready to win <RiCheckLine />
            </button>
          ) : (
            <button className="btn btn-primary btn-lg onboarding-btn" onClick={nextStep}>
              Tell me more <RiArrowRightLine />
            </button>
          )}
          <button className="btn btn-ghost onboarding-skip" onClick={handleClose}>
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}
