import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { updateProfile, signOut, deleteUser } from 'firebase/auth'; // Import signOut and deleteUser
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc, getDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Import deleteDoc, getDoc, addDoc, setDoc, serverTimestamp
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import '../styles/ProfilePage.css';
import '../styles/ImageCropper.css';
import '../styles/SalesTab.css'; // Import the new SalesTab styles
import ImageCropper from '../components/ImageCropper';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AchievementBadgeDisplay from '../components/AchievementBadgeDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import NopCollection from '../components/NopCollection';
import ManufacturerSelectionModal from '../components/ManufacturerSelectionModal';
import UserReviewSection from '../components/reviews/UserReviewSection'; // Import UserReviewSection
import userDataExportService from '../services/userDataExportService'; // Import userDataExportService
import PersonalInfoTab from './ProfileTabs/PersonalInfoTab';
import AccountSettingsTab from './ProfileTabs/AccountSettingsTab';
import PreferencesTab from './ProfileTabs/PreferencesTab';
import PrivacySettingsTab from './ProfileTabs/PrivacySettingsTab';
import ReviewsTab from './ProfileTabs/ReviewsTab';
import CollectiblesTab from './ProfileTabs/CollectiblesTab';
import MyProductsTab from './ProfileTabs/MyProductsTab';
import MySalesTab from './ProfileTabs/MySalesTab';
import ManufacturerSettingsTab from './ProfileTabs/ManufacturerSettingsTab';
import ShippingSettingsTab from './ProfileTabs/ShippingSettingsTab';
import CustomerOrdersTab from './ProfileTabs/CustomerOrdersTab';
import MyQuotesTab from './ProfileTabs/MyQuotesTab';
import MyInvestmentsTab from './ProfileTabs/MyInvestmentsTab';



const ProfilePage = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile, userRole, userRoles, addUserRole, hasRole, logout } = useUser();
    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // State for data export
    const [exportFormat, setExportFormat] = useState('json');
    const [exportOptions, setExportOptions] = useState({
        includeOrders: true,
        includeTransactions: true,
        includeProducts: true,
        includeInvestments: true,
        includeMessages: true,
        includeReviews: true
    });
    const [dataExportLoading, setDataExportLoading] = useState(false);

    // Add formatDate helper function
    const formatDate = (date) => {
        if (!date) return 'N/A';

        // Handle Firebase Timestamp
        if (date && typeof date === 'object' && date.toDate) {
            date = date.toDate();
        }

        // Handle timestamp objects with seconds
        if (date && typeof date === 'object' && date.seconds) {
            date = new Date(date.seconds * 1000);
        }

        // If it's a string, try to convert to date
        if (typeof date === 'string') {
            date = new Date(date);
        }

        // Ensure it's a valid date
        if (!(date instanceof Date) || isNaN(date)) {
            return 'Invalid date';
        }

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

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
    const [salesTimeFrame, setSalesTimeFrame] = useState('all'); // 'all', 'week', 'month', 'year'
    const [salesFilter, setSalesFilter] = useState('all'); // 'all', 'completed', 'cancelled'
    const [salesSearchTerm, setSalesSearchTerm] = useState('');    // State for customer orders
    const [customerOrders, setCustomerOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
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
        freeExpressShipping: false,
        useCustomShipping: true
    });

    const [loadingShippingSettings, setLoadingShippingSettings] = useState(false);

    // Define shipping providers options
    const shippingProviders = [
        { id: 'standard', name: 'Standard Shipping' },
        { id: 'ups', name: 'UPS' },
        { id: 'fedex', name: 'FedEx' },
        { id: 'usps', name: 'USPS' },
        { id: 'dhl', name: 'DHL' },
        { id: 'custom', name: 'Custom Provider' }
    ];

    // State for manufacturer settings
    const [manufacturerSettings, setManufacturerSettings] = useState({});
    const [manufacturers, setManufacturers] = useState([]);
    const [loadingManufacturers, setLoadingManufacturers] = useState(false);
    const [showManufacturerModal, setShowManufacturerModal] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [autoTransferFunds, setAutoTransferFunds] = useState(false);

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

    // Function to fetch designer's products (used for refreshing data)
    const fetchDesignerProducts = async () => {
        if (!userId) return;

        // Only try to fetch products if the user has designer role
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
    };    // Fetch designer's products
    useEffect(() => {
        fetchDesignerProducts();
    }, [userId, hasRole]); // Depend directly on hasRole to ensure role changes are detected

    // Fetch shipping settings for the designer
    useEffect(() => {
        const fetchShippingSettings = async () => {
            if (!userId || !hasRole('designer') || activeTab !== 'settings') return;

            setLoadingShippingSettings(true);
            try {
                const settingsRef = doc(db, 'designerSettings', userId);
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setShippingSettings({
                        standardShippingCost: data.standardShippingCost || 10,
                        expressShippingCost: data.expressShippingCost || 25,
                        shippingProvider: data.shippingProvider || 'standard',
                        customProviderName: data.customProviderName || '',
                        offerFreeShipping: data.offerFreeShipping || false,
                        freeShippingThreshold: data.freeShippingThreshold || 0,
                        freeExpressShipping: data.freeExpressShipping || false,
                        useCustomShipping: data.useCustomShipping !== undefined ? data.useCustomShipping : true
                    });
                }
                setLoadingShippingSettings(false);
            } catch (error) {
                console.error("Error loading shipping settings:", error);
                setLoadingShippingSettings(false);
            }
        };

        fetchShippingSettings();
    }, [userId, hasRole, activeTab]);

    const handleSaveShippingSettings = async () => {
        if (!userId || !hasRole('designer')) return;

        setLoading(true);
        try {
            const settingsRef = doc(db, 'designerSettings', userId);
            await setDoc(settingsRef, {
                standardShippingCost: parseFloat(shippingSettings.standardShippingCost) || 10,
                expressShippingCost: parseFloat(shippingSettings.expressShippingCost) || 25,
                shippingProvider: shippingSettings.shippingProvider,
                customProviderName: shippingSettings.customProviderName,
                offerFreeShipping: shippingSettings.offerFreeShipping,
                freeShippingThreshold: parseFloat(shippingSettings.freeShippingThreshold) || 0,
                freeExpressShipping: shippingSettings.freeExpressShipping,
                useCustomShipping: shippingSettings.useCustomShipping,
                updatedAt: serverTimestamp()
            }, { merge: true });

            success("Shipping settings saved successfully");
        } catch (error) {
            console.error("Error saving shipping settings:", error);
            showError("Failed to save shipping settings. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch manufacturer settings for the designer
    useEffect(() => {
        if (!userId || !hasRole('designer') || activeTab !== 'manufacturer-settings') return;

        const fetchManufacturerSettings = async () => {
            setLoadingManufacturers(true);

            try {
                // Fetch existing manufacturer settings
                const settingsRef = doc(db, 'designerSettings', userId);
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists() && settingsDoc.data().manufacturerSettings) {
                    setManufacturerSettings(settingsDoc.data().manufacturerSettings);
                    setAutoTransferFunds(settingsDoc.data().autoTransferFunds || false);
                }

                // Fetch ALL manufacturers with manufacturer role (not just verified ones)
                const allManufacturers = [];
                const usersRef = collection(db, 'users');
                const manufacturersQuery = query(
                    usersRef,
                    where('roles', 'array-contains', 'manufacturer')
                );

                const manufacturersSnapshot = await getDocs(manufacturersQuery);
                manufacturersSnapshot.forEach(doc => {
                    allManufacturers.push({
                        id: doc.id,
                        displayName: doc.data().displayName || doc.data().email,
                        verified: doc.data().manufacturerVerified === true,
                        ...doc.data()
                    });
                });

                setManufacturers(allManufacturers);
            } catch (error) {
                console.error('Error fetching manufacturer settings:', error);
                setMessage({ type: 'error', text: 'Failed to load manufacturer settings.' });
            } finally {
                setLoadingManufacturers(false);
            }
        };

        fetchManufacturerSettings();
    }, [userId, hasRole, activeTab, db]);

    // Fetch designer's sales history
    const fetchSalesHistory = useCallback(async () => {
        if (!userId || !hasRole('designer')) return;

        setLoadingSales(true);
        setMessage({ type: '', text: '' });

        try {
            // First get all products by this designer
            const productsRef = collection(db, 'products');
            const designerProductsQuery = query(productsRef, where('designerId', '==', userId));
            const productSnapshot = await getDocs(designerProductsQuery);

            if (productSnapshot.empty) {
                console.log('No products found for this designer');
                setDesignerSales([]);
                setLoadingSales(false);
                return;
            }

            // Get all product IDs
            const productIds = productSnapshot.docs.map(doc => doc.id);

            // Find all orders that contain these products
            const ordersRef = collection(db, 'orders');
            const orderSnapshot = await getDocs(ordersRef);

            // Filter orders that contain this designer's products
            const designerSales = [];

            orderSnapshot.forEach(orderDoc => {
                const orderData = orderDoc.data();

                // Skip if order has no items or is not completed/delivered
                if (!orderData.items || !Array.isArray(orderData.items) ||
                    (orderData.status !== 'completed' && orderData.status !== 'delivered')) return;

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

                    // Calculate sales amount for this designer's items
                    const designerRevenue = designerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                    // Add sales entry
                    designerSales.push({
                        id: orderDoc.id,
                        orderId: orderDoc.id,
                        orderNumber: orderDoc.id.slice(-6), // Last 6 chars of order ID for display
                        customerName: orderData.shippingInfo?.fullName || 'Unknown',
                        customerEmail: orderData.shippingInfo?.email || 'No email',
                        items: designerItems,
                        quantity: designerItems.reduce((sum, item) => sum + item.quantity, 0),
                        revenue: designerRevenue,
                        date: createdAtDate,
                        deliveredDate: deliveredAtDate,
                        status: orderData.status,
                        shippingInfo: orderData.shippingInfo || {},
                        paymentInfo: {
                            method: orderData.paymentMethod || 'N/A',
                            total: designerRevenue
                        }
                    });
                }
            });

            // Sort sales by date (newest first)
            designerSales.sort((a, b) => b.date - a.date);

            console.log('Designer sales history loaded:', designerSales.length);
            setDesignerSales(designerSales);

        } catch (error) {
            console.error('Error fetching sales history:', error);
            setMessage({ type: 'error', text: 'Failed to load sales history.' });
        } finally {
            setLoadingSales(false);
        }
    }, [userId, hasRole]);

    // Fetch sales history when sales tab is activated
    useEffect(() => {
        if (activeTab === 'sales' && hasRole('designer')) {
            fetchSalesHistory();
        }
    }, [activeTab, hasRole, fetchSalesHistory]);

    // Calculate filtered sales based on search and filter settings
    const filteredSales = useMemo(() => {
        if (!designerSales || designerSales.length === 0) return [];

        return designerSales.filter(sale => {
            // Filter by search term
            const searchMatch = salesSearchTerm === '' ||
                sale.orderNumber.toLowerCase().includes(salesSearchTerm.toLowerCase()) ||
                sale.customerName.toLowerCase().includes(salesSearchTerm.toLowerCase());

            // Filter by status
            const statusMatch = salesFilter === 'all' ||
                (salesFilter === 'completed' && (sale.status === 'completed' || sale.status === 'delivered')) ||
                (salesFilter === 'cancelled' && (sale.status === 'cancelled' || sale.refundStatus === 'refunded'));

            // Filter by time period
            let timeMatch = true;
            const saleDate = new Date(sale.date);
            const now = new Date();

            if (salesTimeFrame === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(now.getDate() - 7);
                timeMatch = saleDate >= weekAgo;
            } else if (salesTimeFrame === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(now.getMonth() - 1);
                timeMatch = saleDate >= monthAgo;
            } else if (salesTimeFrame === 'year') {
                const yearAgo = new Date();
                yearAgo.setFullYear(now.getFullYear() - 1);
                timeMatch = saleDate >= yearAgo;
            }

            return searchMatch && statusMatch && timeMatch;
        });
    }, [designerSales, salesSearchTerm, salesFilter, salesTimeFrame]);

    // Function to handle exporting sales report
    const handleExportSalesReport = () => {
        if (filteredSales.length === 0) {
            setMessage({ type: 'error', text: 'No sales data to export' });
            return;
        }

        try {
            // Format sales data for export
            const csvData = filteredSales.map(sale => ({
                'Order #': sale.orderNumber,
                'Date': formatDate(sale.date),
                'Customer Name': sale.customerName,
                'Customer Email': sale.customerEmail,
                'Items': sale.items.map(item => `${item.name} (×${item.quantity})`).join(', '),
                'Quantity': sale.quantity,
                'Revenue': formatPrice(sale.revenue).replace('$', ''),
                'Status': sale.status,
            }));

            // Convert to CSV
            const replacer = (key, value) => value === null ? '' : value;
            const header = Object.keys(csvData[0]);
            let csv = csvData.map(row => header.map(fieldName =>
                JSON.stringify(row[fieldName], replacer)).join(','));
            csv.unshift(header.join(','));
            csv = csv.join('\r\n');

            // Create and download file
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setMessage({ type: 'success', text: 'Sales report exported successfully' });
        } catch (error) {
            console.error('Error exporting sales report:', error);
            setMessage({ type: 'error', text: 'Failed to export sales report' });
        }
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    const handleProductClick = (productId) => {
        navigate(`/product/${productId}`);
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
        if (!requestedRole || processingRoleRequest) return;

        setProcessingRoleRequest(true);
        setMessage({ type: '', text: '' });

        try {
            // Get current roles
            const currentRoles = Array.isArray(userRole) ? userRole : [userRole];

            // Check if user already has the requested role
            if (currentRoles.includes(requestedRole)) {
                setMessage({ type: 'warning', text: `You already have the ${requestedRole} role.` });
                setProcessingRoleRequest(false);
                return;
            }

            // Add the role to the user
            const success = await addUserRole(requestedRole);

            if (success) {
                setMessage({ type: 'success', text: `Successfully added ${requestedRole} role to your account!` });
                setRequestedRole(''); // Reset the dropdown
            } else {
                setMessage({ type: 'error', text: 'Failed to update your role. Please try again.' });
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
            { id: 'reviews', label: 'Reviews', roles: ['all'] },
            { id: 'collectibles', label: 'Collectibles', roles: ['all'] } // Add Collectibles tab for all users
        ];

        // Designer-specific tabs
        if (hasRole('designer')) {
            tabs.push({ id: 'products', label: 'My Products', roles: ['designer'] });
            tabs.push({ id: 'sales', label: 'My Sales', roles: ['designer'] });
            tabs.push({ id: 'manufacturer-settings', label: 'Manufacturer Settings', roles: ['designer'] });
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

    // Handle navigation to edit product page
    const handleEditProduct = (productId) => {
        navigate(`/product-edit/${productId}`);
    };

    const handleSaveManufacturerSettings = async () => {
        if (!userId || !hasRole('designer')) {
            setMessage({ type: 'error', text: 'You need to have designer role to save manufacturer settings.' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Reference to the designer settings document
            const settingsRef = doc(db, 'designerSettings', userId);

            // Prepare the data to save
            const manufacturerData = {
                manufacturerSettings: manufacturerSettings, // Product ID to manufacturer ID mapping
                autoTransferFunds: autoTransferFunds, // Flag to auto-transfer funds when products are fully funded
                updatedAt: serverTimestamp()
            };

            // Check if document exists
            const docSnap = await getDoc(settingsRef);
            if (docSnap.exists()) {
                await updateDoc(settingsRef, manufacturerData);
            } else {
                // Add createdAt for new documents
                await setDoc(settingsRef, {
                    ...manufacturerData,
                    createdAt: serverTimestamp()
                });
            }            // If auto-transfer is enabled, check if any products are already fully funded
            if (autoTransferFunds) {
                console.log("Auto-transfer funds is enabled, checking for fully funded products...");
                const fullyFundedProducts = designerProducts.filter(
                    product => product.currentFunding >= product.fundingGoal &&
                        manufacturerSettings[product.id] &&
                        !product.manufacturerId &&
                        !product.fundsSentToManufacturer
                );

                console.log(`Found ${fullyFundedProducts.length} fully funded products ready for auto-transfer`);

                if (fullyFundedProducts.length > 0) {
                    // Transfer funds for fully funded products with selected manufacturers
                    const walletService = await import('../services/walletService').then(module => module.default);

                    for (const product of fullyFundedProducts) {
                        const manufacturerId = manufacturerSettings[product.id];
                        const manufacturer = manufacturers.find(m => m.id === manufacturerId);

                        if (manufacturer) {
                            console.log(`Auto-transferring funds for product ${product.id} to manufacturer ${manufacturer.email}`);
                            const result = await walletService.transferProductFundsToManufacturer(
                                userId,
                                product.id,
                                manufacturer.email,
                                "Auto-transferred funds for fully funded product"
                            );

                            console.log("Auto-transfer result:", result);
                        } else {
                            console.error(`Manufacturer not found for product ${product.id}`);
                        }
                    }

                    // Refresh products list after transfers
                    if (designerProducts.length > 0) {
                        console.log("Refreshing designer products after fund transfers");
                        fetchDesignerProducts();
                    }
                }
            } else {
                console.log("Auto-transfer funds is disabled");
            }

            setMessage({
                type: 'success',
                text: 'Manufacturer settings saved successfully!'
            });
        } catch (error) {
            console.error('Error saving manufacturer settings:', error);
            setMessage({
                type: 'error',
                text: 'Failed to save manufacturer settings. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle data export
    const handleDataExport = async () => {
        if (!currentUser || !currentUser.uid) {
            setMessage({ type: 'error', text: 'You must be logged in to export your data' });
            return;
        }

        setDataExportLoading(true);
        setMessage({ type: '', text: '' });

        try {
            let result;

            if (exportFormat === 'json') {
                result = await userDataExportService.exportDataAsJsonFile(currentUser.uid, exportOptions);
            } else if (exportFormat === 'csv') {
                result = await userDataExportService.exportDataAsCsvFiles(currentUser.uid, exportOptions);
            } else {
                throw new Error('Unsupported export format');
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to export data');
            }

            // Create download link
            const url = URL.createObjectURL(result.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            setMessage({ type: 'success', text: 'Data exported successfully. Your download should begin shortly.' });
        } catch (error) {
            console.error('Error exporting data:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to export data. Please try again.' });
        } finally {
            setDataExportLoading(false);
        }
    };

    // Toggle export option
    const toggleExportOption = (option) => {
        setExportOptions(prev => ({
            ...prev,
            [option]: !prev[option]
        }));
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
            )}            {showHeaderCropper && (
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

                        <div className="profile-action-buttons">
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
                    </div>                    <div className="profile-right">
                        <div className="profile-tabs">
                            {getTabs().map(tab => (
                                <div
                                    key={tab.id}
                                    className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => {
                                        console.log('Changing tab to:', tab.id);
                                        setActiveTab(tab.id);
                                    }}
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
                            )}                            {activeTab === 'personal' && (
                                <PersonalInfoTab userId={userId} isOwnProfile={isOwnProfile} />
                            )}

                            {activeTab === 'account' && (
                                <AccountSettingsTab />
                            )}

                            {activeTab === 'preferences' && (
                                <PreferencesTab />
                            )}

                            {activeTab === 'blocked' && isOwnProfile && (
                                <div className="settings-section blocked-users-settings-section">
                                    <h3>Blocked Users</h3>
                                    <p>Manage users you've blocked and content blocking settings</p>

                                    <BlockedUsersSection />
                                </div>
                            )}

                            {activeTab === 'privacy' && isOwnProfile && (
                                <PrivacySettingsTab />
                            )}

                            {activeTab === 'products' && (
                                <MyProductsTab />
                            )}

                            {activeTab === 'investments' && hasRole('investor') && (
                                <MyInvestmentsTab />
                            )}

                            {activeTab === 'customer-orders' && (
                                <CustomerOrdersTab />
                            )}

                            {activeTab === 'sales' && (
                                <MySalesTab />
                            )}

                            {activeTab === 'shipping' && hasRole('designer') && (
                                <ShippingSettingsTab />
                            )}

                            {activeTab === 'reviews' && (
                                <div className="settings-section reviews-section">
                                    <h3>User Reviews</h3>
                                    <p>See what others have to say about {isOwnProfile ? 'you' : userProfile?.displayName || 'this user'}.</p>

                                    <UserReviewSection userId={userId} userProfile={userProfile} />
                                </div>
                            )}

                            {activeTab === 'collectibles' && (
                                <CollectiblesTab />
                            )}

                            {activeTab === 'manufacturer-settings' && hasRole('designer') && (
                                <ManufacturerSettingsTab />
                            )}

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
