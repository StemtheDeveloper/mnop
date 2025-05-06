import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaFacebookF,
  FaTwitter,
  FaTelegram,
  FaInstagram,
  FaWhatsapp,
  FaLinkedinIn,
  FaCommentAlt
} from 'react-icons/fa';
import './Footer.css';
import DailyNop from './DailyNop';
import { useFeedback } from '../context/FeedbackContext';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { isPermanentlyHidden, showFeedbackBar } = useFeedback();

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-columns">
          {/* Column 1: Socials */}
          <div className="footer-column">
            <h4>Socials</h4>
            <div className="social-links">
              <a href="https://facebook.com" className="social-icon" title="Facebook">
                <FaFacebookF />
              </a>
              <a href="https://twitter.com" className="social-icon" title="X/Twitter">
                <FaTwitter />
              </a>
              <a href="https://telegram.org" className="social-icon" title="Telegram">
                <FaTelegram />
              </a>
              <a href="https://instagram.com" className="social-icon" title="Instagram">
                <FaInstagram />
              </a>
              <a href="https://whatsapp.com" className="social-icon" title="WhatsApp">
                <FaWhatsapp />
              </a>
              <a href="https://linkedin.com" className="social-icon" title="LinkedIn">
                <FaLinkedinIn />
              </a>
            </div>
          </div>

          {/* Column 2: Contact Us */}
          <div className="footer-column">
            <h4>Contact Us</h4>
            <ul className="footer-links">
              <li>
                <a href="tel:+1234567890">
                  <span>📞</span> +1 (234) 567-890
                </a>
              </li>
              <li>
                <a href="mailto:support@mnop.com">
                  <span>📧</span> support@mnop.com
                </a>
              </li>
              <li>
                {isPermanentlyHidden ? (
                  <button className="feedback-link-button" onClick={showFeedbackBar}>
                    <span><FaCommentAlt /></span> Show Feedback Bar
                  </button>
                ) : (
                  <a href="/feedback">
                    <span>💬</span> Give Feedback
                  </a>
                )}
              </li>
              <li>
                <a href="/report-bug">
                  <span>🐞</span> Report a Bug
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Register */}
          <div className="footer-column">
            <h4>Register</h4>
            <ul className="footer-links">
              <li><a href="/register/manufacturer">Manufacturer</a></li>
              <li><a href="/register/investor">Investor</a></li>
              <li><a href="/register/designer">Product Designer</a></li>
              <li><a href="/register/promoter">Promoter</a></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="footer-column">
            <h4>Legal</h4>
            <ul className="footer-links">
              <li><Link to="/terms-and-conditions">Terms and Conditions</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/content-policy">Content Policy</Link></li>
              <li><a href="/cookies">Cookies Policy</a></li>
              <li><a href="/compliance">Compliance</a></li>
            </ul>
          </div>
        </div>

        {/* Right Section: Nop of the Day */}
        <div className="nop-section">
          <h4>Nop Of The Day</h4>
          <DailyNop />
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-policy-links">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span className="separator">|</span>
            <Link to="/terms-and-conditions">Terms and Conditions</Link>
            <span className="separator">|</span>
            <Link to="/content-policy">Content Policy</Link>
          </div>
          <p className="copyright">©{currentYear} MNOP Ecommerce</p>
          <p className="branding">Another <span className="red-box">RED BOX</span> SOFTWARE Thing</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
