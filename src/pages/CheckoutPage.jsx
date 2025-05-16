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


// CrossSellingSuggestions Component
const CrossSellingSuggestions = ({
    cartItems,
    updateCartState = null, // Function to update checkout state when items are added
    formData = null // Form data for tax calculation
}) => {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showError, success } = useToast();
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const [addingToCart, setAddingToCart] = useState({});

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

                // Get only the first 4 products
                const eligibleSuggestions = suggestionsSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .filter(product => {
                        // Filter out products that are already in the cart
                        if (cartProductIds.includes(product.id)) {
                            return false;
                        }

                        // Check if product is direct sell or fully funded crowdfunded
                        if (product.isDirectSell) {
                            return true; // Direct sell products are always eligible
                        } else if (product.isCrowdfunded) {
                            // Only show crowdfunded products if they're fully funded
                            return product.currentFunding >= product.fundingGoal;
                        }

                        // Default case: don't show the product
                        return false;
                    })
                    .slice(0, 4); // Get only first 4 eligible products

                setSuggestions(eligibleSuggestions);

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

    // Handle add to cart
    const handleAddToCart = async (product) => {
        if (addingToCart[product.id]) return; // Prevent double clicks

        setAddingToCart(prev => ({ ...prev, [product.id]: true }));

        try {
            if (!currentUser) {
                // Guest cart handling
                const localCart = JSON.parse(localStorage.getItem('cart') || '[]');

                // Check if product already in cart
                const existingItemIndex = localCart.findIndex(item => item.id === product.id);

                if (existingItemIndex >= 0) {
                    // Update quantity if already in cart
                    localCart[existingItemIndex].quantity += 1;
                } else {
                    // Add new item
                    localCart.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        imageUrl: product.imageUrl || (product.imageUrls && product.imageUrls[0]),
                        quantity: 1
                    });
                }

                localStorage.setItem('cart', JSON.stringify(localCart));
                success(`Added ${product.name} to your cart!`);

                // Update parent component cart state if the function is provided
                if (updateCartState) {
                    updateCartState(localCart);
                }
            } else {
                // Authenticated user cart
                const cartsRef = collection(db, 'carts');
                const q = query(cartsRef, where('userId', '==', currentUser.uid));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    // Create a new cart with the new item
                    const newCartItems = [{
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        imageUrl: product.imageUrl || (product.imageUrls && product.imageUrls[0]),
                        quantity: 1
                    }];

                    await addDoc(cartsRef, {
                        userId: currentUser.uid,
                        items: newCartItems,
                        updatedAt: serverTimestamp()
                    });

                    // Update parent component's state if function is provided
                    if (updateCartState) {
                        updateCartState(newCartItems);
                    }
                } else {
                    // Update existing cart
                    const cartDoc = snapshot.docs[0];
                    const cartData = cartDoc.data();
                    const items = cartData.items || [];

                    // Check if item already in cart
                    const existingItemIndex = items.findIndex(item => item.id === product.id);

                    if (existingItemIndex >= 0) {
                        // Update quantity
                        items[existingItemIndex].quantity += 1;
                    } else {
                        // Add new item
                        items.push({
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            imageUrl: product.imageUrl || (product.imageUrls && product.imageUrls[0]),
                            quantity: 1
                        });
                    }

                    await updateDoc(doc(db, 'carts', cartDoc.id), {
                        items,
                        updatedAt: serverTimestamp()
                    });
                    // For authenticated users, trigger an immediate update to ensure tax is recalculated
                    if (updateCartState) {
                        updateCartState(items);
                    }
                }

                success(`Added ${product.name} to your cart!`);
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            showError('Failed to add item to cart');
        } finally {
            setAddingToCart(prev => ({ ...prev, [product.id]: false }));
        }
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
                        <div className="suggestion-image" onClick={() => handleSuggestionClick(product.id)}>
                            <img
                                src={product.imageUrl || (product.imageUrls && product.imageUrls[0]) || 'https://via.placeholder.com/160?text=Product'}
                                alt={product.name}
                            />
                        </div>
                        <div className="suggestion-details">
                            <h4 onClick={() => handleSuggestionClick(product.id)}>
                                {product.name || 'Product'}
                            </h4>
                            <div className="suggestion-price">
                                {formatPrice(product.price)}
                            </div>
                            <button
                                className="suggestion-add-to-cart"
                                onClick={() => handleAddToCart(product)}
                                disabled={addingToCart[product.id]}
                            >
                                {addingToCart[product.id] ? 'Adding...' : 'Add to Cart'}
                            </button>
                        </div>
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
    const [shippingDetails, setShippingDetails] = useState(null);

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
    });    // Calculate tax based on country and state/province
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

        // Round to 2 decimal places to avoid floating point issues
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
    }, [formData.country]);    // Update tax when country, state, subtotal, or shipping changes
    useEffect(() => {
        // Only recalculate if we have a subtotal (means cart is loaded)
        if (subtotal > 0) {
            // Calculate tax based on shipping location and subtotal
            const taxAmount = calculateTax(subtotal, formData.country, formData.state);
            setTax(taxAmount);
            // Update total with tax included
            setTotal(subtotal + shipping + taxAmount);
        }
    }, [formData.country, formData.state, subtotal, shipping]);

    // Calculate subtotal and total
    const calculateTotals = (items) => {
        // Calculate subtotal from items
        const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        setSubtotal(itemsTotal);

        // Calculate tax based on shipping location and subtotal
        // Note: Tax calculation should be based on the subtotal and shipping destination
        const taxAmount = calculateTax(itemsTotal, formData.country, formData.state);
        setTax(taxAmount);

        // Calculate total (subtotal + shipping + tax)
        // Explicitly ensure all components are included
        const orderTotal = itemsTotal + shipping + taxAmount;
        console.log(`Calculating total: subtotal(${itemsTotal}) + shipping(${shipping}) + tax(${taxAmount}) = ${orderTotal}`);
        setTotal(orderTotal);

        // Check for insufficient funds immediately if wallet is selected
        if (userWallet && selectedPaymentMethod === 'wallet') {
            setInsufficientFunds(userWallet.balance < orderTotal);
        }
    };

    // Force recalculation of cart totals, useful when items are added but listener doesn't update
    const forceCartUpdate = async () => {
        if (!currentUser || !cartId) return;

        try {
            const cartRef = doc(db, "carts", cartId);
            const cartDoc = await getDoc(cartRef);

            if (cartDoc.exists()) {
                const cart = cartDoc.data();
                const items = cart.items || [];
                setCartItems(items);
                calculateTotals(items);
            }
        } catch (error) {
            console.error("Error forcing cart update:", error);
        }
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

            // Track whether express shipping should be offered for free
            let freeExpressShipping = false;

            // Track whether the cart contains any large items that require special shipping
            let hasLargeItems = false;
            let hasOverweightItems = false;

            // Track individual item shipping metrics
            const largeItems = [];
            const overweightItems = [];

            // Calculate volumetric weight for combined shipping
            let totalVolumetricWeight = 0;
            let totalActualWeight = 0;

            // Process each item in the cart
            for (const item of cartItems) {
                try {
                    // Get the product details
                    const productRef = doc(db, 'products', item.id);
                    const productDoc = await getDoc(productRef);

                    if (productDoc.exists()) {
                        const productData = productDoc.data();
                        const designerId = productData.designerId;

                        // Calculate metrics for each item, accounting for quantity
                        const quantity = item.quantity || 1;

                        // Process dimensions and calculate volumetric weight
                        if (productData.dimensions) {
                            const { length = 0, width = 0, height = 0, unit = 'inches' } = productData.dimensions;

                            // Convert to inches if necessary
                            const conversionFactor = unit === 'cm' ? 0.393701 : 1;
                            const lengthInches = length * conversionFactor;
                            const widthInches = width * conversionFactor;
                            const heightInches = height * conversionFactor;

                            // Check if any dimension exceeds thresholds for standard shipping
                            if (lengthInches > 30 || widthInches > 30 || heightInches > 30) {
                                hasLargeItems = true;
                                largeItems.push({
                                    id: item.id,
                                    name: productData.name || item.name,
                                    dimensions: `${lengthInches.toFixed(1)}″ x ${widthInches.toFixed(1)}″ x ${heightInches.toFixed(1)}″`
                                });
                            }

                            // Calculate volumetric weight (L x W x H in inches / 139)
                            const volumetricWeight = (lengthInches * widthInches * heightInches) / 139;
                            totalVolumetricWeight += volumetricWeight * quantity;
                        }

                        // Process weight
                        if (productData.weight) {
                            // Convert to pounds if necessary
                            const weightUnit = productData.weightUnit || 'lb';
                            const weightInLbs = weightUnit === 'kg' ? productData.weight * 2.20462 : productData.weight;

                            // Check if product weight exceeds threshold for standard shipping
                            if (weightInLbs > 20) {
                                hasOverweightItems = true;
                                overweightItems.push({
                                    id: item.id,
                                    name: productData.name || item.name,
                                    weight: `${weightInLbs.toFixed(1)} lbs`
                                });
                            }

                            // Add to total actual weight
                            totalActualWeight += weightInLbs * quantity;
                        }

                        // Check if product has custom shipping settings
                        if (productData.customShipping) {
                            // Check if product has free shipping
                            if (productData.freeShipping) {
                                // Only consider free shipping if it's not a large or overweight item
                                if (!hasLargeItems && !hasOverweightItems) {
                                    hasFreeShippingItem = true;
                                    // If free shipping includes express shipping
                                    if (productData.freeExpressShipping) {
                                        freeExpressShipping = true;
                                    }
                                }
                            }

                            // Update lowest free shipping threshold if product has one
                            if (!productData.freeShipping &&
                                productData.freeShippingThreshold &&
                                productData.freeShippingThreshold > 0 &&
                                productData.freeShippingThreshold < lowestFreeShippingThreshold) {
                                lowestFreeShippingThreshold = productData.freeShippingThreshold;
                                // Check if free threshold includes express shipping
                                if (productData.freeExpressShippingThreshold) {
                                    freeExpressShipping = true;
                                }
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
                                        freeShippingThreshold: designerSettings.freeShippingThreshold || 0,
                                        freeExpressShipping: designerSettings.freeExpressShipping || false
                                    };

                                    // Update shipping costs with designer settings
                                    standardCost = Math.max(standardCost, designerItems[designerId].standardShippingCost);
                                    expressCost = Math.max(expressCost, designerItems[designerId].expressShippingCost);

                                    // Update free shipping threshold
                                    if (designerSettings.offerFreeShipping &&
                                        designerSettings.freeShippingThreshold > 0 &&
                                        designerSettings.freeShippingThreshold < lowestFreeShippingThreshold) {
                                        lowestFreeShippingThreshold = designerSettings.freeShippingThreshold;

                                        // Check if free shipping includes express
                                        if (designerSettings.freeExpressShipping) {
                                            freeExpressShipping = true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing item ${item.id}:`, error);
                }
            }

            // Use the greater of volumetric weight or actual weight
            const shippingWeight = Math.max(totalVolumetricWeight, totalActualWeight);

            // Apply progressive surcharges based on weight and dimensions
            let standardSurcharge = 0;
            let expressSurcharge = 0;

            // Add base surcharges for large items
            if (hasLargeItems) {
                standardSurcharge += 15; // Base $15 surcharge for large items with standard shipping
                expressSurcharge += 25;  // Base $25 surcharge for large items with express shipping
            }

            // Add base surcharges for overweight items
            if (hasOverweightItems) {
                standardSurcharge += 10; // Base $10 surcharge for overweight items with standard shipping
                expressSurcharge += 15;  // Base $15 surcharge for overweight items with express shipping
            }

            // Add progressive weight surcharges beyond 50 lbs
            if (shippingWeight > 50) {
                // Add $0.50 per pound over 50 lbs for standard, $0.75 for express
                const excessWeight = shippingWeight - 50;
                standardSurcharge += excessWeight * 0.5;
                expressSurcharge += excessWeight * 0.75;
            }

            // Apply final surcharges
            standardCost += standardSurcharge;
            expressCost += expressSurcharge;

            // Prevent free shipping for orders with large or overweight items
            const allowFreeShipping = !hasLargeItems && !hasOverweightItems;

            return {
                standardShippingCost: Math.round(standardCost * 100) / 100,
                expressShippingCost: Math.round(expressCost * 100) / 100,
                hasFreeShippingItem: allowFreeShipping && hasFreeShippingItem,
                freeShippingThreshold: lowestFreeShippingThreshold === Infinity ? 0 : lowestFreeShippingThreshold,
                hasLargeItems,
                hasOverweightItems,
                largeItems,
                overweightItems,
                shippingWeight: Math.round(shippingWeight * 10) / 10,
                volumetricWeight: Math.round(totalVolumetricWeight * 10) / 10,
                actualWeight: Math.round(totalActualWeight * 10) / 10,
                allowFreeShipping,
                freeExpressShipping
            };
        } catch (error) {
            console.error('Error fetching shipping costs:', error);
            // Default values in case of error
            return {
                standardShippingCost: 10,
                expressShippingCost: 25,
                hasFreeShippingItem: false,
                freeShippingThreshold: 0,
                hasLargeItems: false,
                hasOverweightItems: false,
                largeItems: [],
                overweightItems: [],
                shippingWeight: 0,
                volumetricWeight: 0,
                actualWeight: 0,
                allowFreeShipping: true,
                freeExpressShipping: false
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

                    // Calculate subtotal first
                    const itemsTotal = localCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    setSubtotal(itemsTotal);

                    // Fetch shipping costs for the cart
                    const shippingInfo = await fetchShippingCosts(localCart);

                    // Update shipping costs and method
                    const currentMethod = formData.shippingMethod;
                    const shippingCost = currentMethod === 'express' ?
                        shippingInfo.expressShippingCost :
                        shippingInfo.standardShippingCost;

                    // Determine final shipping cost
                    let finalShippingCost = shippingCost;
                    if (shippingInfo.hasFreeShippingItem ||
                        (shippingInfo.freeShippingThreshold > 0 &&
                            itemsTotal >= shippingInfo.freeShippingThreshold &&
                            shippingInfo.allowFreeShipping)) {
                        finalShippingCost = 0;

                        // If free shipping is available and express shipping is included,
                        // automatically select express shipping
                        if (shippingInfo.freeExpressShipping && currentMethod !== 'express') {
                            setFormData(prev => ({
                                ...prev,
                                shippingMethod: 'express'
                            }));
                        }
                    }

                    // Set shipping cost
                    setShipping(finalShippingCost);

                    // Calculate tax amount based on subtotal only (tax is not applied to shipping)
                    const taxAmount = calculateTax(itemsTotal, formData.country, formData.state);
                    setTax(taxAmount);

                    // Explicitly calculate final total ensuring subtotal is included
                    const finalTotal = itemsTotal + finalShippingCost + taxAmount;
                    setTotal(finalTotal);

                    // Store shipping info details for UI notifications
                    setShippingDetails(shippingInfo);

                    setLoading(false);
                    return;
                }

                // For authenticated users, get cart from Firestore
                const cartsRef = collection(db, 'carts'); const q = query(cartsRef, where('userId', '==', currentUser.uid));

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

                    // Calculate the subtotal first
                    const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    setSubtotal(itemsTotal);

                    // Fetch shipping costs for the cart
                    const shippingInfo = await fetchShippingCosts(items);

                    // Update shipping costs and method
                    const currentMethod = formData.shippingMethod;
                    const shippingCost = currentMethod === 'express' ?
                        shippingInfo.expressShippingCost :
                        shippingInfo.standardShippingCost;

                    // Determine final shipping cost
                    let finalShippingCost = shippingCost;
                    if (shippingInfo.hasFreeShippingItem ||
                        (shippingInfo.freeShippingThreshold > 0 &&
                            itemsTotal >= shippingInfo.freeShippingThreshold &&
                            shippingInfo.allowFreeShipping)) {
                        finalShippingCost = 0;

                        // If free shipping is available and express shipping is included,
                        // automatically select express shipping
                        if (shippingInfo.freeExpressShipping && currentMethod !== 'express') {
                            setFormData(prev => ({
                                ...prev,
                                shippingMethod: 'express'
                            }));
                        }
                    }

                    // Set shipping cost
                    setShipping(finalShippingCost);

                    // Calculate tax amount based on subtotal only (tax is not applied to shipping)
                    const taxAmount = calculateTax(itemsTotal, formData.country, formData.state);
                    setTax(taxAmount);

                    // Explicitly calculate final total ensuring subtotal is included
                    const finalTotal = itemsTotal + finalShippingCost + taxAmount;
                    setTotal(finalTotal);

                    // Store shipping info details for UI notifications
                    setShippingDetails(shippingInfo);

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

                // Calculate current subtotal to ensure it's always included in total
                const currentSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                // Check if order qualifies for free shipping
                let finalShippingCost = shippingCost;
                if (shippingInfo.hasFreeShippingItem ||
                    (currentSubtotal >= shippingInfo.freeShippingThreshold &&
                        shippingInfo.freeShippingThreshold > 0 &&
                        shippingInfo.allowFreeShipping)) {
                    finalShippingCost = 0;
                }

                // Set shipping cost
                setShipping(finalShippingCost);

                // Recalculate tax based on subtotal only (tax is not applied to shipping)
                const taxAmount = calculateTax(currentSubtotal, formData.country, formData.state);
                setTax(taxAmount);

                // Explicitly calculate final total ensuring subtotal is included
                const finalTotal = currentSubtotal + finalShippingCost + taxAmount;
                setTotal(finalTotal);

            } catch (error) {
                console.error('Error updating shipping cost:', error);

                // Fallback to default shipping costs
                const shippingCost = value === 'express' ? 25 : 10;
                setShipping(shippingCost);

                // Make sure we correctly calculate with subtotal included
                const currentSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                // Recalculate tax based on subtotal only (tax is not applied to shipping)
                const taxAmount = calculateTax(currentSubtotal, formData.country, formData.state);
                setTax(taxAmount);

                // Explicitly include subtotal in the total calculation
                const finalTotal = currentSubtotal + shippingCost + taxAmount;
                setTotal(finalTotal);
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
                        const productData = productDoc.data();                        // Calculate sale amount
                        const manufacturingCost = productData.manufacturingCost || 0;
                        const saleAmount = item.price * item.quantity;

                        // Calculate proportional shipping based on item price relative to total order value
                        // This ensures more expensive items get proportionally more shipping revenue
                        const itemPriceTotal = item.price * item.quantity;
                        const orderSubtotal = cartItems.reduce((sum, cartItem) => sum + (cartItem.price * cartItem.quantity), 0);
                        const itemShippingShare = shipping * (itemPriceTotal / orderSubtotal);

                        // Use the comprehensive method that handles business commission, 
                        // investor revenue, AND designer payments in one call                        // Ensure numeric values are properly converted
                        const validatedSaleAmount = typeof saleAmount === 'string' ? parseFloat(saleAmount) : saleAmount;
                        const validatedManufacturingCost = typeof manufacturingCost === 'string' ? parseFloat(manufacturingCost) : manufacturingCost;
                        const validatedQuantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity;
                        const validatedShippingShare = typeof itemShippingShare === 'string' ? parseFloat(itemShippingShare) : itemShippingShare;

                        console.log(`Processing sale for ${item.id} with values:`, {
                            saleAmount: validatedSaleAmount,
                            manufacturingCost: validatedManufacturingCost,
                            quantity: validatedQuantity,
                            shippingShare: validatedShippingShare
                        });

                        const saleResult = await walletService.processProductSale(
                            item.id,
                            item.name || productData.name,
                            validatedSaleAmount,
                            validatedManufacturingCost,
                            validatedQuantity,
                            orderRef.id,
                            validatedShippingShare // Distribute shipping cost proportionally based on item price
                        ); if (saleResult.success) {
                            try {
                                // Use safe JSON serialization to avoid circular references
                                const safeSaleResult = {
                                    success: saleResult.success,
                                    message: saleResult.message,
                                    isDirectSell: saleResult.isDirectSell,
                                    commissionAmount: saleResult.commissionResult?.commissionAmount,
                                    distributedAmount: saleResult.distributionResult?.distributedAmount,
                                    designerAmount: saleResult.designerPaymentResult?.amount
                                };
                                console.log('Product sale processed successfully:', JSON.stringify(safeSaleResult));
                            } catch (logError) {
                                console.log('Product sale processed successfully (log error):', logError);
                            }
                        } else {
                            console.error('Error processing product sale:', saleResult.error || 'Unknown error');
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
                                            {/* Only show standard shipping if express shipping isn't free OR both are free */}
                                            {(!shippingDetails?.freeExpressShipping || shipping === 0) && (
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
                                                                <span>${shippingDetails?.standardShippingCost?.toFixed(2) || '10.00'}</span>
                                                            )}
                                                        </div>
                                                        <div className="option-duration">5-7 business days</div>
                                                    </label>
                                                </div>
                                            )}

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
                                                            <span>${shippingDetails?.expressShippingCost?.toFixed(2) || '25.00'}</span>
                                                        )}
                                                    </div>
                                                    <div className="option-duration">2-3 business days</div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Special shipping notices */}
                                {shippingDetails && shippingDetails.hasLargeItems && (
                                    <div className="shipping-surcharge-notification">
                                        <p>
                                            <strong>Special Shipping Notice:</strong> Your cart contains
                                            {shippingDetails.hasLargeItems && shippingDetails.hasOverweightItems ? ' large and overweight' :
                                                shippingDetails.hasLargeItems ? ' large' : ' overweight'} items that require additional shipping costs.
                                        </p>
                                        <div className="surcharge-details">
                                            <p>These items are not eligible for free shipping regardless of order total:</p>

                                            {shippingDetails.hasLargeItems && shippingDetails.largeItems && shippingDetails.largeItems.length > 0 && (
                                                <div>
                                                    <p><strong>Large items</strong> (any dimension exceeding 30 inches):</p>
                                                    <ul>
                                                        {shippingDetails.largeItems.map((item, index) => (
                                                            <li key={`large-${item.id}-${index}`}>
                                                                {item.name} - {item.dimensions}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <p>Large item surcharge: $15 for standard shipping or $25 for express shipping</p>
                                                </div>
                                            )}

                                            {shippingDetails.hasOverweightItems && shippingDetails.overweightItems && shippingDetails.overweightItems.length > 0 && (
                                                <div>
                                                    <p><strong>Overweight items</strong> (exceeding 20 pounds):</p>
                                                    <ul>
                                                        {shippingDetails.overweightItems.map((item, index) => (
                                                            <li key={`weight-${item.id}-${index}`}>
                                                                {item.name} - {item.weight}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <p>Overweight item surcharge: $10 for standard shipping or $15 for express shipping</p>
                                                </div>
                                            )}

                                            {shippingDetails.shippingWeight > 50 && (
                                                <div className="additional-weight-notice">
                                                    <p><strong>Additional weight surcharge:</strong> Your order's combined shipping weight of {shippingDetails.shippingWeight} lbs exceeds 50 lbs.</p>
                                                    <p>This incurs an additional $0.50 per pound over 50 lbs for standard shipping or $0.75 per pound for express shipping.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

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
                    </div>                    {/* Cross-Selling Suggestions */}
                    <CrossSellingSuggestions
                        cartItems={cartItems}
                        updateCartState={(newCartItems) => {
                            if (!currentUser) {
                                // For guest users, manually update state
                                setCartItems(newCartItems);

                                // Calculate new totals
                                const newSubtotal = newCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                setSubtotal(newSubtotal);

                                // Calculate tax based on the subtotal
                                const taxAmount = calculateTax(newSubtotal, formData.country, formData.state);
                                setTax(taxAmount);

                                // Update total (subtotal + shipping + tax)
                                setTotal(newSubtotal + shipping + taxAmount);
                            } else {
                                // For authenticated users, also update state based on newCartItems
                                // to ensure tax is calculated and displayed correctly.
                                // The main onSnapshot listener should ideally converge to these values.
                                const newSubtotal = newCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                                const taxAmount = calculateTax(newSubtotal, formData.country, formData.state);

                                setCartItems(newCartItems); // Reflect the added item immediately
                                setSubtotal(newSubtotal);   // Update subtotal
                                setTax(taxAmount);          // Crucially, update tax
                                // 'shipping' is the current state value from CheckoutPage
                                setTotal(newSubtotal + shipping + taxAmount); // Update total
                            }
                        }}
                        formData={formData}
                    />
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;
