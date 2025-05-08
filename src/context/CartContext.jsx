import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from './UserContext';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const { currentUser } = useUser();
    const [cartItems, setCartItems] = useState([]);
    const [cartId, setCartId] = useState(null);
    const [cartCount, setCartCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Calculate total items in cart
    const calculateCartCount = (items) => {
        return items.reduce((total, item) => total + item.quantity, 0);
    };

    // Fetch cart items whenever the user changes
    useEffect(() => {
        let unsubscribe = () => { };

        const fetchCart = async () => {
            setLoading(true);
            try {
                // Handle guest users with local storage
                if (!currentUser) {
                    const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
                    setCartItems(localCart);
                    setCartCount(calculateCartCount(localCart));
                    setLoading(false);
                    return;
                }

                // For authenticated users, get cart from Firestore
                const cartsRef = collection(db, 'carts');
                const q = query(cartsRef, where('userId', '==', currentUser.uid));

                unsubscribe = onSnapshot(q, (snapshot) => {
                    if (snapshot.empty) {
                        setCartItems([]);
                        setCartCount(0);
                        setLoading(false);
                        return;
                    }

                    // Get cart data
                    const cartDoc = snapshot.docs[0];
                    setCartId(cartDoc.id);
                    const cart = cartDoc.data();

                    const items = cart.items || [];
                    setCartItems(items);
                    setCartCount(calculateCartCount(items));
                    setLoading(false);
                });

            } catch (err) {
                console.error("Error setting up cart listener:", err);
                setLoading(false);
            }
        };

        fetchCart();

        // Clean up subscription
        return () => unsubscribe();
    }, [currentUser]);

    const value = {
        cartItems,
        cartCount,
        cartId,
        loading
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};