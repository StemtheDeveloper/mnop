import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, startAt, endAt } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/EnhancedSearchInput.css';

const EnhancedSearchInput = ({ placeholder = "Search products...", className = "" }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [popularProducts, setPopularProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchContainerRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Load recent searches from localStorage on component mount
    useEffect(() => {
        const storedSearches = localStorage.getItem('recentSearches');
        if (storedSearches) {
            setRecentSearches(JSON.parse(storedSearches).slice(0, 5));
        }

        // Load popular products and categories once on mount
        loadPopularProducts();
        loadCategories();

        // Add click outside listener to close suggestions
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load popular products from Firestore
    const loadPopularProducts = async () => {
        try {
            const productsRef = collection(db, 'products');
            const q = query(
                productsRef,
                where('status', '==', 'active'),
                orderBy('reviewCount', 'desc'), // Sort by popularity
                limit(5) // Get top 5 products
            );

            const snapshot = await getDocs(q);

            const products = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                category: doc.data().category,
                imageUrl: doc.data().imageUrl || (doc.data().imageUrls && doc.data().imageUrls[0]),
                type: 'product'
            }));

            setPopularProducts(products);
        } catch (error) {
            console.error('Error loading popular products:', error);
        }
    };

    // Load product categories
    const loadCategories = async () => {
        try {
            // Get unique categories from products
            const productsRef = collection(db, 'products');
            const q = query(
                productsRef,
                where('status', '==', 'active'),
                limit(100)
            );

            const snapshot = await getDocs(q);

            // Extract and deduplicate categories
            const uniqueCategories = new Set();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.category) uniqueCategories.add(data.category);
                if (data.categories && Array.isArray(data.categories)) {
                    data.categories.forEach(cat => uniqueCategories.add(cat));
                }
            });

            setCategories(Array.from(uniqueCategories).map(cat => ({
                id: cat.toLowerCase().replace(/\s+/g, '-'),
                name: cat,
                type: 'category'
            })));
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    // Search for products matching the input
    const searchProducts = async (term) => {
        if (!term || term.length < 2) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            // For exact prefix matching
            const termLower = term.toLowerCase();
            const termUpperBound = termLower + '\uf8ff'; // Unicode character after most characters

            // Search products by name prefix
            const productsRef = collection(db, 'products');
            const productQuery = query(
                productsRef,
                where('status', '==', 'active'),
                where('searchName', '>=', termLower),
                where('searchName', '<=', termUpperBound),
                orderBy('searchName'),
                limit(5)
            );

            const productSnapshot = await getDocs(productQuery);

            // Get matching products
            const productMatches = productSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().name,
                category: doc.data().category,
                imageUrl: doc.data().imageUrl || (doc.data().imageUrls && doc.data().imageUrls[0]),
                type: 'product'
            }));

            // Search for category matches
            const categoryMatches = categories
                .filter(cat => cat.name.toLowerCase().includes(termLower))
                .slice(0, 3)
                .map(cat => ({
                    ...cat,
                    highlight: highlightMatch(cat.name, term)
                }));

            // Combine results
            const allSuggestions = [
                ...productMatches.map(product => ({
                    ...product,
                    highlight: highlightMatch(product.name, term)
                })),
                ...categoryMatches
            ];

            setSuggestions(allSuggestions.slice(0, 8)); // Limit total suggestions
        } catch (error) {
            console.error('Error searching products:', error);
        } finally {
            setLoading(false);
        }
    };

    // Highlight matching text in suggestion
    const highlightMatch = (text, query) => {
        if (!query) return text;

        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    // Debounce search to avoid too many requests
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (searchTerm.trim()) {
                searchProducts(searchTerm);
            } else {
                setSuggestions([]);
            }
            setSelectedIndex(-1);
        }, 200); // Reduced debounce time for more responsive autocomplete

        return () => clearTimeout(debounceTimer);
    }, [searchTerm]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowSuggestions(true);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();

        // If an item is selected in the dropdown, use that
        if (selectedIndex >= 0 && suggestions.length > 0) {
            const selected = suggestions[selectedIndex];
            handleSuggestionClick(selected);
            return;
        }

        if (searchTerm.trim()) {
            // Save to recent searches
            saveRecentSearch(searchTerm);
            // Navigate to search page
            navigate(`/search?query=${encodeURIComponent(searchTerm.trim())}`);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (item) => {
        if (item.type === 'category') {
            // Navigate to category page or filtered search
            navigate(`/search?category=${encodeURIComponent(item.name)}`);
            saveRecentSearch(item.name);
            setSearchTerm(item.name);
        } else {
            // Handle product suggestion click
            saveRecentSearch(item.name);
            navigate(`/search?query=${encodeURIComponent(item.name.trim())}`);
            setSearchTerm(item.name);
        }
        setShowSuggestions(false);
    };

    const handleKeyDown = (e) => {
        // Handle keyboard navigation in dropdown
        const suggestionsLength = suggestions.length +
            (recentSearches.length > 0 ? recentSearches.length : 0) +
            (searchTerm.length === 0 && popularProducts.length > 0 ? popularProducts.length : 0);

        if (!showSuggestions || suggestionsLength === 0) return;

        // Down arrow
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestionsLength);
        }
        // Up arrow
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev <= 0 ? suggestionsLength - 1 : prev - 1));
        }
        // Escape key
        else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const saveRecentSearch = (term) => {
        const storedSearches = localStorage.getItem('recentSearches');
        let searches = storedSearches ? JSON.parse(storedSearches) : [];

        // Remove if exists already (to move it to the top)
        searches = searches.filter(search => search.toLowerCase() !== term.toLowerCase());

        // Add to the beginning
        searches.unshift(term);

        // Keep only the last 10 searches
        searches = searches.slice(0, 10);

        // Save back to localStorage
        localStorage.setItem('recentSearches', JSON.stringify(searches));

        // Update state with the first 5 searches
        setRecentSearches(searches.slice(0, 5));
    };

    const clearRecentSearches = () => {
        localStorage.removeItem('recentSearches');
        setRecentSearches([]);
    };

    // Get all items to be shown in the dropdown for keyboard navigation
    const getAllItems = () => {
        const items = [...suggestions];
        if (recentSearches.length > 0) {
            items.push(...recentSearches.map(search => ({ name: search, type: 'recent' })));
        }
        if (searchTerm.length === 0 && popularProducts.length > 0) {
            items.push(...popularProducts);
        }
        return items;
    };

    // Render item with highlighted text
    const renderHighlightedText = (html) => {
        return { __html: html };
    };

    return (
        <div className={`enhanced-search-container ${className}`} ref={searchContainerRef}>
            <form onSubmit={handleFormSubmit} className="enhanced-search-form">
                <input
                    ref={inputRef}
                    type="search"
                    placeholder={placeholder}
                    className="enhanced-search-input"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    className="enhanced-search-button"
                >
                    Search
                </button>
            </form>

            {showSuggestions && (
                <div className="search-suggestions-dropdown">
                    {loading && <div className="search-loading">Loading suggestions...</div>}

                    {!loading && suggestions.length > 0 && (
                        <div className="suggestion-section">
                            <h4>Suggestions</h4>
                            <ul>
                                {suggestions.map((item, index) => (
                                    <li
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleSuggestionClick(item)}
                                        className={selectedIndex === index ? 'selected-suggestion' : ''}
                                    >
                                        <span className={`suggestion-item ${item.type}`}>
                                            {item.type === 'category' ? (
                                                <>
                                                    <i className="fa fa-tag" aria-hidden="true"></i>
                                                    <span dangerouslySetInnerHTML={renderHighlightedText(item.highlight)}></span>
                                                </>
                                            ) : (
                                                <>
                                                    {item.imageUrl && (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.name}
                                                            className="suggestion-thumbnail"
                                                        />
                                                    )}
                                                    <span dangerouslySetInnerHTML={renderHighlightedText(item.highlight)}></span>
                                                    {item.category && <span className="suggestion-category">{item.category}</span>}
                                                </>
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!loading && searchTerm.trim().length > 0 && suggestions.length === 0 && (
                        <div className="no-suggestions">
                            No matching products found
                        </div>
                    )}

                    {recentSearches.length > 0 && (
                        <div className="suggestion-section">
                            <div className="suggestion-header">
                                <h4>Recent Searches</h4>
                                <button className="clear-recent" onClick={clearRecentSearches}>Clear</button>
                            </div>
                            <ul>
                                {recentSearches.map((search, index) => (
                                    <li
                                        key={`recent-${index}`}
                                        onClick={() => handleSuggestionClick({ name: search, type: 'recent' })}
                                        className={selectedIndex === suggestions.length + index ? 'selected-suggestion' : ''}
                                    >
                                        <span className="suggestion-item">
                                            <i className="fa fa-history" aria-hidden="true"></i> {search}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!searchTerm && popularProducts.length > 0 && (
                        <div className="suggestion-section popular-products">
                            <h4>Popular Products</h4>
                            <ul>
                                {popularProducts.map((product, index) => (
                                    <li
                                        key={product.id}
                                        onClick={() => handleSuggestionClick(product)}
                                        className={selectedIndex === suggestions.length + recentSearches.length + index ? 'selected-suggestion' : ''}
                                    >
                                        <span className="suggestion-item">
                                            {product.imageUrl && (
                                                <img
                                                    src={product.imageUrl}
                                                    alt={product.name}
                                                    className="suggestion-thumbnail"
                                                />
                                            )}
                                            <span>{product.name}</span>
                                            {product.category && <span className="suggestion-category">{product.category}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EnhancedSearchInput;