import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
    console.log('UserProvider initializing');

    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
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

                // Standardize roles to always be an array
                let rolesArray = [];

                if (userData.roles && Array.isArray(userData.roles)) {
                    // Use the roles array directly if it exists
                    rolesArray = userData.roles;
                } else if (userData.role) {
                    // If only a string role exists, convert to array and update document
                    rolesArray = [userData.role];

                    // Update the document to standardize the format
                    try {
                        await updateDoc(docRef, {
                            roles: rolesArray
                            // No longer need to maintain the role field
                        });
                    } catch (updateError) {
                        console.error("Error updating roles format:", updateError);
                    }
                } else {
                    // Default role if none is set
                    rolesArray = ['customer'];

                    // Update the document to standardize the format
                    try {
                        await updateDoc(docRef, {
                            roles: rolesArray
                            // No longer need to maintain the role field
                        });
                    } catch (updateError) {
                        console.error("Error setting default roles:", updateError);
                    }
                }

                setUserRoles(rolesArray);
            } else {
                // Create a new user document if it doesn't exist
                const newUserData = {
                    uid,
                    email: auth.currentUser?.email || '',
                    displayName: auth.currentUser?.displayName || '',
                    photoURL: auth.currentUser?.photoURL || '',
                    roles: ['customer'], // Always use array format
                    // No longer include role field in new user documents
                    createdAt: serverTimestamp()
                };

                await setDoc(docRef, newUserData);
                setUserProfile(newUserData);
                setUserRoles(['customer']);
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

            // Don't fetch transactions here - we'll let the WalletPage handle this
            // This prevents double-fetching and performance issues
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUserProfile(null);
            setUserRoles([]);
        }
    };

    // Function to check if a user has a specific role
    const hasRole = (role) => {
        if (!userRoles || !userRoles.length) return false;
        return userRoles.includes(role);
    };

    // Function to check if a user has all specified roles
    const hasRoles = (roles) => {
        if (!userRoles || !userRoles.length) return false;
        if (!Array.isArray(roles)) roles = [roles]; // Convert single role to array
        return roles.every(role => userRoles.includes(role));
    };

    // Utility function to check if user has any of the provided roles
    const hasAnyRole = (roles) => {
        if (!userRoles || !userRoles.length) return false;
        return roles.some(role => userRoles.includes(role));
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
                parseFloat(amount),
                { name: productName } // Pass product data as an object containing the name
            );

            // Update wallet state after funding
            const updatedWallet = await walletService.getUserWallet(currentUser.uid);
            setUserWallet(updatedWallet);

            // Don't update all transactions here - let the WalletPage handle its own transaction updates
            // This prevents duplicate requests causing performance issues

            return result;
        } catch (error) {
            console.error("Error funding product:", error);
            throw error;
        }
    };

    // Add user role function
    const addUserRole = async (roleId, userId = null) => {
        try {
            const targetUserId = userId || currentUser?.uid;
            if (!targetUserId) throw new Error("No user ID provided");

            const userRef = doc(db, "users", targetUserId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) throw new Error("User document not found");

            const userData = userSnap.data();
            let currentRoles = [];

            // Get existing roles
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            }

            // Check if role already exists
            if (currentRoles.includes(roleId)) return true;

            // Add the new role
            currentRoles.push(roleId);

            // Update document with new roles
            await updateDoc(userRef, {
                roles: currentRoles,
                updatedAt: new Date()
                // No longer updating the legacy role field
            });

            // If this is the current user, update local state
            if (targetUserId === currentUser?.uid) {
                setUserRoles(currentRoles);
                await refreshUserData();
            }

            return true;
        } catch (error) {
            console.error("Error adding role:", error);
            return false;
        }
    };

    // Remove user role function
    const removeUserRole = async (roleId, userId = null) => {
        try {
            const targetUserId = userId || currentUser?.uid;
            if (!targetUserId) throw new Error("No user ID provided");

            // Never allow removing the admin role
            if (roleId === 'admin') {
                console.warn("Cannot remove admin role");
                return false;
            }

            const userRef = doc(db, "users", targetUserId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) throw new Error("User document not found");

            const userData = userSnap.data();
            let currentRoles = [];

            // Get existing roles
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                return false; // No roles to remove
            }

            // Check if role exists
            if (!currentRoles.includes(roleId)) return false;

            // Remove the role
            const newRoles = currentRoles.filter(role => role !== roleId);

            // Ensure there's at least one role (default to customer)
            if (newRoles.length === 0) {
                newRoles.push('customer');
            }

            // Update document with new roles
            await updateDoc(userRef, {
                roles: newRoles,
                updatedAt: new Date()
                // No longer updating the legacy role field
            });

            // If this is the current user, update local state
            if (targetUserId === currentUser?.uid) {
                setUserRoles(newRoles);
                await refreshUserData();
            }

            return true;
        } catch (error) {
            console.error("Error removing role:", error);
            return false;
        }
    };

    // Set primary role function
    const setPrimaryRole = async (roleId, userId = null) => {
        try {
            const targetUserId = userId || currentUser?.uid;
            if (!targetUserId) throw new Error("No user ID provided");

            const userRef = doc(db, "users", targetUserId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) throw new Error("User document not found");

            const userData = userSnap.data();
            let currentRoles = [];

            // Get existing roles
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                return false; // No roles to update
            }

            // Check if role exists
            if (!currentRoles.includes(roleId)) return false;

            // If user has admin role and trying to set a different role as primary, deny the operation
            // This ensures admin remains primary if the user has that role
            if (currentRoles.includes('admin') && roleId !== 'admin') {
                console.warn("Cannot change primary role: admin must remain primary");
                return false;
            }

            // Reorder roles array to put the primary role first
            const newRoles = [
                roleId,
                ...currentRoles.filter(role => role !== roleId)
            ];

            // Update document with new roles order
            await updateDoc(userRef, {
                roles: newRoles,
                updatedAt: new Date()
                // No longer updating the legacy role field
            });

            // If this is the current user, update local state
            if (targetUserId === currentUser?.uid) {
                setUserRoles(newRoles);
                await refreshUserData();
            }

            return true;
        } catch (error) {
            console.error("Error setting primary role:", error);
            return false;
        }
    };

    // Custom sign out function
    const userSignOut = async () => {
        try {
            await firebaseSignOut(auth);
            // Clear user data
            setCurrentUser(null);
            setUserProfile(null);
            setUserRoles([]);
            setUserWallet(null);

            // Return success for handling navigation in components
            return { success: true };
        } catch (error) {
            console.error("Sign out error:", error);
            return { success: false, error };
        }
    };

    // When the auth state changes, update the user state
    useEffect(() => {
        // Ensure auth is initialized
        setLoading(true);

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setAuthInitialized(true);

            if (user) {
                setCurrentUser(user);
                await fetchUserData(user.uid);
            } else {
                setCurrentUser(null);
                setUserProfile(null);
                setUserRoles([]);
                setUserWallet(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserData = async () => {
        if (currentUser) {
            try {
                setLoading(true);
                await fetchUserData(currentUser.uid);
            } finally {
                setLoading(false);
            }
        }
    };

    const value = {
        user: currentUser, // Make sure we expose 'user' for compatibility
        currentUser,
        userProfile,
        // No longer exposing the legacy userRole field
        userRoles, // Using only the standardized array format
        userWallet,
        transactions,
        loading,
        authInitialized,
        isLoggedIn: !!currentUser, // Explicitly provide login status
        hasRole,
        hasRoles,
        hasAnyRole,
        getWalletBalance,
        getTransactionHistory,
        fundProduct,
        signOut: userSignOut,
        refreshUserData,
        addUserRole,
        removeUserRole,
        setPrimaryRole
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};
