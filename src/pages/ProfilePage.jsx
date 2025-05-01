import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { updateProfile, signOut, deleteUser } from 'firebase/auth'; // Import signOut and deleteUser
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, getDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import deleteDoc, getDoc, addDoc, setDoc, serverTimestamp
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import '../styles/ProfilePage.css';
import '../styles/ImageCropper.css';
import ImageCropper from '../components/ImageCropper';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AchievementBadgeDisplay from '../components/AchievementBadgeDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import NopCollection from '../components/NopCollection';
import refundService from '../services/refundService'; // Import refundService

const ProfilePage = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, userRole, userRoles, addUserRole, hasRole, logout } = useUser();
    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        phone: '',
        bio: '',
        location: '',
        website: '',
        birthday: '',
        notifications: true,
        // Add privacy settings
        privacy: {
            showRole: true,
            showBio: true,
            showLocation: true,
            showWebsite: true,
            showBirthday: false,
            showProducts: true
        }
    });
    const [requestedRole, setRequestedRole] = useState('');
    const [processingRoleRequest, setProcessingRoleRequest] = useState(false);
    const [designerProducts, setDesignerProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // State for designer sales
    const [designerSales, setDesignerSales] = useState([]);
    const [loadingSales, setLoadingSales] = useState(false);

    // State for customer orders
    const [customerOrders, setCustomerOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // State for refund requests
    const [refundRequests, setRefundRequests] = useState([]);
    const [loadingRefundRequests, setLoadingRefundRequests] = useState(false);
    const [refundDenyReason, setRefundDenyReason] = useState('');
    const [selectedRefundOrder, setSelectedRefundOrder] = useState(null);
    const [showRefundModal, setShowRefundModal] = useState(false);

    // State for order filtering and organization
    const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'complete', 'incomplete'
    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [orderTimeFrame, setOrderTimeFrame] = useState('all'); // 'all', 'week', 'month', 'year'
    const [expandedOrderId, setExpandedOrderId] = useState(null);

    // Refs for file inputs
    const profilePhotoRef = useRef(null);
    const headerPhotoRef = useRef(null);

    // State for image files and URLs
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [headerPhotoURL, setHeaderPhotoURL] = useState('');

    // State for cropping
    const [showProfileCropper, setShowProfileCropper] = useState(false);
    const [showHeaderCropper, setShowHeaderCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');

    // Temporary preview states
    const [profilePhotoPreview, setProfilePhotoPreview] = useState('');

    // Parameters from URL
    const params = useParams();
    const userId = params.id || currentUser?.uid; // Use URL param or current user's ID

    // Check if the current user is viewing their own profile
    const isOwnProfile = currentUser && userId === currentUser.uid;

    // Check if user has designer role
    const isDesigner = hasRole('designer');

    // State for shipping settings
    const [shippingSettings, setShippingSettings] = useState({
        standardShippingCost: 10,
        expressShippingCost: 25,
        shippingProvider: 'standard',
        customProviderName: '',
        offerFreeShipping: false,
        freeShippingThreshold: 0,
        useCustomShipping: true
    });

    // Define shipping provider options
    const shippingProviders = [
        { id: 'standard', name: 'Standard Shipping' },
        { id: 'usps', name: 'USPS' },
        { id: 'ups', name: 'UPS' },
        { id: 'fedex', name: 'FedEx' },
        { id: 'amazon', name: 'Amazon Logistics' },
        { id: 'dhl', name: 'DHL' },
        { id: 'custom', name: 'Custom Provider' }
    ];

    const [loadingShippingSettings, setLoadingShippingSettings] = useState(false);

    // Load user data into form
    useEffect(() => {
        if (userProfile) {
            setFormData({
                displayName: userProfile.displayName || '',
                email: currentUser?.email || '',
                phone: userProfile.phone || '',
                bio: userProfile.bio || '',
                location: userProfile.location || '',
                website: userProfile.website || '',
                birthday: userProfile.birthday || '',
                notifications: userProfile.notifications !== false,
                privacy: userProfile.privacy || {
                    showRole: true,
                    showBio: true,
                    showLocation: true,
                    showWebsite: true,
                    showBirthday: false,
                    showProducts: true
                }
            });
            setHeaderPhotoURL(userProfile.headerPhotoURL || '');
        }
    }, [userProfile, currentUser]);

    // Fetch designer's products
    useEffect(() => {
        const fetchDesignerProducts = async () => {
            if (!userId) return;

            // Only try to fetch products if the user has designer role
            // We'll check both string and array formats of userRole
            const userIsDesigner = hasRole('designer');
            if (!userIsDesigner) return;

            console.log('Fetching designer products for userId:', userId);
            setLoadingProducts(true);

            try {
                const productsRef = collection(db, 'products');
                const q = query(productsRef, where('designerId', '==', userId));
                const snapshot = await getDocs(q);

                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('Designer products fetched:', products.length);
                setDesignerProducts(products);
            } catch (error) {
                console.error('Error fetching products:', error);
                setMessage({ type: 'error', text: 'Failed to load your products.' });
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchDesignerProducts();
    }, [userId, hasRole]); // Depend directly on hasRole to ensure role changes are detected

    // Fetch customer orders for designer
    useEffect(() => {
        if (!userId || !hasRole('designer')) return;

        const fetchCustomerOrders = async () => {
            setLoadingOrders(true);
            setMessage({ type: '', text: '' });

            try {
                // First get all products by this designer
                const productsRef = collection(db, 'products');
                const designerProductsQuery = query(productsRef, where('designerId', '==', userId));
                const productSnapshot = await getDocs(designerProductsQuery);

                if (productSnapshot.empty) {
                    console.log('No products found for this designer');
                    setCustomerOrders([]);
                    setLoadingOrders(false);
                    return;
                }

                // Get all product IDs
                const productIds = productSnapshot.docs.map(doc => doc.id);
                console.log('Designer product IDs:', productIds);

                // Find all orders that contain these products
                const ordersRef = collection(db, 'orders');
                const orderSnapshot = await getDocs(ordersRef);
                console.log('Total orders found:', orderSnapshot.size);

                // Filter orders that contain this designer's products
                const relevantOrders = [];

                orderSnapshot.forEach(orderDoc => {
                    const orderData = orderDoc.data();

                    // Skip if order has no items
                    if (!orderData.items || !Array.isArray(orderData.items)) return;

                    // Check if any item in this order is from this designer's products
                    const designerItems = orderData.items.filter(item => productIds.includes(item.id));

                    if (designerItems.length > 0) {
                        // Handle createdAt timestamp properly
                        let createdAtDate;
                        if (orderData.createdAt) {
                            if (orderData.createdAt.toDate) {
                                // Firebase Timestamp
                                createdAtDate = orderData.createdAt.toDate();
                            } else if (orderData.createdAt.seconds) {
                                // Timestamp stored as object with seconds
                                createdAtDate = new Date(orderData.createdAt.seconds * 1000);
                            } else {
                                // Regular Date or timestamp
                                createdAtDate = new Date(orderData.createdAt);
                            }
                        } else {
                            createdAtDate = new Date(); // Fallback
                        }

                        // Handle deliveredAt timestamp properly
                        let deliveredAtDate = null;
                        if (orderData.deliveredAt) {
                            if (orderData.deliveredAt.toDate) {
                                deliveredAtDate = orderData.deliveredAt.toDate();
                            } else if (orderData.deliveredAt.seconds) {
                                deliveredAtDate = new Date(orderData.deliveredAt.seconds * 1000);
                            } else {
                                deliveredAtDate = new Date(orderData.deliveredAt);
                            }
                        }

                        // Handle estimatedDelivery timestamp properly
                        let estimatedDeliveryDate = null;
                        if (orderData.estimatedDelivery) {
                            if (orderData.estimatedDelivery.toDate) {
                                estimatedDeliveryDate = orderData.estimatedDelivery.toDate();
                            } else if (orderData.estimatedDelivery.seconds) {
                                estimatedDeliveryDate = new Date(orderData.estimatedDelivery.seconds * 1000);
                            } else {
                                estimatedDeliveryDate = new Date(orderData.estimatedDelivery);
                            }
                        }

                        // Only include relevant items from this designer
                        relevantOrders.push({
                            id: orderDoc.id,
                            ...orderData,
                            // Only include items from this designer
                            designerItems: designerItems,
                            // Calculate subtotal for just this designer's items
                            designerSubtotal: designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                            // Use the properly formatted dates
                            createdAt: createdAtDate,
                            deliveredAt: deliveredAtDate,
                            estimatedDelivery: estimatedDeliveryDate
                        });
                    }
                });

                console.log('Relevant orders for this designer:', relevantOrders.length);

                // Sort orders by date (newest first)
                relevantOrders.sort((a, b) => b.createdAt - a.createdAt);

                setCustomerOrders(relevantOrders);

                // Also fetch refund requests
                fetchRefundRequests();
            } catch (error) {
                console.error('Error fetching customer orders:', error);
                setMessage({ type: 'error', text: 'Failed to load customer orders.' });
            } finally {
                setLoadingOrders(false);
            }
        };

        fetchCustomerOrders();
    }, [userId, hasRole]);

    // Fetch refund requests for designer's products
    const fetchRefundRequests = async () => {
        if (!userId || !hasRole('designer')) return;

        setLoadingRefundRequests(true);

        try {
            const refundService = await import('../services/refundService').then(module => module.default);
            const result = await refundService.getRefundRequestsForDesigner(userId);

            if (result.success) {
                setRefundRequests(result.data);
            } else {
                console.error('Error fetching refund requests:', result.error);
            }
        } catch (error) {
            console.error('Error fetching refund requests:', error);
        } finally {
            setLoadingRefundRequests(false);
        }
    };

    // Fetch shipping settings for the designer
    useEffect(() => {
        if (!userId || !hasRole('designer')) return;

        const fetchShippingSettings = async () => {
            setLoadingShippingSettings(true);
            try {
                const shippingSettingsRef = doc(db, 'designerSettings', userId);
                const shippingSettingsDoc = await getDoc(shippingSettingsRef);

                if (shippingSettingsDoc.exists()) {
                    const data = shippingSettingsDoc.data();
                    setShippingSettings({
                        standardShippingCost: data.standardShippingCost !== undefined ? data.standardShippingCost : 10,
                        expressShippingCost: data.expressShippingCost !== undefined ? data.expressShippingCost : 25,
                        shippingProvider: data.shippingProvider || 'standard',
                        customProviderName: data.customProviderName || '',
                        offerFreeShipping: data.offerFreeShipping || false,
                        freeShippingThreshold: data.freeShippingThreshold || 50,
                        useCustomShipping: data.useCustomShipping || false
                    });
                }
            } catch (error) {
                console.error('Error fetching shipping settings:', error);
                setMessage({ type: 'error', text: 'Failed to load shipping settings.' });
            } finally {
                setLoadingShippingSettings(false);
            }
        };

        fetchShippingSettings();
    }, [userId, hasRole]);

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price || 0);
    };

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    };

    // Function to navigate to product edit page
    const handleEditProduct = (productId) => {
        navigate(`/product-edit/${productId}`);
    };

    // Check if order is within the cancellation window (1 hour)
    const isWithinCancellationWindow = (orderDate) => {
        if (!orderDate) return false;

        const orderTime = orderDate instanceof Date ? orderDate : new Date(orderDate);
        const currentTime = new Date();

        // Calculate the difference in milliseconds
        const timeDiff = currentTime - orderTime;

        // Convert to hours (1 hour = 3600000 milliseconds)
        const hoursDiff = timeDiff / 3600000;

        // Check if less than 1 hour has passed
        return hoursDiff < 1;
    };

    // Calculate funding percentage
    const calculateFundingPercentage = (product) => {
        if (!product.fundingGoal || product.fundingGoal <= 0) return 0;
        const currentFunding = product.currentFunding || 0;
        const percentage = Math.min(100, Math.round((currentFunding / product.fundingGoal) * 100));
        return percentage;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.includes('.')) {
            // Handle nested properties like privacy.showBio
            const [parent, child] = name.split('.');
            setFormData({
                ...formData,
                [parent]: {
                    ...formData[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            });
        } else {
            // Handle regular properties
            setFormData({
                ...formData,
                [name]: type === 'checkbox' ? checked : value
            });
        }
    };

    const handleProfilePhotoClick = () => {
        profilePhotoRef.current.click();
    };

    const handleHeaderPhotoClick = () => {
        headerPhotoRef.current.click();
    };

    // Handle profile photo selection
    const handleProfilePhotoChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'File size exceeds 5MB limit' });
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                setMessage({ type: 'error', text: 'Only image files are allowed' });
                return;
            }

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowProfileCropper(true);
        }
    };

    // Handle header photo selection
    const handleHeaderPhotoChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'File size exceeds 5MB limit' });
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                setMessage({ type: 'error', text: 'Only image files are allowed' });
                return;
            }

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowHeaderCropper(true);
        }
    };

    // Handle profile photo crop completion
    const handleProfileCropComplete = async (blob) => {
        try {
            setShowProfileCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
            setProfilePhotoFile(croppedFile);

            // Create a preview
            const previewUrl = URL.createObjectURL(blob);
            setProfilePhotoPreview(previewUrl);

            // If you want to upload immediately
            await uploadProfilePhoto(croppedFile);

        } catch (error) {
            console.error("Error processing cropped profile photo:", error);
            setMessage({ type: 'error', text: 'Error processing cropped image.' });
        }
    };

    // Handle header photo crop completion
    const handleHeaderCropComplete = async (blob) => {
        try {
            setShowHeaderCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], 'header-photo.jpg', { type: 'image/jpeg' });

            // Upload the cropped header photo
            await uploadHeaderPhoto(croppedFile);

        } catch (error) {
            console.error("Error processing cropped header photo:", error);
            setMessage({ type: 'error', text: 'Error processing cropped image.' });
        }
    };

    // Upload profile photo
    const uploadProfilePhoto = async (file) => {
        try {
            setLoading(true);

            const storageRef = ref(storage, `users/${currentUser.uid}/profile`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);

            // Update Auth profile
            await updateProfile(auth.currentUser, {
                photoURL: photoURL
            });

            // Update Firestore photoURL
            await updateDoc(doc(db, 'users', currentUser.uid), {
                photoURL: photoURL
            });

            // Clear the file selection
            setProfilePhotoFile(null);

            setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
        } catch (error) {
            console.error("Error uploading profile photo:", error);
            setMessage({ type: 'error', text: 'Failed to upload profile photo. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    // Upload header photo
    const uploadHeaderPhoto = async (file) => {
        try {
            setLoading(true);

            const storageRef = ref(storage, `users/${currentUser.uid}/header`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            setHeaderPhotoURL(url);

            // Update user profile in Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), {
                headerPhotoURL: url
            });

            setMessage({ type: 'success', text: 'Header photo updated successfully!' });
        } catch (error) {
            console.error("Error uploading header photo:", error);
            if (error.code === 'storage/unauthorized') {
                setMessage({ type: 'error', text: 'Permission denied: You may need to sign in again' });
            } else if (error.code === 'storage/quota-exceeded') {
                setMessage({ type: 'error', text: 'Storage quota exceeded. Please contact support.' });
            } else if (error.message) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'error', text: 'Failed to update header photo. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Update the Firestore profile directly using doc and updateDoc since updateUserProfile is not available
            await updateDoc(doc(db, 'users', currentUser.uid), {
                displayName: formData.displayName,
                phone: formData.phone,
                bio: formData.bio,
                location: formData.location,
                website: formData.website,
                birthday: formData.birthday,
                notifications: formData.notifications,
                updatedAt: new Date()
            });

            // If the displayName changed, update the Auth profile as well
            if (formData.displayName !== currentUser.displayName) {
                await updateProfile(auth.currentUser, {
                    displayName: formData.displayName
                });
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    // Add this new function to handle role request
    const handleRoleRequest = async () => {
        if (!requestedRole) return;

        setProcessingRoleRequest(true);
        setMessage({ type: '', text: '' });

        try {
            // Get current roles
            const currentRoles = Array.isArray(userRoles) ? userRoles : [userRole];

            // Check if user already has the requested role
            if (currentRoles.includes(requestedRole)) {
                setMessage({ type: 'warning', text: `You already have the ${requestedRole} role.` });
                setProcessingRoleRequest(false);
                return;
            }

            // Check if current user is admin
            const isAdmin = currentRoles.includes('admin');

            try {
                // Try to add the role (will either add directly for admins or create a request for regular users)
                const result = await addUserRole(requestedRole);

                if (result && result.isRequest) {
                    // Handle the case where a role request was created instead of direct role addition
                    setMessage({ type: 'success', text: result.message });
                } else {
                    // Role was directly added (admin case)
                    setMessage({ type: 'success', text: `Successfully added ${requestedRole} role to your account!` });
                }

                setRequestedRole(''); // Reset the dropdown
            } catch (error) {
                console.error("Error handling role request:", error);
                setMessage({
                    type: 'error',
                    text: error.message || 'An error occurred while processing your request.'
                });
            }
        } catch (error) {
            console.error("Error requesting role:", error);
            setMessage({ type: 'error', text: 'An error occurred while processing your request.' });
        } finally {
            setProcessingRoleRequest(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth); // Use signOut directly from firebase/auth
            if (logout) {
                logout();
            }
            navigate('/login'); // Redirect to login page after logout
        } catch (error) {
            console.error("Error logging out:", error);
            setMessage({ type: 'error', text: 'Failed to log out. Please try again.' });
        }
    };

    const handleDeleteAccount = async () => {
        if (!currentUser) return;

        const confirmation = window.confirm(
            'Are you absolutely sure you want to delete your account? This action is irreversible and will remove all your data.'
        );

        if (confirmation) {
            setLoading(true);
            setMessage({ type: '', text: '' });
            try {
                const userId = currentUser.uid;

                // 1. Delete Firestore user document (add other related data deletion if needed)
                await deleteDoc(doc(db, 'users', userId));

                // 2. Delete Firebase Auth user
                await deleteUser(auth.currentUser);

                setMessage({ type: 'success', text: 'Account deleted successfully.' });
                navigate('/login'); // Redirect after deletion

            } catch (error) {
                console.error("Error deleting account:", error);
                if (error.code === 'auth/requires-recent-login') {
                    setMessage({ type: 'error', text: 'This action requires recent login. Please log out and log back in to delete your account.' });
                } else {
                    setMessage({ type: 'error', text: 'Failed to delete account. Please try again.' });
                }
            } finally {
                setLoading(false);
            }
        }
    };

    // Function to handle updating order status
    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        if (!orderId || !newStatus) return;

        // Confirm before cancelling an order
        if (newStatus === 'cancelled') {
            const confirmCancel = window.confirm('Are you sure you want to reject this order? This will automatically refund the customer. This action cannot be undone.');
            if (!confirmCancel) return;
        }

        setLoading(true);

        try {
            const orderRef = doc(db, 'orders', orderId);

            // Create status update data
            const updateData = {
                status: newStatus,
                updatedAt: new Date()
            };

            // Add additional data for delivery
            if (newStatus === 'delivered') {
                updateData.deliveredAt = new Date();
            }

            // Update order in Firestore
            await updateDoc(orderRef, updateData);

            // If order is being cancelled, automatically process a refund
            if (newStatus === 'cancelled') {
                const refundResult = await refundService.processRefund(
                    orderId,
                    currentUser.uid, // Designer ID as the admin/processor
                    'Order rejected by designer',
                    true, // Refund all items
                    [] // No specific items since we're refunding all
                );

                if (refundResult.success) {
                    // Update refund status in the order
                    await updateDoc(orderRef, {
                        refundStatus: 'refunded',
                        refundDate: new Date(),
                        refundReason: 'Order rejected by designer',
                        refundedBy: currentUser.uid,
                        refundAmount: refundResult.refundAmount
                    });
                } else {
                    console.error('Error processing automatic refund:', refundResult.error);
                    // Continue with rejection even if refund fails - admin can handle refund manually
                }
            }

            // Create notification for the customer
            const orderDoc = await getDoc(orderRef);
            if (orderDoc.exists()) {
                const orderData = orderDoc.data();

                // Add notification for customer
                await addDoc(collection(db, 'notifications'), {
                    userId: orderData.userId,
                    title: newStatus === 'delivered'
                        ? 'Order Delivered'
                        : newStatus === 'cancelled'
                            ? 'Order Rejected and Refunded'
                            : 'Order Status Update',
                    message: newStatus === 'delivered'
                        ? 'Your order has been marked as delivered.'
                        : newStatus === 'cancelled'
                            ? 'Your order has been rejected by the designer. A refund has been processed to your wallet.'
                            : `Your order status has been updated to ${newStatus}.`,
                    type: 'order_status',
                    orderId: orderId,
                    read: false,
                    createdAt: new Date()
                });
            }

            // Update local state to reflect the change
            setCustomerOrders(prev =>
                prev.map(order =>
                    order.id === orderId
                        ? {
                            ...order,
                            status: newStatus,
                            ...(newStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
                            ...(newStatus === 'cancelled' ? {
                                refundStatus: 'refunded',
                                refundDate: new Date(),
                                refundReason: 'Order rejected by designer'
                            } : {})
                        }
                        : order
                )
            );

            setMessage({
                type: 'success',
                text: newStatus === 'delivered'
                    ? 'Order has been marked as delivered'
                    : newStatus === 'cancelled'
                        ? 'Order has been rejected and refund has been processed'
                        : `Order status updated to ${newStatus}`
            });

        } catch (error) {
            console.error('Error updating order status:', error);
            setMessage({
                type: 'error',
                text: 'Failed to update order status. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Function to handle refunding an order
    const handleRefundOrder = async (orderId, reason) => {
        if (!orderId) return;

        // Confirm before issuing refund
        const confirmRefund = window.confirm('Are you sure you want to refund this order? This action cannot be undone.');
        if (!confirmRefund) return;

        setLoading(true);

        try {
            // Process refund through refundService
            const result = await refundService.processRefund(
                orderId,
                currentUser.uid, // Designer ID as the admin/processor
                reason || 'Refund issued by designer',
                true, // Refund all items
                [] // No specific items since we're refunding all
            );

            if (result.success) {
                // Update local state to reflect the refund
                setCustomerOrders(prev =>
                    prev.map(order =>
                        order.id === orderId
                            ? {
                                ...order,
                                refundStatus: 'refunded',
                                refundDate: new Date(),
                                refundReason: reason || 'Refund issued by designer'
                            }
                            : order
                    )
                );

                setMessage({
                    type: 'success',
                    text: `Order has been refunded. ${result.refundAmount ? formatPrice(result.refundAmount) : ''} has been returned to the customer.`
                });
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Failed to process refund. Please try again.'
                });
            }
        } catch (error) {
            console.error('Error refunding order:', error);
            setMessage({
                type: 'error',
                text: 'Failed to process refund. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Function to handle approving a refund request
    const handleApproveRefundRequest = async (orderId, reason) => {
        if (!orderId) return;

        // Confirm before approving refund
        const confirmApprove = window.confirm('Are you sure you want to approve this refund request? This will process a refund to the customer. This action cannot be undone.');
        if (!confirmApprove) return;

        setLoading(true);

        try {
            // Process refund through refundService
            const result = await refundService.processRefund(
                orderId,
                currentUser.uid, // Designer ID as the admin/processor
                reason || 'Refund request approved by designer',
                true, // Refund all items
                [] // No specific items since we're refunding all
            );

            if (result.success) {
                // Update local state to reflect the refund
                setRefundRequests(prev => prev.filter(request => request.id !== orderId));

                // Update customer orders list if the order exists there
                setCustomerOrders(prev =>
                    prev.map(order =>
                        order.id === orderId
                            ? {
                                ...order,
                                refundStatus: 'refunded',
                                refundDate: new Date(),
                                refundReason: reason || 'Refund request approved by designer'
                            }
                            : order
                    )
                );

                setMessage({
                    type: 'success',
                    text: `Refund request approved. ${result.refundAmount ? formatPrice(result.refundAmount) : ''} has been returned to the customer.`
                });

                // Refresh refund requests
                fetchRefundRequests();
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Failed to process refund. Please try again.'
                });
            }
        } catch (error) {
            console.error('Error approving refund request:', error);
            setMessage({
                type: 'error',
                text: 'Failed to process refund. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Function to handle denying a refund request
    const handleDenyRefundRequest = async (orderId, reason) => {
        if (!orderId || !reason) {
            setMessage({
                type: 'error',
                text: 'Please provide a reason for denying the refund request.'
            });
            return;
        }

        setLoading(true);

        try {
            const result = await refundService.denyRefundRequest(
                orderId,
                currentUser.uid,
                reason
            );

            if (result.success) {
                // Update local state to reflect the denied refund
                setRefundRequests(prev => prev.filter(request => request.id !== orderId));

                // Update customer orders list if the order exists there
                setCustomerOrders(prev =>
                    prev.map(order =>
                        order.id === orderId
                            ? {
                                ...order,
                                refundStatus: 'denied',
                                refundDeniedDate: new Date(),
                                refundDeniedReason: reason
                            }
                            : order
                    )
                );

                setMessage({
                    type: 'success',
                    text: 'Refund request denied successfully.'
                });

                // Reset modal state
                setRefundDenyReason('');
                setSelectedRefundOrder(null);
                setShowRefundModal(false);

                // Refresh refund requests
                fetchRefundRequests();
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Failed to deny refund request. Please try again.'
                });
            }
        } catch (error) {
            console.error('Error denying refund request:', error);
            setMessage({
                type: 'error',
                text: 'Failed to deny refund request. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Function to open refund denial modal
    const openRefundDenialModal = (order) => {
        setSelectedRefundOrder(order);
        setRefundDenyReason('');
        setShowRefundModal(true);
    };

    const getRoleClass = () => {
        if (!userRole) return 'customer-role';

        if (Array.isArray(userRole) && userRole.length > 0) {
            // Use the first role for styling
            return `${userRole[0].toLowerCase()}-role`;
        }

        return typeof userRole === 'string' ? `${userRole.toLowerCase()}-role` : 'customer-role';
    };

    // Function to render role pills
    const renderRolePills = () => {
        // If user has no roles, show default customer role
        if (!userRoles && !userRole) return <div className="role-pill customer">Customer</div>;

        // Use userRoles array if available (from updated UserContext)
        if (Array.isArray(userRoles) && userRoles.length > 0) {
            return userRoles.map((role, index) => (
                <div key={index} className={`role-pill ${role.toLowerCase()}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </div>
            ));
        }

        // Backward compatibility for array-based userRole
        if (Array.isArray(userRole) && userRole.length > 0) {
            return userRole.map((role, index) => (
                <div key={index} className={`role-pill ${role.toLowerCase()}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </div>
            ));
        }

        // Single role string case
        const role = typeof userRole === 'string' ? userRole : 'customer';
        return <div className={`role-pill ${role.toLowerCase()}`}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </div>;
    };

    // Get tabs based on roles
    const getTabs = () => {
        const tabs = [
            { id: 'personal', label: 'Personal Info', roles: ['all'] },
            { id: 'account', label: 'Account Settings', roles: ['all'] },
            { id: 'preferences', label: 'Preferences', roles: ['all'] },
            { id: 'privacy', label: 'Privacy Settings', roles: ['all'] },
            { id: 'collectibles', label: 'Collectibles', roles: ['all'] } // Add Collectibles tab for all users
        ];

        // Designer-specific tabs
        if (hasRole('designer')) {
            tabs.push({ id: 'products', label: 'My Products', roles: ['designer'] });
            tabs.push({ id: 'sales', label: 'My Sales', roles: ['designer'] });
            tabs.push({ id: 'shipping', label: 'Shipping Settings', roles: ['designer'] }); // Add new Shipping tab
            tabs.push({ id: 'customer-orders', label: 'Customer Orders', roles: ['designer'] });
        }

        // Manufacturer-specific tabs
        if (hasRole('manufacturer')) {
            tabs.push({ id: 'quotes', label: 'My Quotes', roles: ['manufacturer'] });
        }

        // Investor-specific tabs
        if (hasRole('investor')) {
            tabs.push({ id: 'investments', label: 'My Investments', roles: ['investor'] });
        }

        return tabs;
    };

    // Function to check if a field should be displayed based on privacy settings
    const shouldShowField = (fieldName) => {
        // If viewing own profile, always show everything
        if (isOwnProfile) return true;

        // If not viewing own profile, check privacy settings
        // Make sure privacy settings exist and the field is explicitly allowed
        return userProfile?.privacy?.[fieldName] === true;
    };

    const handlePrivacySubmit = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Update Firestore profile privacy settings
            await updateDoc(doc(db, 'users', currentUser.uid), {
                privacy: formData.privacy,
                updatedAt: new Date()
            });

            setMessage({ type: 'success', text: 'Privacy settings updated successfully!' });
        } catch (error) {
            console.error("Error updating privacy settings:", error);
            setMessage({ type: 'error', text: 'Failed to update privacy settings. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'pending':
                return 'status-pending';
            case 'completed':
                return 'status-completed';
            case 'cancelled':
                return 'status-cancelled';
            default:
                return 'status-default';
        }
    };

    const handleSaveShippingSettings = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const shippingSettingsRef = doc(db, 'designerSettings', userId);

            // Ensure all values are proper types
            const settingsToSave = {
                standardShippingCost: parseFloat(shippingSettings.standardShippingCost) || 0,
                expressShippingCost: parseFloat(shippingSettings.expressShippingCost) || 0,
                shippingProvider: shippingSettings.shippingProvider,
                customProviderName: shippingSettings.customProviderName || '',
                offerFreeShipping: Boolean(shippingSettings.offerFreeShipping),
                freeShippingThreshold: parseFloat(shippingSettings.freeShippingThreshold) || 0,
                useCustomShipping: Boolean(shippingSettings.useCustomShipping),
                updatedAt: serverTimestamp()
            };

            // Check if document exists
            const docSnap = await getDoc(shippingSettingsRef);
            if (docSnap.exists()) {
                await updateDoc(shippingSettingsRef, settingsToSave);
            } else {
                // Add createdAt for new documents
                await setDoc(shippingSettingsRef, {
                    ...settingsToSave,
                    createdAt: serverTimestamp()
                });
            }

            setMessage({
                type: 'success',
                text: 'Shipping settings saved successfully!'
            });
        } catch (error) {
            console.error('Error saving shipping settings:', error);
            setMessage({
                type: 'error',
                text: 'Failed to save shipping settings. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-page">
            {showProfileCropper && (
                <ImageCropper
                    imageUrl={cropImageSrc}
                    aspect={1}
                    circularCrop={true}
                    onCropComplete={handleProfileCropComplete}
                    onCancel={() => {
                        setShowProfileCropper(false);
                        URL.revokeObjectURL(cropImageSrc);
                    }}
                />
            )}

            {showHeaderCropper && (
                <ImageCropper
                    imageUrl={cropImageSrc}
                    aspect={3 / 1}
                    circularCrop={false}
                    onCropComplete={handleHeaderCropComplete}
                    onCancel={() => {
                        setShowHeaderCropper(false);
                        URL.revokeObjectURL(cropImageSrc);
                    }}
                />
            )}

            {/* Refund Denial Modal */}
            {showRefundModal && selectedRefundOrder && (
                <div className="modal-overlay">
                    <div className="refund-denial-modal">
                        <h3>Deny Refund Request</h3>
                        <p>Please provide a reason for denying the refund request for Order #{selectedRefundOrder.id.slice(-6)}</p>

                        <div className="refund-info">
                            <div className="refund-order-details">
                                <p><strong>Customer:</strong> {selectedRefundOrder.shippingInfo?.fullName || 'Unknown'}</p>
                                <p><strong>Order Date:</strong> {formatDate(selectedRefundOrder.createdAt)}</p>
                                <p><strong>Customer Reason:</strong> {selectedRefundOrder.refundRequestReason || 'No reason provided'}</p>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="refundDenyReason">Denial Reason (required)</label>
                            <textarea
                                id="refundDenyReason"
                                name="refundDenyReason"
                                value={refundDenyReason}
                                onChange={(e) => setRefundDenyReason(e.target.value)}
                                placeholder="Please explain why you are denying this refund request..."
                                rows={4}
                                required
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => {
                                    setShowRefundModal(false);
                                    setSelectedRefundOrder(null);
                                    setRefundDenyReason('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-deny-confirm"
                                onClick={() => handleDenyRefundRequest(selectedRefundOrder.id, refundDenyReason)}
                                disabled={!refundDenyReason.trim() || loading}
                            >
                                {loading ? 'Processing...' : 'Deny Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <><div className="profile-header" style={{
                backgroundImage: headerPhotoURL ? `url(${headerPhotoURL})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}>
                <div className="profile-photo-container">
                    <img
                        src={profilePhotoPreview || currentUser?.photoURL || 'https://placehold.co/120x120?text=Profile'}
                        alt="Profile"
                        className="profile-photo" />
                    {isOwnProfile && (
                        <div className="photo-upload-button" onClick={handleProfilePhotoClick}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="55" height="55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={profilePhotoRef}
                        onChange={handleProfilePhotoChange}
                        style={{ display: 'none' }}
                        accept="image/*" />
                </div>

                {isOwnProfile && (
                    <div className="background-upload">
                        <button className="upload-button" onClick={handleHeaderPhotoClick}>
                            Change Cover
                        </button>
                        <input
                            type="file"
                            ref={headerPhotoRef}
                            onChange={handleHeaderPhotoChange}
                            style={{ display: 'none' }}
                            accept="image/*" />
                    </div>
                )}
            </div><div className="profile-wrapper">
                    <div className="profile-left">
                        <div className="profile-picture-section">
                            <h2>{formData.displayName || 'User'}</h2>
                            {(isOwnProfile || shouldShowField('showRole')) && (
                                <div className="roles-list">
                                    {renderRolePills()}
                                </div>
                            )}
                        </div>

                        <div className="action-buttons">
                            {isOwnProfile && hasRole('designer') && (
                                <Link to="/product-upload" className="pill-btn">Upload New Design</Link>
                            )}
                            {isOwnProfile && hasRole('investor') && (
                                <Link to="/portfolio" className="pill-btn">View Investment Portfolio</Link>
                            )}
                            {isOwnProfile && (
                                <Link to="/orders" className="pill-btn">My Orders</Link>
                            )}
                            {isOwnProfile && hasRole('designer') && (
                                <Link to="/earnings" className="pill-btn earnings">My Earnings</Link>
                            )}
                        </div>
                    </div>

                    <div className="profile-right">
                        <div className="profile-tabs">
                            {getTabs().map(tab => (
                                <div
                                    key={tab.id}
                                    className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </div>
                            ))}
                        </div>

                        <div className="profile-content">
                            {message.text && (
                                <div className={`message ${message.type}`}>
                                    {message.text}
                                </div>
                            )}

                            {activeTab === 'personal' && (
                                <form onSubmit={handleSubmit}>
                                    <div className="settings-section">
                                        <h3>Personal Information</h3>

                                        {isOwnProfile ? (
                                            // Full editable form for the profile owner
                                            <>
                                                <div className="form-row">
                                                    <div className="form-group form-field-half">
                                                        <label htmlFor="displayName">Full Name</label>
                                                        <input
                                                            type="text"
                                                            id="displayName"
                                                            name="displayName"
                                                            value={formData.displayName}
                                                            onChange={handleChange}
                                                            placeholder="Your full name" />
                                                    </div>

                                                    <div className="form-group form-field-half">
                                                        <label htmlFor="email">Email Address</label>
                                                        <input
                                                            type="email"
                                                            id="email"
                                                            name="email"
                                                            value={formData.email}
                                                            readOnly
                                                            disabled />
                                                    </div>
                                                </div>

                                                <div className="form-row">
                                                    <div className="form-group form-field-half">
                                                        <label htmlFor="phone">Phone Number</label>
                                                        <input
                                                            type="tel"
                                                            id="phone"
                                                            name="phone"
                                                            value={formData.phone}
                                                            onChange={handleChange}
                                                            placeholder="Your phone number" />
                                                    </div>

                                                    <div className="form-group form-field-half">
                                                        <label htmlFor="birthday">Birthday</label>
                                                        <input
                                                            type="date"
                                                            id="birthday"
                                                            name="birthday"
                                                            value={formData.birthday}
                                                            onChange={handleChange} />
                                                    </div>
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="location">Location</label>
                                                    <input
                                                        type="text"
                                                        id="location"
                                                        name="location"
                                                        value={formData.location}
                                                        onChange={handleChange}
                                                        placeholder="City, Country" />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="bio">Bio</label>
                                                    <textarea
                                                        id="bio"
                                                        name="bio"
                                                        value={formData.bio}
                                                        onChange={handleChange}
                                                        placeholder="Tell us about yourself" />
                                                </div>

                                                <div className="form-actions">
                                                    <button
                                                        type="submit"
                                                        className="submit-button"
                                                        disabled={loading}
                                                    >
                                                        {loading ? 'Saving...' : 'Save Changes'}
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            // Read-only view for visitors with privacy settings respected
                                            <div className="profile-view-only">
                                                <div className="profile-info-item">
                                                    <h4>Name</h4>
                                                    <p>{formData.displayName || 'Not specified'}</p>
                                                </div>

                                                {shouldShowField('showBio') && formData.bio && (
                                                    <div className="profile-info-item">
                                                        <h4>Bio</h4>
                                                        <p>{formData.bio}</p>
                                                    </div>
                                                )}

                                                {shouldShowField('showLocation') && formData.location && (
                                                    <div className="profile-info-item">
                                                        <h4>Location</h4>
                                                        <p>{formData.location}</p>
                                                    </div>
                                                )}

                                                {shouldShowField('showWebsite') && formData.website && (
                                                    <div className="profile-info-item">
                                                        <h4>Website</h4>
                                                        <p><a href={formData.website} target="_blank" rel="noopener noreferrer">{formData.website}</a></p>
                                                    </div>
                                                )}

                                                {shouldShowField('showBirthday') && formData.birthday && (
                                                    <div className="profile-info-item">
                                                        <h4>Birthday</h4>
                                                        <p>{new Date(formData.birthday).toLocaleDateString()}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </form>
                            )}

                            {activeTab === 'account' && (
                                <div className="settings-section">
                                    <h3>Account Information</h3>

                                    <div className="form-group">
                                        <label htmlFor="website">Website</label>
                                        <input
                                            type="url"
                                            id="website"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleChange}
                                            placeholder="https://yourwebsite.com" />
                                    </div>

                                    <div className="form-group">
                                        <label>Account Type</label>
                                        <div className="account-roles">
                                            <p>Your account has the following roles:</p>
                                            <div className="roles-list account-roles-list">
                                                {renderRolePills()}
                                            </div>
                                        </div>

                                        {isOwnProfile && (
                                            <div className="role-upgrade-section">
                                                <label htmlFor="requestRole">Request Additional Role:</label>
                                                <div className="role-upgrade-controls">
                                                    <select
                                                        id="requestRole"
                                                        value={requestedRole}
                                                        onChange={(e) => setRequestedRole(e.target.value)}
                                                        className="role-select"
                                                        disabled={processingRoleRequest}
                                                    >
                                                        <option value="">Select a role</option>
                                                        <option value="designer">Designer</option>
                                                        <option value="manufacturer">Manufacturer</option>
                                                        <option value="investor">Investor</option>
                                                        <option value="customer">Customer</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        className="role-request-button"
                                                        onClick={handleRoleRequest}
                                                        disabled={!requestedRole || processingRoleRequest}
                                                    >
                                                        {processingRoleRequest ? 'Processing...' : 'Request Role'}
                                                    </button>
                                                </div>
                                                <p className="role-info">
                                                    Adding a new role will give you access to additional features and capabilities.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Account Status</label>
                                        <p>Your account is <strong>Active</strong></p>
                                    </div>

                                    {isOwnProfile && (
                                        <div className="account-actions">
                                            <hr />
                                            <h4>Account Management</h4>
                                            <button
                                                type="button"
                                                className="button secondary-button logout-button"
                                                onClick={handleLogout}
                                                disabled={loading}
                                            >
                                                Log Out
                                            </button>
                                            <button
                                                type="button"
                                                className="button danger-button delete-account-button"
                                                onClick={handleDeleteAccount}
                                                disabled={loading}
                                            >
                                                {loading ? 'Deleting...' : 'Delete Account'}
                                            </button>
                                            <p className="delete-warning">
                                                Deleting your account is permanent and cannot be undone.
                                            </p>
                                        </div>
                                    )}

                                    <div className="form-actions">
                                        <button
                                            type="submit"
                                            className="submit-button"
                                            onClick={handleSubmit}
                                            disabled={loading}
                                        >
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'preferences' && (
                                <div className="settings-section">
                                    <h3>Preferences</h3>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="notifications"
                                            name="notifications"
                                            checked={formData.notifications}
                                            onChange={handleChange} />
                                        <label htmlFor="notifications">Receive email notifications</label>
                                    </div>

                                    <div className="form-group">
                                        <label>Email Preferences</label>
                                        <p>Manage your email preferences and subscriptions.</p>
                                        <button type="button" className="add-button">
                                            Manage Email Preferences
                                        </button>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="submit"
                                            className="submit-button"
                                            onClick={handleSubmit}
                                            disabled={loading}
                                        >
                                            {loading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'privacy' && isOwnProfile && (
                                <div className="settings-section privacy-settings-section">
                                    <h3>Privacy Settings</h3>
                                    <p>Control what information visitors can see on your profile</p>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showRole"
                                            name="privacy.showRole"
                                            checked={formData.privacy.showRole}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showRole: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showRole">Show my roles</label>
                                    </div>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showBio"
                                            name="privacy.showBio"
                                            checked={formData.privacy.showBio}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showBio: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showBio">Show my bio</label>
                                    </div>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showLocation"
                                            name="privacy.showLocation"
                                            checked={formData.privacy.showLocation}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showLocation: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showLocation">Show my location</label>
                                    </div>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showWebsite"
                                            name="privacy.showWebsite"
                                            checked={formData.privacy.showWebsite}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showWebsite: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showWebsite">Show my website</label>
                                    </div>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showBirthday"
                                            name="privacy.showBirthday"
                                            checked={formData.privacy.showBirthday}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showBirthday: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showBirthday">Show my birthday</label>
                                    </div>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="showProducts"
                                            name="privacy.showProducts"
                                            checked={formData.privacy.showProducts}
                                            onChange={(e) => {
                                                setFormData({
                                                    ...formData,
                                                    privacy: {
                                                        ...formData.privacy,
                                                        showProducts: e.target.checked
                                                    }
                                                });
                                            }} />
                                        <label htmlFor="showProducts">Show my products</label>
                                    </div>

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="submit-button"
                                            onClick={handlePrivacySubmit}
                                            disabled={loading}
                                        >
                                            {loading ? 'Saving...' : 'Save Privacy Settings'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'products' && (
                                <div className="settings-section products-section">
                                    <h3>Manage Products</h3>

                                    {isOwnProfile && (
                                        <div className="section-actions">
                                            <Link to="/product-upload" className="btn-primary">
                                                Upload New Product
                                            </Link>
                                        </div>
                                    )}

                                    {isOwnProfile ? (
                                        // Product management for profile owner
                                        <>
                                            {loadingProducts ? (
                                                <div className="loading-container">
                                                    <LoadingSpinner />
                                                    <p>Loading your products...</p>
                                                </div>
                                            ) : designerProducts.length === 0 ? (
                                                <div className="empty-state">
                                                    <p>You haven't uploaded any products yet.</p>
                                                    <Link to="/product-upload" className="btn-secondary">
                                                        Create Your First Product
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="product-management-list">
                                                    {designerProducts.map(product => (
                                                        <div key={product.id} className="managed-product-card">
                                                            <div className="product-image">
                                                                <img
                                                                    src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                                                                        ? product.imageUrls[0]
                                                                        : product.imageUrl || '/placeholder-product.jpg'}
                                                                    alt={product.name} />
                                                                <span className={`product-status status-${product.status || 'pending'}`}>
                                                                    {product.status || 'Pending'}
                                                                </span>
                                                            </div>
                                                            <div className="product-info">
                                                                <h3>{product.name}</h3>
                                                                <div className="product-meta">
                                                                    <span className="product-price">{formatPrice(product.price)}</span>
                                                                    <span className="product-date">Created: {formatDate(product.createdAt)}</span>
                                                                </div>
                                                                {product.fundingGoal > 0 && (
                                                                    <div className="product-funding">
                                                                        <div className="funding-progress-bar">
                                                                            <div
                                                                                className="funding-bar"
                                                                                style={{ width: `${calculateFundingPercentage(product)}%` }}
                                                                            ></div>
                                                                        </div>
                                                                        <div className="funding-text">
                                                                            <span className="funding-percentage">
                                                                                {calculateFundingPercentage(product)}% funded
                                                                            </span>
                                                                            <span className="funding-amount">
                                                                                {formatPrice(product.currentFunding || 0)} of {formatPrice(product.fundingGoal)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="product-actions">
                                                                    <button
                                                                        onClick={() => handleEditProduct(product.id)}
                                                                        className="btn-edit"
                                                                    >
                                                                        Edit Product
                                                                    </button>
                                                                    <Link
                                                                        to={`/product/${product.id}`}
                                                                        className="btn-view"
                                                                    >
                                                                        View Details
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        // Products view for visitors respecting privacy settings
                                        <>
                                            {!shouldShowField('showProducts') ? (
                                                <div className="profile-private-notice">
                                                    <p>This user has chosen to keep their products private.</p>
                                                </div>
                                            ) : loadingProducts ? (
                                                <div className="loading-container">
                                                    <LoadingSpinner />
                                                    <p>Loading products...</p>
                                                </div>
                                            ) : designerProducts.length === 0 ? (
                                                <div className="empty-state">
                                                    <p>This user hasn't uploaded any products yet.</p>
                                                </div>
                                            ) : (
                                                <div className="product-grid visitor-view">
                                                    {designerProducts
                                                        .filter(product => product.status === 'active')
                                                        .map(product => (
                                                            <div key={product.id} className="product-card">
                                                                <Link to={`/product/${product.id}`} className="product-link">
                                                                    <div className="product-image">
                                                                        <img
                                                                            src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                                                                                ? product.imageUrls[0]
                                                                                : product.imageUrl || '/placeholder-product.jpg'}
                                                                            alt={product.name} />
                                                                    </div>
                                                                    <div className="product-info">
                                                                        <h3>{product.name}</h3>
                                                                        <div className="product-price">{formatPrice(product.price)}</div>
                                                                    </div>
                                                                </Link>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === 'investments' && hasRole('investor') && (
                                <div className="settings-section">
                                    <h3>Your Investments</h3>
                                    <p>View and manage your investment portfolio.</p>
                                    <div className="section-actions">
                                        <Link to="/portfolio" className="btn-primary">
                                            Go to Portfolio
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'customer-orders' && (
                                <div className="settings-section">
                                    <h3>Customer Orders</h3>
                                    <p>View and manage orders for your products</p>

                                    {/* Search and filtering controls */}
                                    <div className="order-filters">
                                        <div className="search-filter">
                                            <input
                                                type="text"
                                                placeholder="Search by order # or customer name"
                                                value={orderSearchTerm}
                                                onChange={(e) => setOrderSearchTerm(e.target.value)}
                                                className="search-orders-input" />
                                        </div>
                                        <div className="filter-controls">
                                            <select
                                                value={orderFilter}
                                                onChange={(e) => setOrderFilter(e.target.value)}
                                                className="order-status-filter"
                                            >
                                                <option value="all">All Orders</option>
                                                <option value="incomplete">Incomplete</option>
                                                <option value="complete">Completed</option>
                                            </select>
                                            <select
                                                value={orderTimeFrame}
                                                onChange={(e) => setOrderTimeFrame(e.target.value)}
                                                className="order-time-filter"
                                            >
                                                <option value="all">All Time</option>
                                                <option value="week">This Week</option>
                                                <option value="month">This Month</option>
                                                <option value="year">This Year</option>
                                            </select>
                                        </div>
                                    </div>

                                    {loadingOrders ? (
                                        <div className="loading-container">
                                            <LoadingSpinner />
                                            <p>Loading customer orders...</p>
                                        </div>
                                    ) : (
                                        <div className="orders-container">
                                            {/* Refund Requests Section */}
                                            {refundRequests.length > 0 && (
                                                <div className="refund-requests-section">
                                                    <h4 className="section-title">Refund Requests</h4>
                                                    <p className="section-description">These orders have pending refund requests from customers that require your response.</p>

                                                    <div className="refund-requests-list">
                                                        {refundRequests.map(request => (
                                                            <div key={request.id} className="refund-request-card">
                                                                <div className="request-header">
                                                                    <div className="request-id">
                                                                        <h3>Order #{request.id.slice(-6)}</h3>
                                                                        <span className="status-badge status-warning">Refund Requested</span>
                                                                    </div>
                                                                    <div className="request-date">
                                                                        <div>Requested on {formatDate(request.refundRequestDate)}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="customer-info">
                                                                    <strong>Customer:</strong> {request.shippingInfo?.fullName || 'Unknown'}
                                                                </div>

                                                                <div className="refund-reason">
                                                                    <strong>Reason:</strong> {request.refundRequestReason || 'No reason provided'}
                                                                </div>

                                                                <div className="order-items-preview">
                                                                    {request.items.filter(item => {
                                                                        // Only show items from this designer
                                                                        const product = designerProducts.find(p => p.id === item.id);
                                                                        return !!product;
                                                                    }).slice(0, 3).map((item, index) => (
                                                                        <div key={index} className="preview-item-image">
                                                                            <img
                                                                                src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                                                                                alt={item.name} />
                                                                            {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                <div className="refund-actions">
                                                                    <button
                                                                        className="btn-approve-refund"
                                                                        onClick={() => handleApproveRefundRequest(request.id, request.refundRequestReason)}
                                                                    >
                                                                        Approve Refund
                                                                    </button>
                                                                    <button
                                                                        className="btn-deny-refund"
                                                                        onClick={() => openRefundDenialModal(request)}
                                                                    >
                                                                        Deny Refund
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Regular Orders Section */}
                                            {orderFilter !== 'complete' && (
                                                <div className="orders-group">
                                                    <h4 className="orders-group-title">Pending Orders</h4>
                                                    <div className="orders-list">
                                                        {customerOrders
                                                            .filter(order => {
                                                                // Filter by search term
                                                                const searchMatch = orderSearchTerm === '' ||
                                                                    order.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                                                                    (order.shippingInfo?.fullName || '').toLowerCase().includes(orderSearchTerm.toLowerCase());

                                                                // Filter by status
                                                                const statusMatch = order.status !== 'delivered' && order.status !== 'completed';

                                                                // Filter by time period
                                                                let timeMatch = true;
                                                                const orderDate = new Date(order.createdAt);
                                                                const now = new Date();

                                                                if (orderTimeFrame === 'week') {
                                                                    const weekAgo = new Date();
                                                                    weekAgo.setDate(now.getDate() - 7);
                                                                    timeMatch = orderDate >= weekAgo;
                                                                } else if (orderTimeFrame === 'month') {
                                                                    const monthAgo = new Date();
                                                                    monthAgo.setMonth(now.getMonth() - 1);
                                                                    timeMatch = orderDate >= monthAgo;
                                                                } else if (orderTimeFrame === 'year') {
                                                                    const yearAgo = new Date();
                                                                    yearAgo.setFullYear(now.getFullYear() - 1);
                                                                    timeMatch = orderDate >= yearAgo;
                                                                }

                                                                return searchMatch && statusMatch && timeMatch;
                                                            })
                                                            .map(order => (
                                                                <div key={order.id} className="order-card">
                                                                    <div className="order-header">
                                                                        <div className="order-id">
                                                                            <h3>Order #{order.id.slice(-6)}</h3>
                                                                            <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="order-date">
                                                                            <div>{formatDate(order.createdAt)}</div>
                                                                            <div className="order-time">
                                                                                {new Date(order.createdAt).toLocaleTimeString('en-US', {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit'
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="order-customer-info">
                                                                        <strong>Customer:</strong> {order.shippingInfo?.fullName || 'Unknown'}
                                                                    </div>

                                                                    <div className="order-items-preview">
                                                                        {order.designerItems.slice(0, 3).map((item, index) => (
                                                                            <div key={index} className="preview-item-image">
                                                                                <img
                                                                                    src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                                                                                    alt={item.name} />
                                                                                {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                                                                            </div>
                                                                        ))}
                                                                        {order.designerItems.length > 3 && (
                                                                            <div className="more-items">
                                                                                +{order.designerItems.length - 3} more
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Toggle details button */}
                                                                    <button
                                                                        className="toggle-details-button"
                                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                                    >
                                                                        {expandedOrderId === order.id ? 'Hide Details' : 'Show Details'}
                                                                    </button>

                                                                    {/* Expanded details section */}
                                                                    {expandedOrderId === order.id && (
                                                                        <>
                                                                            <div className="order-details">
                                                                                <div className="order-items-details">
                                                                                    {order.designerItems.map((item, index) => (
                                                                                        <div key={index} className="order-item-line">
                                                                                            <span className="item-name">{item.name}</span>
                                                                                            <span className="item-quantity">x{item.quantity}</span>
                                                                                            <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="order-subtotal">
                                                                                    <strong>Designer total:</strong> {formatPrice(order.designerSubtotal)}
                                                                                </div>
                                                                            </div>

                                                                            {/* Shipping address */}
                                                                            <div className="shipping-address">
                                                                                <h4>Shipping Address</h4>
                                                                                <p>{order.shippingInfo?.fullName}</p>
                                                                                <p>{order.shippingInfo?.address}</p>
                                                                                <p>{order.shippingInfo?.city}, {order.shippingInfo?.state} {order.shippingInfo?.zipCode}</p>
                                                                                <p>{order.shippingInfo?.country}</p>
                                                                                <p><strong>Phone:</strong> {order.shippingInfo?.phone}</p>
                                                                                <p><strong>Email:</strong> {order.shippingInfo?.email}</p>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    <div className="shipping-preview">
                                                                        <div className="shipping-method">
                                                                            <strong>Shipping:</strong> {order.shippingInfo?.shippingMethod === 'express' ? 'Express' : 'Standard'}
                                                                        </div>
                                                                        {order.estimatedDelivery && (
                                                                            <div className="estimated-delivery">
                                                                                <strong>Est. Delivery:</strong> {new Date(order.estimatedDelivery.seconds * 1000).toLocaleDateString('en-US', {
                                                                                    year: 'numeric',
                                                                                    month: 'long',
                                                                                    day: 'numeric'
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Order action buttons */}
                                                                    <div className="order-actions">
                                                                        <button
                                                                            className="btn-mark-delivered"
                                                                            onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                                                        >
                                                                            Mark as Delivered
                                                                        </button>
                                                                        <button
                                                                            className="btn-reject-order"
                                                                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                                                                        >
                                                                            Reject Order
                                                                        </button>
                                                                        <button
                                                                            className="btn-refund-order"
                                                                            onClick={() => handleRefundOrder(order.id, 'Customer requested refund')}
                                                                        >
                                                                            Refund Order
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Completed orders */}
                                            {orderFilter !== 'incomplete' && (
                                                <div className="orders-group">
                                                    <h4 className="orders-group-title">Completed Orders</h4>
                                                    <div className="orders-list">
                                                        {customerOrders
                                                            .filter(order => {
                                                                // Filter by search term
                                                                const searchMatch = orderSearchTerm === '' ||
                                                                    order.id.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
                                                                    (order.shippingInfo?.fullName || '').toLowerCase().includes(orderSearchTerm.toLowerCase());

                                                                // Filter by status
                                                                const statusMatch = order.status === 'delivered' || order.status === 'completed';

                                                                // Filter by time period
                                                                let timeMatch = true;
                                                                const orderDate = new Date(order.createdAt);
                                                                const now = new Date();

                                                                if (orderTimeFrame === 'week') {
                                                                    const weekAgo = new Date();
                                                                    weekAgo.setDate(now.getDate() - 7);
                                                                    timeMatch = orderDate >= weekAgo;
                                                                } else if (orderTimeFrame === 'month') {
                                                                    const monthAgo = new Date();
                                                                    monthAgo.setMonth(now.getMonth() - 1);
                                                                    timeMatch = orderDate >= monthAgo;
                                                                } else if (orderTimeFrame === 'year') {
                                                                    const yearAgo = new Date();
                                                                    yearAgo.setFullYear(now.getFullYear() - 1);
                                                                    timeMatch = orderDate >= yearAgo;
                                                                }

                                                                return searchMatch && statusMatch && timeMatch;
                                                            })
                                                            .map(order => (
                                                                <div key={order.id} className="order-card completed">
                                                                    <div className="order-header">
                                                                        <div className="order-id">
                                                                            <h3>Order #{order.id.slice(-6)}</h3>
                                                                            <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                                                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="order-date">
                                                                            <div>{formatDate(order.createdAt)}</div>
                                                                            <div className="order-time">
                                                                                {new Date(order.createdAt).toLocaleTimeString('en-US', {
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit'
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="order-customer-info">
                                                                        <strong>Customer:</strong> {order.shippingInfo?.fullName || 'Unknown'}
                                                                    </div>

                                                                    <div className="order-items-preview">
                                                                        {order.designerItems.slice(0, 3).map((item, index) => (
                                                                            <div key={index} className="preview-item-image">
                                                                                <img
                                                                                    src={item.imageUrl || 'https://via.placeholder.com/40?text=Product'}
                                                                                    alt={item.name} />
                                                                                {item.quantity > 1 && <span className="preview-quantity">{item.quantity}</span>}
                                                                            </div>
                                                                        ))}
                                                                        {order.designerItems.length > 3 && (
                                                                            <div className="more-items">
                                                                                +{order.designerItems.length - 3} more
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Toggle details button */}
                                                                    <button
                                                                        className="toggle-details-button"
                                                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                                    >
                                                                        {expandedOrderId === order.id ? 'Hide Details' : 'Show Details'}
                                                                    </button>

                                                                    {/* Expanded details section */}
                                                                    {expandedOrderId === order.id && (
                                                                        <>
                                                                            <div className="order-details">
                                                                                <div className="order-items-details">
                                                                                    {order.designerItems.map((item, index) => (
                                                                                        <div key={index} className="order-item-line">
                                                                                            <span className="item-name">{item.name}</span>
                                                                                            <span className="item-quantity">x{item.quantity}</span>
                                                                                            <span className="item-price">{formatPrice(item.price * item.quantity)}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="order-subtotal">
                                                                                    <strong>Designer total:</strong> {formatPrice(order.designerSubtotal)}
                                                                                </div>
                                                                            </div>

                                                                            {/* Shipping address */}
                                                                            <div className="shipping-address">
                                                                                <h4>Shipping Address</h4>
                                                                                <p>{order.shippingInfo?.fullName}</p>
                                                                                <p>{order.shippingInfo?.address}</p>
                                                                                <p>{order.shippingInfo?.city}, {order.shippingInfo?.state} {order.shippingInfo?.zipCode}</p>
                                                                                <p>{order.shippingInfo?.country}</p>
                                                                                <p><strong>Phone:</strong> {order.shippingInfo?.phone}</p>
                                                                                <p><strong>Email:</strong> {order.shippingInfo?.email}</p>
                                                                            </div>
                                                                        </>
                                                                    )}

                                                                    <div className="shipping-preview">
                                                                        <div className="shipping-method">
                                                                            <strong>Shipping:</strong> {order.shippingInfo?.shippingMethod === 'express' ? 'Express' : 'Standard'}
                                                                        </div>
                                                                        <div className="completed-date">
                                                                            <strong>Completed:</strong> {order.deliveredAt ?
                                                                                new Date(order.deliveredAt.seconds * 1000).toLocaleDateString('en-US', {
                                                                                    year: 'numeric',
                                                                                    month: 'long',
                                                                                    day: 'numeric'
                                                                                }) : 'Unknown'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'shipping' && hasRole('designer') && (
                                <div className="settings-section shipping-settings-section">
                                    <h3>Shipping Settings</h3>
                                    <p>Configure default shipping costs and options for all your products</p>

                                    {loadingShippingSettings ? (
                                        <div className="loading-container">
                                            <LoadingSpinner />
                                            <p>Loading shipping settings...</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSaveShippingSettings();
                                        }}>
                                            <div className="form-row">
                                                <div className="form-group form-field-half">
                                                    <label htmlFor="standardShippingCost">Standard Shipping Cost ($)</label>
                                                    <input
                                                        type="number"
                                                        id="standardShippingCost"
                                                        value={shippingSettings.standardShippingCost}
                                                        onChange={(e) => setShippingSettings({
                                                            ...shippingSettings,
                                                            standardShippingCost: parseFloat(e.target.value) || 0
                                                        })}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <p className="field-description">This is your default shipping cost applied to all products</p>
                                                </div>

                                                <div className="form-group form-field-half">
                                                    <label htmlFor="expressShippingCost">Express Shipping Cost ($)</label>
                                                    <input
                                                        type="number"
                                                        id="expressShippingCost"
                                                        value={shippingSettings.expressShippingCost}
                                                        onChange={(e) => setShippingSettings({
                                                            ...shippingSettings,
                                                            expressShippingCost: parseFloat(e.target.value) || 0
                                                        })}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <p className="field-description">Cost for express shipping option</p>
                                                </div>
                                            </div>

                                            <div className="form-group checkbox">
                                                <input
                                                    type="checkbox"
                                                    id="offerFreeShipping"
                                                    checked={shippingSettings.offerFreeShipping}
                                                    onChange={(e) => setShippingSettings({
                                                        ...shippingSettings,
                                                        offerFreeShipping: e.target.checked
                                                    })}
                                                />
                                                <label htmlFor="offerFreeShipping">Offer free shipping on orders above a threshold</label>
                                            </div>

                                            {shippingSettings.offerFreeShipping && (
                                                <div className="form-group">
                                                    <label htmlFor="freeShippingThreshold">Free Shipping Threshold ($)</label>
                                                    <input
                                                        type="number"
                                                        id="freeShippingThreshold"
                                                        value={shippingSettings.freeShippingThreshold}
                                                        onChange={(e) => setShippingSettings({
                                                            ...shippingSettings,
                                                            freeShippingThreshold: parseFloat(e.target.value) || 0
                                                        })}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <p className="field-description">Orders above this amount will receive free shipping</p>
                                                </div>
                                            )}

                                            <div className="form-group">
                                                <label htmlFor="shippingProvider">Preferred Shipping Provider</label>
                                                <select
                                                    id="shippingProvider"
                                                    value={shippingSettings.shippingProvider}
                                                    onChange={(e) => {
                                                        const useCustom = e.target.value === 'custom';
                                                        setShippingSettings({
                                                            ...shippingSettings,
                                                            shippingProvider: e.target.value,
                                                            useCustomShipping: useCustom
                                                        });
                                                    }}
                                                >
                                                    {shippingProviders.map(provider => (
                                                        <option key={provider.id} value={provider.id}>{provider.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {shippingSettings.shippingProvider === 'custom' && (
                                                <div className="form-group">
                                                    <label htmlFor="customProviderName">Custom Provider Name</label>
                                                    <input
                                                        type="text"
                                                        id="customProviderName"
                                                        value={shippingSettings.customProviderName}
                                                        onChange={(e) => setShippingSettings({
                                                            ...shippingSettings,
                                                            customProviderName: e.target.value
                                                        })}
                                                        placeholder="Enter your custom shipping provider's name"
                                                    />
                                                </div>
                                            )}

                                            <div className="shipping-settings-info">
                                                <h4>How shipping costs apply to your products:</h4>
                                                <ul>
                                                    <li>These standard and express shipping costs will be used as default for all your products</li>
                                                    <li>You can override these settings for specific products when creating or editing them</li>
                                                    <li>Free shipping threshold applies across all your products unless overridden</li>
                                                </ul>
                                            </div>

                                            <div className="form-actions">
                                                <button
                                                    type="submit"
                                                    className="submit-button"
                                                    disabled={loading}
                                                >
                                                    {loading ? 'Saving...' : 'Save Shipping Settings'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            )}

                            {activeTab === 'collectibles' && (
                                <div className="settings-section collectibles-section">
                                    <h3>Your Nop Collection</h3>
                                    <p>View all the Nops you've collected from the daily Nop feature.</p>

                                    <NopCollection userId={userId} />

                                    <div className="collectibles-info">
                                        <p>Don't forget to check the footer each day for a new collectible Nop!</p>
                                    </div>
                                </div>
                            )}

                            {/* Achievements Section */}
                            <div className="profile-section">
                                <div className="section-header">
                                    <h2>Achievements</h2>
                                    <Link to={userId ? `/profile/${userId}/achievements` : "/profile/achievements"} className="view-all-link">
                                        View All
                                    </Link>
                                </div>
                                <AchievementBadgeDisplay
                                    userId={userId || currentUser?.uid}
                                    showTitle={false}
                                    limit={8} />
                            </div>
                        </div>
                    </div>
                </div></>
        </div>
    );
};

export default ProfilePage;
