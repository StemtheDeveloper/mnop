import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/AboutPage.css';

const AboutPage = () => {
    return (
        <div className="about-page">
            <div className="about-header">
                <h1>About M'NOP</h1>
                <p className="tagline">Connecting designers, manufacturers, investors, and customers to reinvent how products come to life.</p>
            </div>

            <section className="about-section mission-section">
                <div className="container">
                    <h2>Our Mission</h2>
                    <div className="section-content">
                        <div className="text-content">
                            <p>
                                At M'NOP, we're on a mission to revolutionize the product development lifecycle by creating a collaborative ecosystem where creativity meets production capability and investment potential.
                            </p>
                            <p>
                                We believe that great ideas should have the opportunity to become reality, regardless of where they originate. By connecting talented designers with capable manufacturers and strategic investors, we're breaking down traditional barriers to bring innovative products to market faster and more efficiently than ever before.
                            </p>
                        </div>
                        <div className="image-content">
                            <img src="/src/assets/Wally_1.png" alt="M'NOP Mission" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-section story-section">
                <div className="container">
                    <h2>Our Story</h2>
                    <div className="section-content reverse">
                        <div className="text-content">
                            <p>
                                M'NOP was founded in 2022 by a team of industry veterans who saw a disconnect between brilliant designers with groundbreaking ideas and the resources needed to bring those ideas to market.
                            </p>
                            <p>
                                Having experienced firsthand the challenges of navigating the complex journey from concept to consumer, our founders set out to build a platform that would streamline this process, making it more accessible, transparent, and efficient for everyone involved.
                            </p>
                            <p>
                                What began as a small community of passionate creators has grown into a global network of designers, manufacturers, investors, and customers, all united by a shared vision of collaborative innovation.
                            </p>
                        </div>
                        <div className="image-content">
                            <img src="/src/assets/Wally no legs big eyes.webp" alt="M'NOP Story" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-section how-it-works-section">
                <div className="container">
                    <h2>How M'NOP Works</h2>
                    <div className="workflow-steps">
                        <div className="workflow-step">
                            <div className="step-number">1</div>
                            <h3>Design</h3>
                            <p>Designers upload their product concepts and specifications to the platform.</p>
                        </div>
                        <div className="workflow-step">
                            <div className="step-number">2</div>
                            <h3>Manufacture</h3>
                            <p>Manufacturers review designs and submit production quotes and capabilities.</p>
                        </div>
                        <div className="workflow-step">
                            <div className="step-number">3</div>
                            <h3>Fund</h3>
                            <p>Investors browse projects and provide funding to promising products.</p>
                        </div>
                        <div className="workflow-step">
                            <div className="step-number">4</div>
                            <h3>Shop</h3>
                            <p>Customers discover and purchase unique products directly on the platform.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-section values-section">
                <div className="container">
                    <h2>Our Values</h2>
                    <div className="values-grid">
                        <div className="value-card">
                            <h3>Innovation</h3>
                            <p>We foster creativity and out-of-the-box thinking in everything we do.</p>
                        </div>
                        <div className="value-card">
                            <h3>Collaboration</h3>
                            <p>We believe in the power of diverse perspectives working together.</p>
                        </div>
                        <div className="value-card">
                            <h3>Transparency</h3>
                            <p>We maintain honest, open communication throughout the entire process.</p>
                        </div>
                        <div className="value-card">
                            <h3>Sustainability</h3>
                            <p>We're committed to environmentally responsible production practices.</p>
                        </div>
                        <div className="value-card">
                            <h3>Quality</h3>
                            <p>We uphold the highest standards in every product on our platform.</p>
                        </div>
                        <div className="value-card">
                            <h3>Accessibility</h3>
                            <p>We make product development accessible to creators of all backgrounds.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-section team-section">
                <div className="container">
                    <h2>Our Team</h2>
                    <div className="team-members">
                        <div className="team-member">
                            <div className="member-image"></div>
                            <h3>Alex Johnson</h3>
                            <p className="member-role">CEO & Co-Founder</p>
                            <p className="member-bio">Former product development executive with 15+ years of experience in bringing consumer products to market.</p>
                        </div>
                        <div className="team-member">
                            <div className="member-image"></div>
                            <h3>Maria Rodriguez</h3>
                            <p className="member-role">CTO & Co-Founder</p>
                            <p className="member-bio">Tech innovator with a background in platform development and supply chain optimization.</p>
                        </div>
                        <div className="team-member">
                            <div className="member-image"></div>
                            <h3>James Chen</h3>
                            <p className="member-role">Chief Design Officer</p>
                            <p className="member-bio">Award-winning industrial designer who has created products for some of the world's leading brands.</p>
                        </div>
                        <div className="team-member">
                            <div className="member-image"></div>
                            <h3>Sarah Patel</h3>
                            <p className="member-role">Head of Manufacturer Relations</p>
                            <p className="member-bio">Manufacturing expert with extensive experience in global production networks and sustainable practices.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="about-section join-section">
                <div className="container">
                    <h2>Join the M'NOP Community</h2>
                    <p className="join-text">Whether you're a designer with a vision, a manufacturer with capabilities, an investor seeking opportunities, or a customer looking for unique products, M'NOP has a place for you.</p>
                    <div className="join-buttons">
                        <Link to="/register" className="join-button">Create an Account</Link>
                        <Link to="/contact" className="contact-button">Contact Us</Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AboutPage;
