import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer animate-fade">
      <div className="footer__container">
        <div className="footer__grid">
          <div className="footer__brand">
            <span className="footer__logo">TRKR</span>
            <p className="footer__desc">The ultimate platform for modern job seekers. Track, analyze, and land your dream job with AI.</p>
          </div>

          <div className="footer__links">
            <div className="footer__col">
              <h4>Product</h4>
              <Link to="/kanban">Kanban Board</Link>
              <Link to="/profile">Resume Matcher</Link>
              <Link to="/pricing">Pricing</Link>
            </div>

            <div className="footer__col">
              <h4>Legal</h4>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/refund">Refund Policy</Link>
            </div>

            <div className="footer__col">
              <h4>Support</h4>
              <a href="mailto:youssef@trkr.app">Contact Us</a>
              <a href="https://linkedin.com/in/youssef-elmonier" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__btm-left">
            <p className="footer__built">Crafted with ❤️ by <strong>Youssef Elmonier</strong></p>
          </div>
          <div className="footer__btm-right">
            <p className="footer__copy">© 2026 TRKR. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
