import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Socials Section */}
        <section className="footer-section">
          <h3>Socials</h3>
          <div className="social-icons">
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
        </section>

        {/* Contact Us Section */}
        <section className="footer-section">
          <h3>Contact Us</h3>
          <ul>
            <li>
              <a href="tel:+1234567890">
                <i className="fa fa-phone"></i> +1 (234) 567-890
              </a>
            </li>
            <li>
              <a href="mailto:support@mnop.com">
                <i className="fa fa-envelope"></i> support@mnop.com
              </a>
            </li>
            <li>
              <a href="/feedback">
                <span role="img" aria-label="coffee">☕</span> Give Feedback
              </a>
            </li>
            <li>
              <a href="/report-bug">
                <span role="img" aria-label="bug">🐛</span> Report a Bug
              </a>
            </li>
          </ul>
        </section>

        {/* Register Section */}
        <section className="footer-section">
          <h3>Register</h3>
          <ul>
            <li><a href="/register/manufacturer">Manufacturer</a></li>
            <li><a href="/register/investor">Investor</a></li>
            <li><a href="/register/designer">Product Designer</a></li>
            <li><a href="/register/promoter">Promoter</a></li>
          </ul>
        </section>

        {/* Something Else Section */}
        <section className="footer-section">
          <h3>Something Else</h3>
          <ul>
            <li><a href="/jobs">Jobs</a></li>
            <li><a href="/affiliates">Affiliates</a></li>
            <li><a href="/memes">Memes</a></li>
            <li><a href="/docs">Docs</a></li>
            <li><a href="/more">More From Us...</a></li>
          </ul>
        </section>

        {/* Nop of the Day Section */}
        <section className="footer-section nop-of-day">
          <h3>Nop of the Day</h3>
          <div className="nop-card">
            <div className="nop-character">
              <img src="/coin-purson.png" alt="Coin Purson" className="coin-purson" />
              <h4>Coin Purson</h4>
            </div>
            <button className="collect-btn">Collect</button>
          </div>
        </section>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <div className="footer-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms and Conditions</a>
            <a href="/cookies">Manage Cookies</a>
          </div>
          <p className="copyright">©{currentYear} MNOP Ecommerce</p>
          <p className="branding">Another RED BOX SOFTWARE Thing</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
