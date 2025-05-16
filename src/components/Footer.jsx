import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaFacebookF,
  FaTelegram,
  FaInstagram,
  FaWhatsapp,
  FaLinkedinIn,
  FaCommentAlt
} from 'react-icons/fa';
import '../styles/components/Footer.css';
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
              <a href="https://x.com" className="social-icon" title="X/Twitter">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
                </svg>
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
