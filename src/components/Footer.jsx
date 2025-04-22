import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-columns">
          {/* Column 1: Socials */}
          <div className="footer-column">
            <h4>Socials</h4>
            <div className="social-links">
              <a href="https://facebook.com" className="social-icon" title="Facebook">
                <i className="fa fa-facebook"></i>
              </a>
              <a href="https://twitter.com" className="social-icon" title="X/Twitter">
                <i className="fa fa-twitter"></i>
              </a>
              <a href="https://telegram.org" className="social-icon" title="Telegram">
                <i className="fa fa-telegram"></i>
              </a>
              <a href="https://instagram.com" className="social-icon" title="Instagram">
                <i className="fa fa-instagram"></i>
              </a>
              <a href="https://whatsapp.com" className="social-icon" title="WhatsApp">
                <i className="fa fa-whatsapp"></i>
              </a>
              <a href="https://linkedin.com" className="social-icon" title="LinkedIn">
                <i className="fa fa-linkedin"></i>
              </a>
            </div>
          </div>

          {/* Column 2: Contact Us */}
          <div className="footer-column">
            <h4>Contact Us</h4>
            <ul className="footer-links">
              <li>
                <a href="tel:+1234567890">
                  <span>➡️</span> +1 (234) 567-890
                </a>
              </li>
              <li>
                <a href="mailto:support@mnop.com">
                  <span>📧</span> support@mnop.com
                </a>
              </li>
              <li>
                <a href="/feedback">
                  <span>☕</span> Give Feedback
                </a>
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

          {/* Column 4: Something Else */}
          <div className="footer-column">
            <h4>Something Else</h4>
            <ul className="footer-links">
              <li><a href="/jobs">Jobs</a></li>
              <li><a href="/affiliates">Affiliates</a></li>
              <li><a href="/memes">Memes</a></li>
              <li><a href="/docs">Docs</a></li>
              <li><a href="/more">More From Us...</a></li>
            </ul>
          </div>
        </div>

        {/* Right Section: Nop of the Day */}
        <div className="nop-section">
          <h4>Nop Of The Day</h4>
          <div className="nop-card">
            <div className="nop-character">
              <img src="/coin-purson.png" alt="Coin Purson" className="coin-purson" />
              <p className="nop-label">Coin Purson</p>
            </div>
            <button className="collect-btn">Collect</button>
          </div>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-policy-links">
            <a href="/privacy">Privacy Policy</a>
            <span className="separator">|</span>
            <a href="/terms">Terms and Conditions</a>
            <span className="separator">|</span>
            <a href="/cookies">Manage Cookies</a>
          </div>
          <p className="copyright">©{currentYear} MNOP Ecommerce</p>
          <p className="branding">Another <span className="red-box">RED BOX</span> SOFTWARE Thing</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
