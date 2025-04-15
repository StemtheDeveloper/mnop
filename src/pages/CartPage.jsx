import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, updateDoc, deleteDoc, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/CartPage.css';

const CartPage = () => {
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [cartId, setCartId] = useState(null);
    const { currentUser } = useUser();

    // Calculate total price of cart items
    const calculateTotal = (items) => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
                    setTotal(calculateTotal(localCart));
                    setLoading(false);
                    return;
                }

                // For authenticated users, get cart from Firestore
                const cartsRef = collection(db, 'carts');
                const q = query(cartsRef, where('userId', '==', currentUser.uid));

                unsubscribe = onSnapshot(q, (snapshot) => {
                    if (snapshot.empty) {
                        // Create a cart if it doesn't exist
                        createCart();
                        return;
                    }

                    // Get cart data
                    const cartDoc = snapshot.docs[0];
                    setCartId(cartDoc.id);
                    const cart = cartDoc.data();

                    const items = cart.items || [];
                    setCartItems(items);
                    setTotal(calculateTotal(items));
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

        // Create a new cart for the user
        const createCart = async () => {
            try {
                const cartData = {
                    userId: currentUser.uid,
                    items: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const docRef = await addDoc(collection(db, 'carts'), cartData);
                setCartId(docRef.id);
                setCartItems([]);
                setTotal(0);
                setLoading(false);
            } catch (err) {
                console.error("Error creating cart:", err);
                setError("Could not create a new cart. Please try again.");
                setLoading(false);
            }
        };

        fetchCart();

        // Clean up subscription
        return () => unsubscribe();
    }, [currentUser]);

    // Update item quantity
    const updateQuantity = async (itemId, newQuantity) => {
        // Don't allow negative or zero quantities
        if (newQuantity < 1) return;

        try {
            // For guest users, update in local storage
            if (!currentUser) {
                const updatedCart = cartItems.map(item =>
                    item.id === itemId ? { ...item, quantity: newQuantity } : item
                );

                localStorage.setItem('cart', JSON.stringify(updatedCart));
                setCartItems(updatedCart);
                setTotal(calculateTotal(updatedCart));
                return;
            }

            // For authenticated users, update in Firestore
            if (!cartId) return;

            // Create a new items array with the updated quantity
            const updatedItems = cartItems.map(item =>
                item.id === itemId ? { ...item, quantity: newQuantity } : item
            );

            // Update the cart document
            await updateDoc(doc(db, 'carts', cartId), {
                items: updatedItems,
                updatedAt: new Date()
            });
            // No need to update state here as onSnapshot will handle it
        } catch (err) {
            console.error("Error updating quantity:", err);
            setError("Could not update quantity. Please try again.");
        }
    };

    // Remove item from cart
    const removeItem = async (itemId) => {
        try {
            // For guest users, update in local storage
            if (!currentUser) {
                const updatedCart = cartItems.filter(item => item.id !== itemId);
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                setCartItems(updatedCart);
                setTotal(calculateTotal(updatedCart));
                return;
            }

            // For authenticated users, update in Firestore
            if (!cartId) return;

            // Create a new items array without the removed item
            const updatedItems = cartItems.filter(item => item.id !== itemId);

            // Update the cart document
            await updateDoc(doc(db, 'carts', cartId), {
                items: updatedItems,
                updatedAt: new Date()
            });
            // No need to update state here as onSnapshot will handle it
        } catch (err) {
            console.error("Error removing item:", err);
            setError("Could not remove item. Please try again.");
        }
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    };

    // Display loading state
    if (loading) {
        return (
            <div className="cart-page">
                <div className="cart-container loading">
                    <LoadingSpinner />
                    <p className="loading-text">Loading your cart...</p>
                </div>
            </div>
        );
    }

    // Display error state
    if (error) {
        return (
            <div className="cart-page">
                <div className="cart-container error">
                    <div className="error-message">{error}</div>
                    <button className="btn-primary" onClick={() => window.location.reload()}>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="cart-page">
            <div className="cart-container">
                <h1>Your Shopping Cart</h1>

                {cartItems.length === 0 ? (
                    <div className="empty-cart">
                        <div className="empty-cart-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="21" r="1"></circle>
                                <circle cx="20" cy="21" r="1"></circle>
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                            </svg>
                        </div>
                        <p>Your cart is empty</p>
                        <p className="empty-cart-subtext">Looks like you haven't added any products to your cart yet.</p>
                        <Link to="/shop" className="continue-shopping">Browse Products</Link>
                    </div>
                ) : (
                    <>
                        <div className="cart-items">
                            {cartItems.map(item => (
                                <div key={item.id} className="cart-item">
                                    <div className="item-image">
                                        <img
                                            src={item.imageUrl || 'https://via.placeholder.com/80?text=Product'}
                                            alt={item.name}
                                        />
                                    </div>
                                    <div className="item-details">
                                        <h3>{item.name}</h3>
                                        <div className="item-price">{formatPrice(item.price)}</div>
                                    </div>
                                    <div className="item-quantity">
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                            aria-label="Decrease quantity"
                                            className="quantity-btn"
                                        >
                                            −
                                        </button>
                                        <span className="quantity-value">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                            aria-label="Increase quantity"
                                            className="quantity-btn"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <div className="item-total">
                                        {formatPrice(item.price * item.quantity)}
                                    </div>
                                    <button
                                        className="remove-item"
                                        onClick={() => removeItem(item.id)}
                                        aria-label="Remove item"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="cart-summary">
                            <div className="summary-row subtotal">
                                <span>Subtotal</span>
                                <span>{formatPrice(total)}</span>
                            </div>
                            <div className="summary-row shipping">
                                <span>Shipping</span>
                                <span>Calculated at checkout</span>
                            </div>
                            <div className="summary-row total">
                                <span>Total</span>
                                <span>{formatPrice(total)}</span>
                            </div>

                            <div className="cart-actions">
                                <Link to="/checkout" className="checkout-button">
                                    Proceed to Checkout
                                </Link>
                                <Link to="/shop" className="continue-shopping">
                                    Continue Shopping
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CartPage;
