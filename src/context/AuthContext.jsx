import React, { useContext } from 'react';
import { useUser } from './UserContext'; // Updated import path

// Create a wrapper context that uses UserContext internally
const AuthContext = React.createContext();

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    // The issue is here: we can't call useUser() directly because it's undefined at this point
    // That's because the UserProvider needs to be rendered first, which happens in App.jsx

    // Instead of trying to use UserContext directly, we'll create a wrapper
    // that passes through the children and relies on the actual UserContext implementation

    return (
        <AuthContext.Provider value={{
            // These empty defaults will be replaced by the real implementation
            currentUser: null,
            userRoles: [],
            loading: true,
            error: null,

            // Default function implementations
            signup: async () => ({ success: false, error: 'Not implemented' }),
            login: async () => ({ success: false, error: 'Not implemented' }),
            logout: async () => ({ success: false, error: 'Not implemented' }),
            resetPassword: async () => ({ success: false, error: 'Not implemented' }),
            updateUserProfile: async () => ({ success: false, error: 'Not implemented' }),
            updateUserRoles: async () => ({ success: false, error: 'Not implemented' }),
            hasRole: () => false
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// Create a consumer component that will be used inside components that need auth
export const AuthConsumer = ({ children }) => {
    const userContext = useUser();
    const authContext = useContext(AuthContext);

    // Update the context value with the actual values from UserContext
    if (userContext) {
        authContext.currentUser = userContext.currentUser;
        authContext.userRoles = Array.isArray(userContext.userRole)
            ? userContext.userRole
            : userContext.userRole ? [userContext.userRole] : [];
        authContext.loading = userContext.loading;
        authContext.hasRole = userContext.hasRole;
        authContext.logout = userContext.signOut;
    }

    return children;
};

export default AuthContext;