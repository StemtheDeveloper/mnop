import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import walletService from '../services/walletService';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const USER_ROLES = {
    CUSTOMER: 'customer',
    DESIGNER: 'designer',
    MANUFACTURER: 'manufacturer',
    INVESTOR: 'investor',
    ADMIN: 'admin'
};

export const UserProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userWallet, setUserWallet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [transactions, setTransactions] = useState([]);

    // Function to fetch user profile and data from Firestore
    const fetchUserData = async (uid) => {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                setUserProfile(userData);

                // Handle user roles - support both "role" (string) and "roles" (array)
                if (userData.roles) {
                    setUserRole(userData.roles); // Array of roles
                } else if (userData.role) {
                    setUserRole(userData.role); // Single role string
                } else {
                    // Default role if none is set
                    setUserRole('customer');
                }
            } else {
                // Create a new user document if it doesn't exist
                const newUserData = {
                    uid,
                    email: auth.currentUser?.email || '',
                    displayName: auth.currentUser?.displayName || '',
                    photoURL: auth.currentUser?.photoURL || '',
                    role: 'customer', // Default role
                    roles: ['customer'], // Default roles array
                    createdAt: serverTimestamp()
                };

                await setDoc(docRef, newUserData);
                setUserProfile(newUserData);
                setUserRole('customer');
            }

            // Fetch user wallet information or initialize it
            try {
                let wallet = await walletService.getUserWallet(uid);
                if (!wallet) {
                    wallet = await walletService.initializeWallet(uid);
                }
                setUserWallet(wallet);
            } catch (walletError) {
                console.error("Error setting up wallet:", walletError);
                // Set a default wallet state
                setUserWallet({
                    balance: 0,
                    updatedAt: new Date()
                });
            }

            // Fetch transaction history
            try {
                const transactionHistory = await walletService.getTransactionHistory(uid);
                setTransactions(transactionHistory || []);
            } catch (txError) {
                console.error("Error fetching transactions:", txError);
                setTransactions([]);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserProfile(null);
            setUserRole(null);
        }
    };

    // Function to check if a user has a specific role
    const hasRole = (role) => {
        if (!userRole) return false;

        if (Array.isArray(userRole)) {
            return userRole.includes(role);
        }

        return userRole === role;
    };

    // Get wallet balance
    const getWalletBalance = async () => {
        if (!currentUser) return 0;

        try {
            return await walletService.getWalletBalance(currentUser.uid);
        } catch (error) {
            console.error("Error in getWalletBalance:", error);
            return 0;
        }
    };

    // Get transaction history
    const getTransactionHistory = async (limit = 50) => {
        if (!currentUser) return [];

        try {
            return await walletService.getTransactionHistory(currentUser.uid, limit) || [];
        } catch (error) {
            console.error("Error in getTransactionHistory:", error);
            return [];
        }
    };

    // Fund a product
    const fundProduct = async (productId, productName, amount) => {
        if (!currentUser) throw new Error("User not authenticated");

        try {
            const result = await walletService.fundProduct(
                currentUser.uid,
                productId,
                productName,
                parseFloat(amount)
            );

            // Update wallet state after funding
            const updatedWallet = await walletService.getUserWallet(currentUser.uid);
            setUserWallet(updatedWallet);

            // Update transaction history
            const updatedTransactions = await walletService.getTransactionHistory(currentUser.uid);
            setTransactions(updatedTransactions);

            return result;
        } catch (error) {
            console.error("Error funding product:", error);
            throw error;
        }
    };

    // When the auth state changes, update the user state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setAuthInitialized(true);

            if (user) {
                setCurrentUser(user);
                setLoading(true);
                await fetchUserData(user.uid);
            } else {
                setCurrentUser(null);
                setUserProfile(null);
                setUserRole(null);
                setUserWallet(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        currentUser,
        userProfile,
        userRole,
        userWallet,
        transactions,
        loading,
        authInitialized,
        hasRole,
        getWalletBalance,
        getTransactionHistory,
        fundProduct
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
