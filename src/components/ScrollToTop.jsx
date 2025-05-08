import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component that automatically scrolls to top when route changes
 * This is a utility component that doesn't render anything to the DOM
 */
function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Scroll to top with smooth animation
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [pathname]);

    return null;
}

export default ScrollToTop;