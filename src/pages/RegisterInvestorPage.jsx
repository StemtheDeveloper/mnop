import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/RegisterInvestorPage.css';

const RegisterInvestorPage = () => {
    const { currentUser, refreshUserData } = useUser();
    const navigate = useNavigate();
    const { success: showSuccess, error: showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        phone: '',
        investmentExperience: '',
        preferredInvestmentAmount: '',
        investmentInterests: [],
        agreeToTerms: false
    });

    // Redirect if user is not logged in
    useEffect(() => {
        if (!currentUser) {
            showError('Please sign in to register as an investor');
            navigate('/signin-register');
            return;
        }

        // If user is already an investor, redirect to home
        if (currentUser.roles && currentUser.roles.includes('investor')) {
            showError('You are already registered as an investor');
            navigate('/');
            return;
        }

        // Pre-fill form with user's existing data if available
        const fetchUserData = async () => {
            setLoading(true);
            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // Pre-fill form with existing user data
                    setFormData(prev => ({
                        ...prev,
                        fullName: userData.displayName || '',
                        address: userData.address || '',
                        city: userData.city || '',
                        state: userData.state || '',
                        zipCode: userData.zipCode || '',
                        country: userData.country || '',
                        phone: userData.phone || ''
                    }));
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
                showError('Failed to load your information');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [currentUser, navigate, showError]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            setFormData({ ...formData, [name]: checked });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleInterestChange = (interest) => {
        const updatedInterests = [...formData.investmentInterests];

        if (updatedInterests.includes(interest)) {
            // Remove if already selected
            const index = updatedInterests.indexOf(interest);
            updatedInterests.splice(index, 1);
        } else {
            // Add if not selected
            updatedInterests.push(interest);
        }

        setFormData({ ...formData, investmentInterests: updatedInterests });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.agreeToTerms) {
            showError('Please agree to the terms and conditions');
            return;
        }

        setSubmitting(true);

        try {
            const userRef = doc(db, 'users', currentUser.uid);            // Get existing roles from the user's profile
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data();
            // Get current roles array, whether it's in roles or role field
            const currentRoles = userData.roles && Array.isArray(userData.roles)
                ? userData.roles
                : userData.role
                    ? [userData.role]
                    : [];

            // Check if the investor role already exists
            if (!currentRoles.includes('investor')) {
                // Add the investor role and save form data
                await updateDoc(userRef, {
                    roles: [...currentRoles, 'investor'],
                    investorProfile: {
                        fullName: formData.fullName,
                        address: formData.address,
                        city: formData.city,
                        state: formData.state,
                        zipCode: formData.zipCode,
                        country: formData.country,
                        phone: formData.phone,
                        investmentExperience: formData.investmentExperience,
                        preferredInvestmentAmount: formData.preferredInvestmentAmount,
                        investmentInterests: formData.investmentInterests,
                        registeredAt: new Date()
                    }
                });
            } else {
                // Just update profile info without modifying roles
                await updateDoc(userRef, {
                    investorProfile: {
                        fullName: formData.fullName,
                        address: formData.address,
                        city: formData.city,
                        state: formData.state,
                        zipCode: formData.zipCode,
                        country: formData.country,
                        phone: formData.phone,
                        investmentExperience: formData.investmentExperience,
                        preferredInvestmentAmount: formData.preferredInvestmentAmount,
                        investmentInterests: formData.investmentInterests,
                        registeredAt: new Date()
                    }
                });
            }

            // Refresh the user profile to update roles
            await refreshUserData();

            showSuccess('Successfully registered as an investor!');
            navigate('/portfolio');
        } catch (err) {
            console.error('Error registering as investor:', err);
            showError('Failed to register as an investor. Please try again later.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="register-investor-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading your information...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="register-investor-page">
            <div className="register-investor-container">
                <h1>Register as an Investor</h1>
                <p className="introduction">
                    Join our community of investors and support innovative products while earning returns.
                    Complete the form below to get started with investing in products on our platform.
                </p>

                <form onSubmit={handleSubmit} className="investor-form">
                    <div className="form-section">
                        <h2>Personal Information</h2>
                        <div className="form-group">
                            <label htmlFor="fullName">Full Name *</label>
                            <input
                                type="text"
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="address">Address *</label>
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="city">City *</label>
                                <input
                                    type="text"
                                    id="city"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="state">State/Province</label>
                                <input
                                    type="text"
                                    id="state"
                                    name="state"
                                    value={formData.state}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="zipCode">ZIP/Postal Code *</label>
                                <input
                                    type="text"
                                    id="zipCode"
                                    name="zipCode"
                                    value={formData.zipCode}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="country">Country *</label>
                                <input
                                    type="text"
                                    id="country"
                                    name="country"
                                    value={formData.country}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone">Phone Number *</label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>Investment Preferences</h2>
                        <div className="form-group">
                            <label htmlFor="investmentExperience">Investment Experience *</label>
                            <select
                                id="investmentExperience"
                                name="investmentExperience"
                                value={formData.investmentExperience}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select your experience level</option>
                                <option value="none">No prior investment experience</option>
                                <option value="beginner">Beginner (1-2 years)</option>
                                <option value="intermediate">Intermediate (3-5 years)</option>
                                <option value="advanced">Advanced (5+ years)</option>
                                <option value="professional">Professional investor</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="preferredInvestmentAmount">Preferred Investment Amount *</label>
                            <select
                                id="preferredInvestmentAmount"
                                name="preferredInvestmentAmount"
                                value={formData.preferredInvestmentAmount}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Select an amount range</option>
                                <option value="0-1000">$0 - $1,000</option>
                                <option value="1001-5000">$1,001 - $5,000</option>
                                <option value="5001-10000">$5,001 - $10,000</option>
                                <option value="10001-50000">$10,001 - $50,000</option>
                                <option value="50000+">$50,000+</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Investment Interests (Select all that apply)</label>
                            <div className="checkbox-group">
                                {['Technology', 'Fashion', 'Home Goods', 'Food & Beverage', 'Health & Wellness', 'Sports', 'Entertainment', 'Art & Design'].map(interest => (
                                    <label key={interest} className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.investmentInterests.includes(interest)}
                                            onChange={() => handleInterestChange(interest)}
                                        />
                                        {interest}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>Terms and Conditions</h2>
                        <div className="form-group terms-group">
                            <label className="checkbox-label terms-checkbox">
                                <input
                                    type="checkbox"
                                    name="agreeToTerms"
                                    checked={formData.agreeToTerms}
                                    onChange={handleChange}
                                    required
                                />
                                I agree to the <a href="/terms-and-conditions" target="_blank">Terms and Conditions</a> and
                                acknowledge that investing involves risk. I understand that past performance is no guarantee
                                of future results.
                            </label>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Processing...
                                </>
                            ) : (
                                'Register as Investor'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterInvestorPage;