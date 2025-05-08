import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, deleteDoc, serverTimestamp, getDoc, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import walletService from '../services/walletService';
import notificationService from '../services/notificationService';
import cartRecoveryService from '../services/cartRecoveryService';
import { sanitizeString, sanitizeFormData } from '../utils/sanitizer';
import taxRates from '../config/taxRates';
import '../styles/CheckoutPage.css';

// CrossSellingSuggestions Component
const CrossSellingSuggestions = ({ cartItems }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showError } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!cartItems || cartItems.length === 0) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Get categories from current cart items
                const cartProductIds = cartItems.map(item => item.id);
                const productRefs = cartProductIds.map(id => doc(db, 'products', id));

                // Fetch product details for cart items
                const productData = [];
                for (const productRef of productRefs) {
                    const productDoc = await getDoc(productRef);
                    if (productDoc.exists()) {
                        productData.push(productDoc.data());
                    }
                }

                // Extract categories from products
                const categories = new Set();
                productData.forEach(product => {
                    if (product.categories && Array.isArray(product.categories)) {
                        product.categories.forEach(category => categories.add(category));
                    } else if (product.category) {
                        categories.add(product.category);
                    }
                });

                // Extract designer IDs from products
                const designers = new Set();
                productData.forEach(product => {
                    if (product.designerId) {
                        designers.add(product.designerId);
                    }
                });

                // If no categories found, return
                if (categories.size === 0 && designers.size === 0) {
                    setLoading(false);
                    return;
                }

                // Find related products based on categories or designers
                const productsRef = collection(db, 'products');
                let suggestionsQuery;

                if (categories.size > 0) {
                    // Get products in similar categories
                    const categoriesArray = Array.from(categories);
                    suggestionsQuery = query(
                        productsRef,
                        where('status', '==', 'active'),
                        where('categories', 'array-contains-any', categoriesArray),
                        limit(8)
                    );
                } else {
                    // Fallback to designer's other products
                    const designersArray = Array.from(designers);
                    suggestionsQuery = query(
                        productsRef,
                        where('status', '==', 'active'),
                        where('designerId', 'in', designersArray),
                        limit(8)
                    );
                }

                const suggestionsSnapshot = await getDocs(suggestionsQuery);

                // Filter out products that are already in the cart
                const suggestedProducts = suggestionsSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .filter(product => !cartProductIds.includes(product.id));

                // Get only the first 4 products
                setSuggestions(suggestedProducts.slice(0, 4));

            } catch (error) {
                console.error('Error fetching product suggestions:', error);
                showError('Error loading product suggestions');
            } finally {
                setLoading(false);
            }
        };

        fetchSuggestions();
    }, [cartItems, showError]);

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price || 0);
    };

    // Handle click on a suggestion
    const handleSuggestionClick = (productId) => {
        navigate(`/product/${productId}`);
    };

    // Don't show component if no suggestions or still loading
    if (loading || suggestions.length === 0) {
        return null;
    }

    return (
        <div className="cross-selling-suggestions">
            <h3>You might also like</h3>
            <div className="suggestions-container">
                {suggestions.map(product => (
                    <div key={product.id} className="suggestion-item">
                        <Link to={`/product/${product.id}`}>
                            <div className="suggestion-image">
                                <img
                                    src={product.imageUrl || (product.imageUrls && product.imageUrls[0]) || 'https://via.placeholder.com/160?text=Product'}
                                    alt={product.name}
                                />
                            </div>
                            <div className="suggestion-details">
                                <h4>{product.name || 'Product'}</h4>
                                <div className="suggestion-price">
                                    {formatPrice(product.price)}
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CheckoutPage = () => {
    const { currentUser, userProfile, userWallet } = useUser();
    const { success, error: showError } = useToast();
    const navigate = useNavigate();

    const [cartItems, setCartItems] = useState([]);
    const [cartId, setCartId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [subtotal, setSubtotal] = useState(0);
    const [shipping, setShipping] = useState(10);
    const [tax, setTax] = useState(0);
    const [total, setTotal] = useState(0);
    const [step, setStep] = useState(1);
    const [orderComplete, setOrderComplete] = useState(false);
    const [orderId, setOrderId] = useState('');
    const [paymentSettings, setPaymentSettings] = useState({
        useWalletPayment: true, // Default to wallet payment
        allowCreditCardPayment: false // Will be set based on admin settings
    });
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');
    const [insufficientFunds, setInsufficientFunds] = useState(false);

    const [formData, setFormData] = useState({
        // Shipping info
        fullName: userProfile?.displayName || '',
        email: currentUser?.email || '',
        phone: userProfile?.phone || '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',

        // Payment info
        cardName: '',
        cardNumber: '',
        expMonth: '',
        expYear: '',
        cvv: '',

        // Order notes
        notes: '',

        // Shipping method
        shippingMethod: 'standard'
    });

    // Calculate tax based on country and state/province
    const calculateTax = (subtotal, country, state) => {
        let taxRate = 0;

        // Get country tax rates
        const countryRates = taxRates[country];

        if (countryRates) {
            // Check if there's a specific rate for the state/province
            if (state && countryRates[state]) {
                taxRate = countryRates[state];
            } else {
                // Use default rate for the country
                taxRate = countryRates.default || 0;
            }
        }

        // Calculate tax amount (taxRate is in percentage)
        const taxAmount = (subtotal * taxRate) / 100;

        // Round to 2 decimal places
        return Math.round(taxAmount * 100) / 100;
    };

    // Fetch payment settings
    useEffect(() => {
        const fetchPaymentSettings = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'paymentSettings');
                const settingsDoc = await getDoc(settingsRef);

                if (settingsDoc.exists()) {
                    const settings = settingsDoc.data();
                    setPaymentSettings({
                        useWalletPayment: settings.useWalletPayment ?? true,
                        allowCreditCardPayment: settings.allowCreditCardPayment ?? false
                    });

                    // Set default payment method based on settings and wallet balance
                    if (settings.useWalletPayment) {
                        setSelectedPaymentMethod('wallet');
                    } else {
                        setSelectedPaymentMethod('creditCard');
                    }
                }
            } catch (error) {
                console.error("Error fetching payment settings:", error);
                // Default to wallet payment if there's an error
                setPaymentSettings({
                    useWalletPayment: true,
                    allowCreditCardPayment: false
                });
            }
        };

        fetchPaymentSettings();
    }, []);

    // Check wallet balance against order total
    useEffect(() => {
        if (userWallet && total > 0) {
            setInsufficientFunds(userWallet.balance < total);

            // If wallet has insufficient funds and credit card is allowed, switch to credit card
            if (userWallet.balance < total && paymentSettings.allowCreditCardPayment) {
                setSelectedPaymentMethod('creditCard');
            }
        }
    }, [userWallet, total, paymentSettings.allowCreditCardPayment]);

    // Add a list of countries that require state/province
    useEffect(() => {
        // Update form validation based on selected country
        const countriesWithStates = ['United States', 'Canada', 'Australia', 'Mexico', 'Brazil', 'India'];
        const stateRequired = countriesWithStates.includes(formData.country);

        // Set a placeholder text based on country selected
        let statePlaceholder = "State";
        if (formData.country === 'Canada') statePlaceholder = "Province";
        else if (formData.country === 'United Kingdom') statePlaceholder = "County";
        else if (formData.country === 'Australia') statePlaceholder = "State/Territory";

        // Update the placeholder
        const stateInput = document.getElementById('state');
        if (stateInput) stateInput.placeholder = statePlaceholder;
    }, [formData.country]);

    // Update tax when country or state changes
    useEffect(() => {
        // Only recalculate if we have a subtotal (means cart is loaded)
        if (subtotal > 0) {
            const taxAmount = calculateTax(subtotal, formData.country, formData.state);
            setTax(taxAmount);
            setTotal(subtotal + shipping + taxAmount);
        }
    }, [formData.country, formData.state, subtotal]);

    // Calculate subtotal and total
    const calculateTotals = (items) => {
        const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setSubtotal(itemsTotal);

        // Calculate tax based on shipping location
        const taxAmount = calculateTax(itemsTotal, formData.country, formData.state);
        setTax(taxAmount);

        // Calculate total (subtotal + shipping + tax)
        setTotal(itemsTotal + shipping + taxAmount);
    };

    // Fetch shipping costs from designer settings
    const fetchShippingCosts = async (cartItems) => {
        try {
            // Group cart items by designer ID for faster processing
            const designerItems = {};

            // Track whether any item has free shipping
            let hasFreeShippingItem = false;

            // Track the lowest free shipping threshold
            let lowestFreeShippingThreshold = Infinity;

            // Default shipping costs
            let standardCost = 10;
            let expressCost = 25;

            // Process each item in the cart
            for (const item of cartItems) {
                try {
                    // Get the product details
                    const productRef = doc(db, 'products', item.id);
                    const productDoc = await getDoc(productRef);

                    if (productDoc.exists()) {
                        const productData = productDoc.data();
                        const designerId = productData.designerId;

                        // Check if product has custom shipping settings
                        if (productData.customShipping) {
                            // Check if product has free shipping
                            if (productData.freeShipping) {
                                hasFreeShippingItem = true;
                            }

                            // Update lowest free shipping threshold if product has one
                            if (!productData.freeShipping && productData.freeShippingThreshold &&
                                productData.freeShippingThreshold < lowestFreeShippingThreshold) {
                                lowestFreeShippingThreshold = productData.freeShippingThreshold;
                            }

                            // Track product's shipping costs
                            if (productData.standardShippingCost !== undefined) {
                                // Use the highest shipping cost among all products
                                standardCost = Math.max(standardCost, productData.standardShippingCost);
                            }

                            if (productData.expressShippingCost !== undefined) {
                                // Use the highest shipping cost among all products
                                expressCost = Math.max(expressCost, productData.expressShippingCost);
                            }
                        } else if (designerId) {
                            // Check if we already processed this designer
                            if (!designerItems[designerId]) {
                                // Get designer's shipping settings
                                const designerSettingsRef = doc(db, 'designerSettings', designerId);
                                const designerDoc = await getDoc(designerSettingsRef);

                                if (designerDoc.exists()) {
                                    const designerSettings = designerDoc.data();
                                    designerItems[designerId] = {
                                        standardShippingCost: designerSettings.standardShippingCost !== undefined ? designerSettings.standardShippingCost : 10,
                                        expressShippingCost: designerSettings.expressShippingCost !== undefined ? designerSettings.expressShippingCost : 25,
                                        offerFreeShipping: designerSettings.offerFreeShipping || false,
                                        freeShippingThreshold: designerSettings.freeShippingThreshold || 50
                                    };

                                    // Update shipping costs with designer settings
                                    standardCost = Math.max(standardCost, designerItems[designerId].standardShippingCost);
                                    expressCost = Math.max(expressCost, designerItems[designerId].expressShippingCost);

                                    // Update free shipping threshold
                                    if (designerSettings.offerFreeShipping &&
                                        designerSettings.freeShippingThreshold < lowestFreeShippingThreshold) {
                                        lowestFreeShippingThreshold = designerSettings.freeShippingThreshold;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing item ${item.id}:`, error);
                }
            }

            return {
                standardShippingCost: standardCost,
                expressShippingCost: expressCost,
                hasFreeShippingItem,
                freeShippingThreshold: lowestFreeShippingThreshold === Infinity ? 50 : lowestFreeShippingThreshold
            };
        } catch (error) {
            console.error('Error fetching shipping costs:', error);
            // Default values in case of error
            return {
                standardShippingCost: 10,
                expressShippingCost: 25,
                hasFreeShippingItem: false,
                freeShippingThreshold: 50
            };
        }
    };

    // Fetch cart items
    useEffect(() => {
        let unsubscribe = () => { };

        const fetchCart = async () => {
            setLoading(true);
            try {
                // Handle guest users with local storage
                if (!currentUser) {
                    const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
                    setCartItems(localCart);
                    calculateTotals(localCart);

                    // Fetch shipping costs for the cart
                    const shippingInfo = await fetchShippingCosts(localCart);

                    // Update shipping costs and method
                    const currentMethod = formData.shippingMethod;
                    const shippingCost = currentMethod === 'express' ?
                        shippingInfo.expressShippingCost :
                        shippingInfo.standardShippingCost;

                    // Check if order total qualifies for free shipping
                    if (shippingInfo.hasFreeShippingItem ||
                        (subtotal >= shippingInfo.freeShippingThreshold && shippingInfo.freeShippingThreshold > 0)) {
                        setShipping(0);
                        setTotal(subtotal);
                    } else {
                        setShipping(shippingCost);
                        setTotal(subtotal + shippingCost);
                    }

                    setLoading(false);
                    return;
                }

                // For authenticated users, get cart from Firestore
                const cartsRef = collection(db, 'carts');
                const q = query(cartsRef, where('userId', '==', currentUser.uid));

                unsubscribe = onSnapshot(q, async (snapshot) => {
                    if (snapshot.empty) {
                        setCartItems([]);
                        calculateTotals([]);
                        setLoading(false);
                        return;
                    }

                    // Get cart data
                    const cartDoc = snapshot.docs[0];
                    setCartId(cartDoc.id);
                    const cart = cartDoc.data();

                    const items = cart.items || [];
                    setCartItems(items);
                    calculateTotals(items);

                    // Fetch shipping costs for the cart
                    const shippingInfo = await fetchShippingCosts(items);

                    // Update shipping costs and method
                    const currentMethod = formData.shippingMethod;
                    const shippingCost = currentMethod === 'express' ?
                        shippingInfo.expressShippingCost :
                        shippingInfo.standardShippingCost;

                    // Check if order total qualifies for free shipping
                    if (shippingInfo.hasFreeShippingItem ||
                        (subtotal >= shippingInfo.freeShippingThreshold && shippingInfo.freeShippingThreshold > 0)) {
                        setShipping(0);
                        setTotal(subtotal);
                    } else {
                        setShipping(shippingCost);
                        setTotal(subtotal + shippingCost);
                    }

                    setLoading(false);
                }, (err) => {
                    console.error("Error fetching cart:", err);
                    setError("Could not load your cart. Please try again.");
                    setLoading(false);
                });

            } catch (err) {
                console.error("Error setting up cart listener:", err);
                setError("Could not access your cart. Please try again later.");
                setLoading(false);
            }
        };

        fetchCart();

        // Clean up subscription
        return () => unsubscribe();
    }, [currentUser, formData.shippingMethod]);

    // Update form data
    const handleChange = async (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: sanitizeString(value) }));

        // Update shipping cost based on method
        if (name === 'shippingMethod') {
            try {
                const shippingInfo = await fetchShippingCosts(cartItems);
                const shippingCost = value === 'express' ?
                    shippingInfo.expressShippingCost :
                    shippingInfo.standardShippingCost;

                // Check if order qualifies for free shipping
                if (shippingInfo.hasFreeShippingItem ||
                    (subtotal >= shippingInfo.freeShippingThreshold && shippingInfo.freeShippingThreshold > 0)) {
                    setShipping(0);
                    setTotal(subtotal);
                } else {
                    setShippingCost(shippingCost);
                    setTotal(subtotal + shippingCost);
                }
            } catch (error) {
                console.error('Error updating shipping cost:', error);
                // Fallback to default shipping costs
                const shippingCost = value === 'express' ? 25 : 10;
                setShipping(shippingCost);
                setTotal(subtotal + shippingCost);
            }
        }
    };

    // Handle form submission for shipping info
    const handleShippingSubmit = (e) => {
        e.preventDefault();
        // Validate shipping information - state is only required for certain countries
        const countriesWithStates = ['United States', 'Canada', 'Australia', 'Mexico', 'Brazil', 'India'];
        const stateRequired = countriesWithStates.includes(formData.country);

        if (!formData.fullName || !formData.email || !formData.phone ||
            !formData.address || !formData.city || !formData.zipCode ||
            (stateRequired && !formData.state)) {
            setError("Please fill in all required shipping fields");
            return;
        }

        setStep(2);
        setError(null);
    };

    // Handle payment method change
    const handlePaymentMethodChange = (method) => {
        setSelectedPaymentMethod(method);
    };

    // Handle payment form submission
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();

        // Validate payment information based on selected method
        if (selectedPaymentMethod === 'creditCard') {
            if (!formData.cardName || !formData.cardNumber || !formData.expMonth ||
                !formData.expYear || !formData.cvv) {
                setError("Please fill in all required payment fields");
                return;
            }

            // Simulate card validation
            if (formData.cardNumber.replace(/\s/g, '').length !== 16) {
                setError("Please enter a valid 16-digit card number");
                return;
            }

            if (formData.cvv.length !== 3) {
                setError("Please enter a valid 3-digit CVV");
                return;
            }
        } else if (selectedPaymentMethod === 'wallet') {
            // Check wallet balance
            if (!userWallet || userWallet.balance < total) {
                setError("Insufficient wallet balance. Please add funds or select another payment method.");
                return;
            }
        }

        setProcessing(true);
        setError(null);

        await createOrder();
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    // Create order in database
    const createOrder = async () => {
        try {
            // Process payment based on selected method
            let paymentStatus = 'pending';
            let paymentMethod = selectedPaymentMethod;
            let paymentTransactionId = null;
            let paymentDetails = null;

            if (selectedPaymentMethod === 'wallet') {
                // Deduct from wallet
                try {
                    const deductResult = await walletService.deductFunds(
                        currentUser.uid,
                        total,
                        `Payment for order - ${cartItems.length} items`
                    );

                    if (deductResult.success) {
                        paymentStatus = 'paid';
                        // Store transaction info for reference
                        paymentTransactionId = deductResult.transactionId;

                        // Add transaction information to the order data
                        paymentDetails = {
                            method: 'wallet',
                            transactionId: deductResult.transactionId,
                            cancellationExpiryTime: deductResult.cancellationExpiryTime,
                            amount: total
                        };
                    } else {
                        setError(deductResult.error || "Wallet payment failed. Please try again.");
                        setProcessing(false);
                        return;
                    }
                } catch (error) {
                    console.error("Wallet payment failed:", error);
                    setError("Wallet payment failed. Please try again or use a different payment method.");
                    setProcessing(false);
                    return;
                }
            } else {
                // Simulate credit card processing
                // In a real app, this would integrate with a payment processor
                paymentStatus = 'paid';
            }

            // Create order in Firestore
            const orderData = {
                userId: currentUser?.uid || 'guest',
                items: cartItems,
                shippingInfo: {
                    fullName: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: formData.country,
                    shippingMethod: formData.shippingMethod
                },
                notes: formData.notes,
                subtotal: subtotal,
                shipping: shipping,
                tax: tax,
                total: total,
                status: 'processing',
                createdAt: serverTimestamp(),
                paymentMethod: paymentMethod,
                paymentStatus: paymentStatus,
                paymentTransactionId: paymentTransactionId,
                paymentDetails: paymentDetails,
                estimatedDelivery: calculateEstimatedDelivery(formData.shippingMethod)
            };

            const orderRef = await addDoc(collection(db, 'orders'), orderData);
            setOrderId(orderRef.id);

            // Mark cart as recovered for analytics purposes
            if (currentUser && cartId) {
                try {
                    await cartRecoveryService.markCartAsRecovered(cartId);
                    console.log('Cart marked as recovered for tracking abandoned cart recovery metrics');
                } catch (err) {
                    // Don't block the order process if this fails
                    console.error('Error marking cart as recovered:', err);
                }
            }

            // Process sales - including designer payments, business commissions, and investor revenue
            for (const item of cartItems) {
                try {
                    // Fetch the product to get the manufacturing cost
                    const productRef = doc(db, 'products', item.id);
                    const productDoc = await getDoc(productRef);

                    if (productDoc.exists()) {
                        const productData = productDoc.data();
                        // Calculate sale amount
                        const manufacturingCost = productData.manufacturingCost || 0;
                        const saleAmount = item.price * item.quantity;

                        // Use the comprehensive method that handles business commission, 
                        // investor revenue, AND designer payments in one call
                        const saleResult = await walletService.processProductSale(
                            item.id,
                            item.name || productData.name,
                            saleAmount,
                            manufacturingCost,
                            item.quantity,
                            orderRef.id,
                            formData.shippingMethod === 'express' ? 25 : 10 // Pass shipping cost based on selected method
                        );

                        if (saleResult.success) {
                            console.log('Product sale processed successfully:', saleResult);
                        } else {
                            console.error('Error processing product sale:', saleResult.error);
                        }
                    }
                } catch (err) {
                    console.error(`Error processing revenue for product ${item.id}:`, err);
                    // Continue with order processing even if revenue processing fails
                }
            }

            // Create notification for order confirmation for the buyer
            if (currentUser) {
                await addDoc(collection(db, 'notifications'), {
                    userId: currentUser.uid,
                    title: 'Order Confirmed',
                    message: `Your order #${orderRef.id.slice(-6)} has been placed successfully.`,
                    type: 'order_status',
                    orderId: orderRef.id,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            // Notify designers about their products being ordered
            // Group products by designer for notification
            const designerProducts = {};
            for (const item of cartItems) {
                try {
                    // Fetch the product to get the designer info
                    const productRef = doc(db, 'products', item.id);
                    const productDoc = await getDoc(productRef);

                    if (productDoc.exists()) {
                        const productData = productDoc.data();
                        const designerId = productData.designerId;

                        // Only notify if there's a designer ID
                        if (designerId) {
                            if (!designerProducts[designerId]) {
                                designerProducts[designerId] = [];
                            }

                            designerProducts[designerId].push({
                                id: item.id,
                                name: item.name || productData.name,
                                quantity: item.quantity
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching product ${item.id}:`, err);
                }
            }

            // Send notifications to each designer
            for (const designerId in designerProducts) {
                for (const product of designerProducts[designerId]) {
                    try {
                        await notificationService.sendOrderNotification(
                            designerId,
                            product.id,
                            product.name,
                            orderRef.id
                        );
                        console.log(`Successfully sent order notification to designer ${designerId} for product ${product.name}`);
                    } catch (err) {
                        console.error(`Error sending notification to designer ${designerId} for product ${product.id}:`, err);
                        // Continue with order processing even if notification fails
                    }
                }
            }

            // Clear cart after successful order
            if (currentUser && cartId) {
                // For authenticated users, clear Firestore cart
                await updateDoc(doc(db, 'carts', cartId), {
                    items: [],
                    updatedAt: serverTimestamp()
                });
            } else {
                // For guest users, clear localStorage
                localStorage.removeItem('cart');
            }

            // Show detailed success message
            const itemCount = cartItems.length;
            const itemText = itemCount === 1 ? 'item' : 'items';
            const orderNumber = orderRef.id.slice(-6);
            success(`Order #${orderNumber} with ${itemCount} ${itemText} has been successfully placed! Total: ${formatPrice(total)}`);

            // Simulate payment processing
            setTimeout(() => {
                setProcessing(false);
                setOrderComplete(true);
            }, 2000);

        } catch (err) {
            console.error("Error processing order:", err);
            setError("We couldn't process your order. Please try again.");
            setProcessing(false);
            showError("Order processing failed. Please try again.");
        }
    };

    // Calculate estimated delivery date based on shipping method
    const calculateEstimatedDelivery = (method) => {
        const today = new Date();
        const deliveryDays = method === 'express' ? 3 : 7;

        // Add delivery days to current date
        const deliveryDate = new Date(today);
        deliveryDate.setDate(today.getDate() + deliveryDays);

        return deliveryDate;
    };

    // Format date for display
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    // Render loading state
    if (loading) {
        return (
            <div className="checkout-page">
                <div className="checkout-container loading">
                    <LoadingSpinner />
                    <p className="loading-text">Loading checkout...</p>
                </div>
            </div>
        );
    }

    // Render error state if no items in cart
    if (cartItems.length === 0 && !orderComplete) {
        return (
            <div className="checkout-page">
                <div className="checkout-container">
                    <h1>Checkout</h1>
                    <div className="empty-checkout">
                        <div className="empty-checkout-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                        </div>
                        <p>Your cart is empty</p>
                        <p>You need to add items to your cart before checkout.</p>
                        <Link to="/shop" className="btn-secondary">Browse Products</Link>
                    </div>
                </div>
            </div>
        );
    }

    // Render order confirmation
    if (orderComplete) {
        return (
            <div className="checkout-page">
                <div className="checkout-container">
                    <div className="order-complete">
                        <div className="success-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                        <h1>Order Confirmed!</h1>
                        <p className="order-id">Order #{orderId.slice(-6)}</p>
                        <p className="thankyou-message">
                            Thank you for your order. We've received your payment and will process your items shortly.
                        </p>
                        <p className="delivery-estimate">
                            Estimated delivery: <strong>{formatDate(calculateEstimatedDelivery(formData.shippingMethod))}</strong>
                        </p>
                        <p className="confirmation-email">
                            A confirmation email has been sent to <strong>{formData.email}</strong>
                        </p>
                        <div className="order-next-steps">
                            <Link to="/orders" className="btn-primary">View My Orders</Link>
                            <Link to="/shop" className="btn-secondary">Continue Shopping</Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <div className="checkout-container">
                <h1>Checkout</h1>

                <div className="checkout-progress">
                    <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <div className="step-label">Shipping</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <div className="step-label">Payment</div>
                    </div>
                    <div className="progress-line"></div>
                    <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <div className="step-label">Confirmation</div>
                    </div>
                </div>

                {error && (
                    <div className="checkout-error">
                        <p>{error}</p>
                    </div>
                )}

                <div className="checkout-content">
                    {/* Step 1: Shipping Information */}
                    {step === 1 && (
                        <div className="checkout-form">
                            <h2>Shipping Information</h2>
                            <form onSubmit={handleShippingSubmit}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="fullName">Full Name*</label>
                                        <input
                                            type="text"
                                            id="fullName"
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="email">Email*</label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="phone">Phone*</label>
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

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="address">Street Address*</label>
                                        <input
                                            type="text"
                                            id="address"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="city">City*</label>
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
                                        <label htmlFor="state">
                                            {['United States', 'Canada', 'Australia', 'Mexico', 'Brazil', 'India'].includes(formData.country)
                                                ? `${formData.country === 'Canada' ? 'Province' : formData.country === 'United Kingdom' ? 'County' : formData.country === 'Australia' ? 'State/Territory' : 'State'}*`
                                                : `${formData.country === 'United Kingdom' ? 'County' : 'State/Province'} (Optional)`}
                                        </label>
                                        <input
                                            type="text"
                                            id="state"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            required={['United States', 'Canada', 'Australia', 'Mexico', 'Brazil', 'India'].includes(formData.country)}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="zipCode">ZIP Code*</label>
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
                                        <label htmlFor="country">Country*</label>
                                        <select
                                            id="country"
                                            name="country"
                                            value={formData.country}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="United States">United States</option>
                                            <option value="Canada">Canada</option>
                                            <option value="United Kingdom">United Kingdom</option>
                                            <option value="Australia">Australia</option>
                                            <option value="New Zealand">New Zealand</option>
                                            <option value="Germany">Germany</option>
                                            <option value="France">France</option>
                                            <option value="Japan">Japan</option>
                                            <option value="China">China</option>
                                            <option value="India">India</option>
                                            <option value="Brazil">Brazil</option>
                                            <option value="Mexico">Mexico</option>
                                            <option value="Spain">Spain</option>
                                            <option value="Italy">Italy</option>
                                            <option value="Netherlands">Netherlands</option>
                                            <option value="Sweden">Sweden</option>
                                            <option value="Norway">Norway</option>
                                            <option value="Denmark">Denmark</option>
                                            <option value="Finland">Finland</option>
                                            <option value="Singapore">Singapore</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group shipping-methods">
                                        <label>Shipping Method*</label>
                                        <div className="shipping-options">
                                            <div className="shipping-option">
                                                <input
                                                    type="radio"
                                                    id="standard"
                                                    name="shippingMethod"
                                                    value="standard"
                                                    checked={formData.shippingMethod === 'standard'}
                                                    onChange={handleChange}
                                                />
                                                <label htmlFor="standard">
                                                    <div className="option-name">Standard Shipping</div>
                                                    <div className="option-price">
                                                        {shipping === 0 && (
                                                            <span className="free-shipping">FREE</span>
                                                        )}
                                                        {shipping !== 0 && formData.shippingMethod === 'standard' && (
                                                            <span>${shipping.toFixed(2)}</span>
                                                        )}
                                                        {shipping !== 0 && formData.shippingMethod !== 'standard' && (
                                                            <span>$10.00</span>
                                                        )}
                                                    </div>
                                                    <div className="option-duration">5-7 business days</div>
                                                </label>
                                            </div>
                                            <div className="shipping-option">
                                                <input
                                                    type="radio"
                                                    id="express"
                                                    name="shippingMethod"
                                                    value="express"
                                                    checked={formData.shippingMethod === 'express'}
                                                    onChange={handleChange}
                                                />
                                                <label htmlFor="express">
                                                    <div className="option-name">Express Shipping</div>
                                                    <div className="option-price">
                                                        {shipping === 0 && (
                                                            <span className="free-shipping">FREE</span>
                                                        )}
                                                        {shipping !== 0 && formData.shippingMethod === 'express' && (
                                                            <span>${shipping.toFixed(2)}</span>
                                                        )}
                                                        {shipping !== 0 && formData.shippingMethod !== 'express' && (
                                                            <span>$25.00</span>
                                                        )}
                                                    </div>
                                                    <div className="option-duration">2-3 business days</div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="notes">Order Notes (Optional)</label>
                                        <textarea
                                            id="notes"
                                            name="notes"
                                            value={formData.notes}
                                            onChange={handleChange}
                                            placeholder="Special instructions for delivery"
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <Link to="/cart" className="btn-secondary">Back to Cart</Link>
                                    <button type="submit" className="btn-primary">Continue to Payment</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Step 2: Payment Information */}
                    {step === 2 && (
                        <div className="checkout-form">
                            <h2>Payment Information</h2>
                            <form onSubmit={handlePaymentSubmit}>
                                {/* Payment Method Selection */}
                                <div className="payment-methods">
                                    <h3>Select Payment Method</h3>

                                    {paymentSettings.useWalletPayment && (
                                        <div className="payment-method-option">
                                            <input
                                                type="radio"
                                                id="wallet"
                                                name="paymentMethod"
                                                value="wallet"
                                                checked={selectedPaymentMethod === 'wallet'}
                                                onChange={() => handlePaymentMethodChange('wallet')}
                                                disabled={insufficientFunds}
                                            />
                                            <label htmlFor="wallet" className={insufficientFunds ? 'disabled' : ''}>
                                                <div className="method-name">Wallet Balance</div>
                                                <div className="wallet-balance">
                                                    Available: {formatPrice(userWallet?.balance || 0)}
                                                    {insufficientFunds && (
                                                        <span className="insufficient-funds">
                                                            Insufficient funds
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    {paymentSettings.allowCreditCardPayment && (
                                        <div className="payment-method-option">
                                            <input
                                                type="radio"
                                                id="creditCard"
                                                name="paymentMethod"
                                                value="creditCard"
                                                checked={selectedPaymentMethod === 'creditCard'}
                                                onChange={() => handlePaymentMethodChange('creditCard')}
                                            />
                                            <label htmlFor="creditCard">
                                                <div className="method-name">Credit Card</div>
                                                <div className="card-icons">
                                                    <span>Visa</span>
                                                    <span>Mastercard</span>
                                                    <span>Amex</span>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Credit Card Fields - Only shown if credit card is selected */}
                                {selectedPaymentMethod === 'creditCard' && (
                                    <div className="credit-card-fields">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="cardName">Name on Card*</label>
                                                <input
                                                    type="text"
                                                    id="cardName"
                                                    name="cardName"
                                                    value={formData.cardName}
                                                    onChange={handleChange}
                                                    required={selectedPaymentMethod === 'creditCard'}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="cardNumber">Card Number*</label>
                                                <input
                                                    type="text"
                                                    id="cardNumber"
                                                    name="cardNumber"
                                                    value={formData.cardNumber}
                                                    onChange={handleChange}
                                                    placeholder="1234 5678 9012 3456"
                                                    required={selectedPaymentMethod === 'creditCard'}
                                                    maxLength="19"
                                                />
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="expMonth">Expiration Month*</label>
                                                <select
                                                    id="expMonth"
                                                    name="expMonth"
                                                    value={formData.expMonth}
                                                    onChange={handleChange}
                                                    required={selectedPaymentMethod === 'creditCard'}
                                                >
                                                    <option value="">Month</option>
                                                    {[...Array(12)].map((_, i) => (
                                                        <option key={i + 1} value={i + 1}>
                                                            {(i + 1).toString().padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label htmlFor="expYear">Expiration Year*</label>
                                                <select
                                                    id="expYear"
                                                    name="expYear"
                                                    value={formData.expYear}
                                                    onChange={handleChange}
                                                    required={selectedPaymentMethod === 'creditCard'}
                                                >
                                                    <option value="">Year</option>
                                                    {[...Array(10)].map((_, i) => {
                                                        const year = new Date().getFullYear() + i;
                                                        return (
                                                            <option key={year} value={year}>
                                                                {year}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                            <div className="form-group cvv-group">
                                                <label htmlFor="cvv">CVV*</label>
                                                <input
                                                    type="text"
                                                    id="cvv"
                                                    name="cvv"
                                                    value={formData.cvv}
                                                    onChange={handleChange}
                                                    required={selectedPaymentMethod === 'creditCard'}
                                                    maxLength="3"
                                                    placeholder="123"
                                                />
                                            </div>
                                        </div>

                                        <div className="payment-secure-note">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                            </svg>
                                            <span>Your payment information is encrypted and secure.</span>
                                        </div>

                                        <div className="billing-address-note">
                                            <label>
                                                <input type="checkbox" checked disabled />
                                                Billing address same as shipping
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Wallet Payment Info - Only shown if wallet is selected */}
                                {selectedPaymentMethod === 'wallet' && (
                                    <div className="wallet-payment-summary">
                                        <div className="wallet-balance-details">
                                            <div className="balance-row">
                                                <span>Current Balance:</span>
                                                <span className="balance-amount">{formatPrice(userWallet?.balance || 0)}</span>
                                            </div>
                                            <div className="balance-row">
                                                <span>Order Total:</span>
                                                <span className="order-total">{formatPrice(total)}</span>
                                            </div>
                                            <div className="balance-row remaining-balance">
                                                <span>Remaining Balance:</span>
                                                <span className="remaining-amount">
                                                    {formatPrice((userWallet?.balance || 0) - total)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="wallet-payment-note">
                                            <p>Your order will be paid using your wallet balance.</p>
                                            <p>You can add funds to your wallet on the <Link to="/wallet">wallet page</Link>.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setStep(1)}
                                        disabled={processing}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={processing || (selectedPaymentMethod === 'wallet' && insufficientFunds)}
                                    >
                                        {processing ? (
                                            <>
                                                <span className="btn-spinner"></span>
                                                Processing...
                                            </>
                                        ) : (
                                            `Place Order • ${formatPrice(total)}`
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Order Summary */}
                    <div className="order-summary">
                        <h2>Order Summary</h2>
                        <div className="summary-items">
                            {cartItems.map(item => (
                                <div key={item.id} className="summary-item">
                                    <div className="item-image">
                                        <img
                                            src={item.imageUrl || 'https://via.placeholder.com/60?text=Product'}
                                            alt={item.name}
                                        />
                                        <span className="item-quantity">{item.quantity}</span>
                                    </div>
                                    <div className="item-details">
                                        <h4>{item.name}</h4>
                                        <div className="item-price">{formatPrice(item.price)}</div>
                                    </div>
                                    <div className="item-subtotal">
                                        {formatPrice(item.price * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="summary-totals">
                            <div className="summary-row">
                                <span>Subtotal</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="summary-row">
                                <span>Shipping</span>
                                <span>{formatPrice(shipping)}</span>
                            </div>
                            <div className="summary-row">
                                <span>Tax</span>
                                <span>{formatPrice(tax)}</span>
                            </div>
                            <div className="summary-row total">
                                <span>Total</span>
                                <span>{formatPrice(total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Cross-Selling Suggestions */}
                    <CrossSellingSuggestions cartItems={cartItems} />
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;
