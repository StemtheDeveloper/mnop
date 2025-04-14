import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import '../styles/CartPage.css';

const CartPage = () => {
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);

    const auth = getAuth();
    const db = getFirestore();

    useEffect(() => {
        // Fetch cart items when component mounts
        const fetchCartItems = async () => {
            try {
                const user = auth.currentUser;

                if (!user) {
                    // Handle non-authenticated users (maybe get from localStorage)
                    const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
                    setCartItems(localCart);
                    calculateTotal(localCart);
                    setLoading(false);
                    return;
                }

                // For authenticated users, get cart from Firestore
                const cartRef = collection(db, 'carts');
                const userCartQuery = query(cartRef, where('userId', '==', user.uid));

                const unsubscribe = onSnapshot(userCartQuery, (snapshot) => {
                    if (snapshot.empty) {
                        setCartItems([]);
                        setTotal(0);
                        setLoading(false);
                        return;
                    }

                    // Get the first cart document that matches the query
                    const cartDoc = snapshot.docs[0];
                    const cartData = cartDoc.data();

                    // Assuming cart items are stored in an array field called 'items'
                    if (cartData && cartData.items) {
                        setCartItems(cartData.items);
                        calculateTotal(cartData.items);
                    } else {
                        setCartItems([]);
                        setTotal(0);
                    }

                    setLoading(false);
                }, (err) => {
                    console.error("Error getting cart:", err);
                    setError("Failed to load cart items");
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (err) {
                console.error("Error in cart fetch:", err);
                setError("Failed to load cart items");
                setLoading(false);
            }
        };

        fetchCartItems();
    }, [auth, db]);

    const calculateTotal = (items) => {
        const cartTotal = items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        setTotal(cartTotal);
    };

    const updateQuantity = async (itemId, newQuantity) => {
        try {
            if (newQuantity < 1) return;

            const user = auth.currentUser;

            if (!user) {
                // Update local storage for non-authenticated users
                const updatedCart = cartItems.map(item =>
                    item.id === itemId ? { ...item, quantity: newQuantity } : item
                );
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                setCartItems(updatedCart);
                calculateTotal(updatedCart);
                return;
            }

            // For authenticated users, update Firestore
            const cartRef = collection(db, 'carts');
            const userCartQuery = query(cartRef, where('userId', '==', user.uid));
            const snapshot = await userCartQuery.get();

            if (!snapshot.empty) {
                const cartDoc = snapshot.docs[0];
                const cartData = cartDoc.data();

                const updatedItems = cartData.items.map(item =>
                    item.id === itemId ? { ...item, quantity: newQuantity } : item
                );

                await updateDoc(doc(db, 'carts', cartDoc.id), {
                    items: updatedItems
                });
            }
        } catch (err) {
            console.error("Error updating quantity:", err);
            setError("Failed to update quantity");
        }
    };

    const removeItem = async (itemId) => {
        try {
            const user = auth.currentUser;

            if (!user) {
                // Update local storage for non-authenticated users
                const updatedCart = cartItems.filter(item => item.id !== itemId);
                localStorage.setItem('cart', JSON.stringify(updatedCart));
                setCartItems(updatedCart);
                calculateTotal(updatedCart);
                return;
            }

            // For authenticated users, update Firestore
            const cartRef = collection(db, 'carts');
            const userCartQuery = query(cartRef, where('userId', '==', user.uid));
            const snapshot = await userCartQuery.get();

            if (!snapshot.empty) {
                const cartDoc = snapshot.docs[0];
                const cartData = cartDoc.data();

                const updatedItems = cartData.items.filter(item => item.id !== itemId);

                await updateDoc(doc(db, 'carts', cartDoc.id), {
                    items: updatedItems
                });
            }
        } catch (err) {
            console.error("Error removing item:", err);
            setError("Failed to remove item");
        }
    };

    if (loading) {
        return <div className="cart-container loading">Loading your cart...</div>;
    }

    if (error) {
        return <div className="cart-container error">{error}</div>;
    }

    return (
        <div className="cart-page">
            <div className="cart-container">
                <h1>Your Shopping Cart</h1>

                {cartItems.length === 0 ? (
                    <div className="empty-cart">
                        <p>Your cart is empty</p>
                        <Link to="/shop" className="continue-shopping">Continue Shopping</Link>
                    </div>
                ) : (
                    <>
                        <div className="cart-items">
                            {cartItems.map(item => (
                                <div key={item.id} className="cart-item">
                                    <div className="item-image">
                                        <img src={item.image} alt={item.name} />
                                    </div>
                                    <div className="item-details">
                                        <h3>{item.name}</h3>
                                        <p className="item-price">${item.price.toFixed(2)}</p>
                                    </div>
                                    <div className="item-quantity">
                                        <button
                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                            disabled={item.quantity <= 1}
                                        >
                                            -
                                        </button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                                            +
                                        </button>
                                    </div>
                                    <div className="item-total">
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </div>
                                    <button
                                        className="remove-item"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="cart-summary">
                            <div className="summary-row subtotal">
                                <span>Subtotal</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            <div className="summary-row shipping">
                                <span>Shipping</span>
                                <span>Calculated at checkout</span>
                            </div>
                            <div className="summary-row total">
                                <span>Estimated Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>

                            <Link to="/checkout" className="checkout-button">
                                Proceed to Checkout
                            </Link>

                            <Link to="/shop" className="continue-shopping">
                                Continue Shopping
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CartPage;
