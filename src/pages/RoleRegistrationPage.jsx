import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import FormInput from '../components/FormInput';
import { validators } from '../utils/FormValidation';


const RoleRegistrationPage = () => {
    const { role } = useParams();
    const navigate = useNavigate();
    const { currentUser, userRoles, addUserRole, hasRole } = useUser();
    const { success: showSuccess, error: showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [touchedFields, setTouchedFields] = useState({});
    const [formErrors, setFormErrors] = useState({});

    // Form data specific to role
    const [formData, setFormData] = useState(
        role === 'designer'
            ? {
                specialty: '',
                experience: '',
                portfolio: '',
                skills: '',
                bio: '',
            }
            : {
                businessName: '',
                businessType: '',
                manufacturingCapacity: '',
                specialties: '',
                location: '',
            }
    );

    // Validate that role is one of the allowed types
    useEffect(() => {
        if (!['manufacturer', 'designer'].includes(role)) {
            setError('Invalid role type. Please select either manufacturer or designer.');
            setLoading(false);
            return;
        }

        // Check if user is already authenticated
        if (!currentUser) {
            navigate('/signin', {
                state: {
                    from: `/role-registration/${role}`,
                    message: `Please sign in to register as a ${role}.`
                }
            });
            return;
        }

        // Check if user already has this role
        if (userRoles && userRoles.includes(role)) {
            setSuccess(`You already have the ${role} role. Would you like to proceed to verification?`);
        }

        setLoading(false);
    }, [role, currentUser, userRoles, navigate]);

    const validateField = (name, value) => {
        let error = null;

        if (role === 'designer') {
            switch (name) {
                case 'specialty':
                case 'bio':
                    error = validators.required(value, { fieldName: name });
                    break;
                default:
                    break;
            }
        } else {
            switch (name) {
                case 'businessName':
                case 'businessType':
                case 'location':
                    error = validators.required(value, { fieldName: name });
                    break;
                default:
                    break;
            }
        }

        setFormErrors(prevErrors => ({
            ...prevErrors,
            [name]: error
        }));

        return !error;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Validate the field if it's been touched
        if (touchedFields[name]) {
            validateField(name, value);
        }
    };

    const handleInputBlur = (e) => {
        const { name, value } = e.target;
        setTouchedFields({
            ...touchedFields,
            [name]: true
        });

        validateField(name, value);
    };

    const validateForm = () => {
        // Fields that are required for each role
        const requiredFields = role === 'designer'
            ? ['specialty', 'bio']
            : ['businessName', 'businessType', 'location'];

        let isValid = true;

        // Mark all fields as touched
        const newTouched = requiredFields.reduce((acc, field) => {
            acc[field] = true;
            return acc;
        }, { ...touchedFields });

        setTouchedFields(newTouched);

        // Validate each required field
        requiredFields.forEach(field => {
            if (!validateField(field, formData[field])) {
                isValid = false;
            }
        });

        return isValid;
    }; const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            setError('Please fill in all required fields.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // Add the role to the user - the addUserRole function properly handles 
            // checking if the role exists and adds it to the array
            const success = await addUserRole(role);

            if (!success) {
                throw new Error(`Failed to add the ${role} role to your profile.`);
            }

            setSuccess(`Successfully registered as a ${role}! You can now proceed to verification.`);
            showSuccess(`You are now registered as a ${role}!`);

            // Wait a moment before redirecting to the verification page
            setTimeout(() => {
                navigate(`/verification-request/${role}`);
            }, 2000);
        } catch (err) {
            console.error("Error during role registration:", err);
            setError(err.message || `Failed to register as ${role}. Please try again.`);
            showError(`Failed to register as ${role}.`);
        } finally {
            setSubmitting(false);
        }
    };

    const proceedToVerification = () => {
        navigate(`/verification-request/${role}`);
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    // If user already has this role, show option to proceed to verification
    if (success && userRoles && userRoles.includes(role)) {
        return (
            <div className="role-registration-container">
                <div className="role-registration-success">
                    <h1>{success}</h1>
                    <div className="role-registration-buttons">
                        <button className="btn-primary" onClick={proceedToVerification}>
                            Proceed to Verification
                        </button>
                        <Link to="/profile" className="btn-secondary">
                            Go to Profile
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="role-registration-container">
            <h1>Register as a {role.charAt(0).toUpperCase() + role.slice(1)}</h1>
            <p className="form-subtext">
                {role === 'designer'
                    ? 'Share your design expertise and start creating products on our platform.'
                    : 'Register your manufacturing business and start receiving production requests.'}
            </p>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={handleSubmit} className="role-registration-form">
                {role === 'designer' ? (
                    <>
                        <FormInput
                            id="specialty"
                            name="specialty"
                            label="Design Specialty *"
                            type="text"
                            value={formData.specialty}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.specialty ? formErrors.specialty : null}
                            placeholder="e.g., Industrial Design, Fashion Design, Furniture Design"
                            required
                        />

                        <FormInput
                            id="experience"
                            name="experience"
                            label="Years of Experience"
                            type="text"
                            value={formData.experience}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.experience ? formErrors.experience : null}
                            placeholder="e.g., 5 years"
                        />

                        <FormInput
                            id="portfolio"
                            name="portfolio"
                            label="Portfolio URL"
                            type="url"
                            value={formData.portfolio}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.portfolio ? formErrors.portfolio : null}
                            placeholder="https://your-portfolio-website.com"
                        />

                        <FormInput
                            id="skills"
                            name="skills"
                            label="Key Skills"
                            type="text"
                            value={formData.skills}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.skills ? formErrors.skills : null}
                            placeholder="e.g., 3D Modeling, CAD, Sketching"
                        />

                        <div className="form-group">
                            <label htmlFor="bio" className="form-label">Designer Bio *</label>
                            <textarea
                                id="bio"
                                name="bio"
                                value={formData.bio}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className={`form-textarea ${touchedFields.bio && formErrors.bio ? 'error' : ''}`}
                                rows="4"
                                placeholder="Tell us about yourself and your design background"
                                required
                            ></textarea>
                            {touchedFields.bio && formErrors.bio && (
                                <div className="error-text">{formErrors.bio}</div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <FormInput
                            id="businessName"
                            name="businessName"
                            label="Business Name *"
                            type="text"
                            value={formData.businessName}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.businessName ? formErrors.businessName : null}
                            placeholder="Your company name"
                            required
                        />

                        <FormInput
                            id="businessType"
                            name="businessType"
                            label="Business Type *"
                            type="text"
                            value={formData.businessType}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.businessType ? formErrors.businessType : null}
                            placeholder="e.g., Small Batch Manufacturing, Large Scale Production"
                            required
                        />

                        <FormInput
                            id="manufacturingCapacity"
                            name="manufacturingCapacity"
                            label="Manufacturing Capacity"
                            type="text"
                            value={formData.manufacturingCapacity}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.manufacturingCapacity ? formErrors.manufacturingCapacity : null}
                            placeholder="e.g., 1000 units per month"
                        />

                        <FormInput
                            id="specialties"
                            name="specialties"
                            label="Production Specialties"
                            type="text"
                            value={formData.specialties}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.specialties ? formErrors.specialties : null}
                            placeholder="e.g., Plastic Injection, CNC Machining, Textiles"
                        />

                        <FormInput
                            id="location"
                            name="location"
                            label="Location *"
                            type="text"
                            value={formData.location}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            error={touchedFields.location ? formErrors.location : null}
                            placeholder="City, Country"
                            required
                        />
                    </>
                )}

                <div className="form-note">
                    <p>Fields marked with an asterisk (*) are required.</p>
                    <p>After registration, you will need to complete the verification process to access all platform features.</p>
                </div>

                <div className="role-registration-buttons">
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={submitting}
                    >
                        {submitting ? 'Processing...' : `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                    </button>
                    <Link to="/" className="btn-secondary">
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default RoleRegistrationPage;
