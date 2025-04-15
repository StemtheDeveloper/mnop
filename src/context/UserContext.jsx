import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

// Define the user roles
export const USER_ROLES = {
    ADMIN: 'admin',
    INVESTOR: 'investor',
    DESIGNER: 'designer',
    MANUFACTURER: 'manufacturer',
    CUSTOMER: 'customer'
};

// Create the context
const UserContext = createContext();

// Context provider component
export const UserProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);
    const auth = getAuth();
    const db = getFirestore();

    // Fetch user data and role
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Get user role from Firestore
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserRole(userData.role || USER_ROLES.CUSTOMER);
                        setUserProfile(userData);
                    } else {
                        // If user document doesn't exist, create it with default role
                        const defaultUserData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            role: USER_ROLES.CUSTOMER,
                            createdAt: new Date()
                        };

                        await setDoc(userRef, defaultUserData);
                        setUserRole(USER_ROLES.CUSTOMER);
                        setUserProfile(defaultUserData);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                setUserRole(null);
                setUserProfile(null);
            }

            setLoading(false);
            setAuthInitialized(true);
        });

        return unsubscribe;
    }, [auth, db]);

    // Update user role in Firestore
    const updateUserRole = async (uid, newRole) => {
        try {
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, { role: newRole }, { merge: true });

            if (uid === currentUser?.uid) {
                setUserRole(newRole);
                setUserProfile(prev => ({ ...prev, role: newRole }));
            }

            return true;
        } catch (error) {
            console.error("Error updating user role:", error);
            return false;
        }
    };

    // Update user profile in Firestore
    const updateUserProfile = async (profileData) => {
        if (!currentUser) return false;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, profileData, { merge: true });
            setUserProfile(prev => ({ ...prev, ...profileData }));
            return true;
        } catch (error) {
            console.error("Error updating profile:", error);
            return false;
        }
    };

    // Check if user has specific role
    const hasRole = (role) => {
        if (!currentUser) return false;
        if (role === USER_ROLES.ADMIN && userRole === USER_ROLES.ADMIN) {
            return true;
        }
        return userRole === role;
    };

    // Check if user is authenticated
    const isAuthenticated = () => {
        return !!currentUser;
    };

    const value = {
        currentUser,
        userRole,
        userProfile,
        loading,
        authInitialized,
        updateUserRole,
        updateUserProfile,
        hasRole,
        isAuthenticated,
        isAdmin: userRole === USER_ROLES.ADMIN,
        isInvestor: userRole === USER_ROLES.INVESTOR,
        isDesigner: userRole === USER_ROLES.DESIGNER,
        isManufacturer: userRole === USER_ROLES.MANUFACTURER,
        isCustomer: userRole === USER_ROLES.CUSTOMER,
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

// Custom hook to use the user context
export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export default UserContext;
