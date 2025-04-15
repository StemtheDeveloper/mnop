import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import walletService from '../services/walletService';
import interestService from '../services/interestService';

// Define user roles as constants
export const USER_ROLES = {
    CUSTOMER: 'customer',
    ADMIN: 'admin',
    DESIGNER: 'designer',
    MANUFACTURER: 'manufacturer',
    INVESTOR: 'investor'
};

// Create context
const UserContext = createContext();

// Provider component
export const UserProvider = ({ children }) => {
    // User state
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);
    const [walletLoading, setWalletLoading] = useState(false);
    const [interestSummary, setInterestSummary] = useState(null);
    const [interestLoading, setInterestLoading] = useState(false);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setAuthInitialized(true);

            if (user) {
                // Fetch user profile including roles
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserProfile(userData);
                        setUserRole(userData.roles || USER_ROLES.CUSTOMER); // Default to customer if no role specified

                        // Initialize wallet if it exists
                        if (userData.wallet) {
                            setWalletBalance(userData.wallet.balance);
                        } else {
                            // Initialize wallet
                            await initializeWallet();
                        }

                        // Load interest summary
                        loadInterestSummary();
                    } else {
                        // Create new user profile if it doesn't exist
                        const newUserData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            roles: [USER_ROLES.CUSTOMER], // Default role
                            createdAt: new Date()
                        };

                        await setDoc(doc(db, 'users', user.uid), newUserData);
                        setUserProfile(newUserData);
                        setUserRole(newUserData.roles);

                        // Initialize wallet for new user
                        await initializeWallet();
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            } else {
                // Reset user data when logged out
                setUserProfile(null);
                setUserRole(null);
                setWalletBalance(null);
                setInterestSummary(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Initialize wallet
    const initializeWallet = async () => {
        if (!currentUser) return;

        setWalletLoading(true);
        try {
            const { success, data, error } = await walletService.initializeWallet(currentUser.uid);

            if (success && data) {
                setWalletBalance(data.balance);

                // Also update the userProfile state
                setUserProfile(prev => ({
                    ...prev,
                    wallet: data
                }));
            } else {
                console.error("Error initializing wallet:", error);
            }
        } catch (err) {
            console.error("Error in initializeWallet:", err);
        } finally {
            setWalletLoading(false);
        }
    };

    // Load interest summary data
    const loadInterestSummary = useCallback(async () => {
        if (!currentUser) return;

        setInterestLoading(true);
        try {
            // Get interest summary
            const { success, data } = await interestService.getTotalInterestEarned(currentUser.uid);

            if (success) {
                setInterestSummary(data);
            }
        } catch (err) {
            console.error("Error loading interest summary:", err);
        } finally {
            setInterestLoading(false);
        }
    }, [currentUser]);

    // Get wallet balance
    const getWalletBalance = async () => {
        if (!currentUser) return 0;

        setWalletLoading(true);
        try {
            const { success, data, error } = await walletService.getWalletBalance(currentUser.uid);

            if (success && data) {
                setWalletBalance(data.balance);
                return data.balance;
            } else {
                console.error("Error getting wallet balance:", error);
                return 0;
            }
        } catch (err) {
            console.error("Error in getWalletBalance:", err);
            return 0;
        } finally {
            setWalletLoading(false);
        }
    };

    // Add credits to wallet
    const addCredits = async (amount, description) => {
        if (!currentUser) return false;

        setWalletLoading(true);
        try {
            const { success, data, error } = await walletService.addCredits(
                currentUser.uid,
                amount,
                description
            );

            if (success && data) {
                setWalletBalance(data.balance);
                return true;
            } else {
                console.error("Error adding credits:", error);
                return false;
            }
        } catch (err) {
            console.error("Error in addCredits:", err);
            return false;
        } finally {
            setWalletLoading(false);
        }
    };

    // Subtract credits from wallet
    const subtractCredits = async (amount, description) => {
        if (!currentUser) return false;

        setWalletLoading(true);
        try {
            const { success, data, error } = await walletService.subtractCredits(
                currentUser.uid,
                amount,
                description
            );

            if (success && data) {
                setWalletBalance(data.balance);
                return true;
            } else {
                console.error("Error subtracting credits:", error);
                return false;
            }
        } catch (err) {
            console.error("Error in subtractCredits:", err);
            return false;
        } finally {
            setWalletLoading(false);
        }
    };

    // Transfer credits to another user
    const transferCredits = async (toUserId, amount, description) => {
        if (!currentUser) return false;

        setWalletLoading(true);
        try {
            const { success, data, error } = await walletService.transferCredits(
                currentUser.uid,
                toUserId,
                amount,
                description
            );

            if (success && data) {
                setWalletBalance(data.from.balance);
                return true;
            } else {
                console.error("Error transferring credits:", error);
                return false;
            }
        } catch (err) {
            console.error("Error in transferCredits:", err);
            return false;
        } finally {
            setWalletLoading(false);
        }
    };

    // Get transaction history
    const getTransactionHistory = async (limit = 20) => {
        if (!currentUser) return [];

        try {
            const { success, data, error } = await walletService.getTransactionHistory(
                currentUser.uid,
                limit
            );

            if (success) {
                return data;
            } else {
                console.error("Error getting transaction history:", error);
                return [];
            }
        } catch (err) {
            console.error("Error in getTransactionHistory:", err);
            return [];
        }
    };

    // Check if user has a specific role
    const hasRole = (role) => {
        if (!userRole) return false;

        if (Array.isArray(userRole)) {
            return userRole.includes(role);
        }

        return userRole === role;
    };

    // Refresh all user financial data
    const refreshFinancialData = async () => {
        if (!currentUser) return;

        await Promise.all([
            getWalletBalance(),
            loadInterestSummary()
        ]);
    };

    // Add this function to the context
    const deleteUserAccount = async (password) => {
        if (!currentUser) return { success: false, error: "Not logged in" };

        try {
            // Re-authenticate the user
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);

            return { success: true };
        } catch (error) {
            console.error("Error during re-authentication:", error);
            return {
                success: false,
                error: error.message || "Authentication failed"
            };
        }
    };

    // Context value
    const value = {
        currentUser,
        userProfile,
        userRole,
        loading,
        authInitialized,
        walletBalance,
        walletLoading,
        interestSummary,
        interestLoading,
        hasRole,
        getWalletBalance,
        addCredits,
        subtractCredits,
        transferCredits,
        getTransactionHistory,
        refreshFinancialData,
        loadInterestSummary,
        deleteUserAccount  // Add the new function to the context
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Custom hook to use the UserContext
export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export default UserContext;
