import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer animate-fade">
      <div className="footer__container">
        <div className="footer__left">
          <span className="footer__logo">TRKR</span>
        </div>
        <div className="footer__center">
          <p className="footer__built">Built by Youssef Elmonier</p>
        </div>
        <div className="footer__right">
          <p className="footer__copy">© 2026 TRKR. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
