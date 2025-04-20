import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
    sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                // Get user roles from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserRoles(userData.roles || []);
                    } else {
                        // Create user document if it doesn't exist
                        setUserRoles(['user']);
                        await setDoc(doc(db, 'users', user.uid), {
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            roles: ['user'],
                            createdAt: new Date()
                        });
                    }
                } catch (err) {
                    console.error('Error fetching user data:', err);
                    setUserRoles(['user']);
                }
            } else {
                setUserRoles([]);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Sign up function
    const signup = async (email, password, displayName) => {
        try {
            setError('');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Update profile with display name
            if (displayName) {
                await updateProfile(userCredential.user, { displayName });
            }

            // Send email verification
            await sendEmailVerification(userCredential.user);

            // Create user document in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email,
                displayName: displayName || '',
                photoURL: '',
                roles: ['user'],
                createdAt: new Date()
            });

            return { success: true, user: userCredential.user };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Sign in function
    const login = async (email, password) => {
        try {
            setError('');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Sign out function
    const logout = async () => {
        try {
            setError('');
            await signOut(auth);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Password reset function
    const resetPassword = async (email) => {
        try {
            setError('');
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Update user profile
    const updateUserProfile = async (userProfile) => {
        try {
            setError('');
            const { displayName, photoURL, ...otherData } = userProfile;

            // Update auth profile
            if (currentUser) {
                if (displayName || photoURL) {
                    await updateProfile(currentUser, {
                        displayName: displayName || currentUser.displayName,
                        photoURL: photoURL || currentUser.photoURL
                    });
                }

                // Update Firestore user data
                const userRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userRef, {
                    ...otherData,
                    ...(displayName && { displayName }),
                    ...(photoURL && { photoURL }),
                    updatedAt: new Date()
                });
            }

            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Update user roles
    const updateUserRoles = async (userId, roles) => {
        try {
            setError('');
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, { roles });

            // Update local roles if it's the current user
            if (currentUser && currentUser.uid === userId) {
                setUserRoles(roles);
            }

            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    // Check if user has a specific role
    const hasRole = (role) => {
        if (!userRoles.length) return false;

        if (Array.isArray(role)) {
            return role.some(r => userRoles.includes(r));
        }

        return userRoles.includes(role) || userRoles.includes('admin');
    };

    const value = {
        currentUser,
        userRoles,
        loading,
        error,
        signup,
        login,
        logout,
        resetPassword,
        updateUserProfile,
        updateUserRoles,
        hasRole
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
