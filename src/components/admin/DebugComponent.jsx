import React, { useEffect } from 'react';
import { useUser } from '../../context/UserContext';

const DebugComponent = () => {
    const userContext = useUser();

    useEffect(() => {
        console.log('Debug component mounted');
        console.log('User context in debug component:', userContext);

        // Check if user context exists but has an empty hasRole function
        if (userContext && userContext.hasRole) {
            console.log('hasRole exists, testing it:', userContext.hasRole('admin'));
        } else {
            console.log('hasRole does not exist on userContext');
        }
    }, [userContext]);

    return null; // This component doesn't render anything
};

export default DebugComponent;
