import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EnhancedSearchInput from '../components/EnhancedSearchInput';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';


const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('query') || '';
    const categoryFilter = searchParams.get('category') || '';
    const navigate = useNavigate();

    const [closeMatches, setCloseMatches] = useState([]);
    const [fuzzyMatches, setFuzzyMatches] = useState([]);
    const [categoryMatches, setCategoryMatches] = useState([]);
    const [allCategories, setAllCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(categoryFilter);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortOption, setSortOption] = useState('relevance');

    // Calculate similarity score between two strings (Levenshtein distance)
    const calculateSimilarity = (str1, str2) => {
        if (!str1 || !str2) return 0;

        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();

        const track = Array(str2.length + 1).fill(null).map(() =>
            Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) {
            track[0][i] = i;
        }

        for (let j = 0; j <= str2.length; j++) {
            track[j][0] = j;
        }

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator
                );
            }
        }

        // Convert distance to similarity (0-100%)
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 100; // Both strings empty

        const distance = track[str2.length][str1.length];
        return ((maxLength - distance) / maxLength) * 100;
    };

    // Check if a string contains a matching word or part of a word
    const containsPartialWordMatch = (text, searchWords) => {
        if (!text) return false;
        text = text.toLowerCase();

        // Check each search word
        return searchWords.some(word => {
            // Word must be at least 3 characters (not "a" or "the")
            if (word.length < 3) return false;

            // Check for partial word matches (substring)
            return text.includes(word);
        });
    };

    // Original strict word boundary matching function (now only used for exact matches)
    const containsCompleteWord = (text, searchWords) => {
        if (!text) return false;
        text = text.toLowerCase();

        // Check each search word
        return searchWords.some(word => {
            // Word must be at least 3 characters (not "a" or "the")
            if (word.length < 3) return false;

            // Look for word boundaries around the match
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(text);
        });
    }; useEffect(() => {
        // Load all available categories for filtering
        const fetchCategories = async () => {
            try {
                // First, get all category documents for name mapping
                const categoriesRef = collection(db, 'categories');
                const categoriesSnapshot = await getDocs(categoriesRef);

                // Create a mapping of category IDs to names
                const categoryMapping = {};
                categoriesSnapshot.docs.forEach(doc => {
                    const categoryData = doc.data();
                    if (categoryData && categoryData.name) {
                        categoryMapping[doc.id] = categoryData.name;
                    }
                });

                // Then fetch products to get the used categories
                const productsRef = collection(db, 'products');
                const q = query(
                    productsRef,
                    where('status', '==', 'active'),
                    limit(100)
                );

                const snapshot = await getDocs(q);

                // Extract unique categories with their IDs and names
                const categoriesSet = new Set();
                const categoryObjects = [];

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    // Handle single category field (legacy)
                    if (data.category && !categoriesSet.has(data.category)) {
                        categoriesSet.add(data.category);
                        categoryObjects.push({
                            id: data.category,
                            name: categoryMapping[data.category] || data.category // Fallback to ID if name not found
                        });
                    }

                    // Handle categories array (current approach)
                    if (data.categories && Array.isArray(data.categories)) {
                        data.categories.forEach(catId => {
                            if (catId && !categoriesSet.has(catId)) {
                                categoriesSet.add(catId);
                                categoryObjects.push({
                                    id: catId,
                                    name: categoryMapping[catId] || catId // Fallback to ID if name not found
                                });
                            }
                        });
                    }
                });

                // Sort categories by name for better UI
                categoryObjects.sort((a, b) => a.name.localeCompare(b.name));
                setAllCategories(categoryObjects);
            } catch (err) {
                console.error('Error fetching categories:', err);
            }
        };

        fetchCategories();
    }, []);

    // Main search effect
    useEffect(() => {
        // Set selected category from URL parameter
        if (categoryFilter) {
            setSelectedCategory(categoryFilter);
        }

        const fetchProducts = async () => {
            if (!searchQuery.trim() && !categoryFilter) {
                setCloseMatches([]);
                setFuzzyMatches([]);
                setCategoryMatches([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Split search query into words for better matching
                const searchWords = searchQuery.toLowerCase()
                    .split(/\s+/)
                    .filter(word => word.length > 0);

                console.log('Searching for:', searchWords, 'Category:', categoryFilter);

                // Create a query against the products collection
                const productsRef = collection(db, 'products');

                // Start with base query for active products
                let baseQuery = query(
                    productsRef,
                    where('status', '==', 'active')
                );

                // Add category filter if specified
                if (categoryFilter) {
                    // Try to get products by exact category match
                    const categoryMatchesRef = collection(db, 'products');
                    const categoryQuery = query(
                        categoryMatchesRef,
                        where('status', '==', 'active'),
                        where('categories', 'array-contains', categoryFilter)
                    );

                    const categorySnapshot = await getDocs(categoryQuery);
                    const categoryMatchProducts = categorySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    setCategoryMatches(categoryMatchProducts);

                    if (!searchQuery.trim()) {
                        setCloseMatches([]);
                        setFuzzyMatches([]);
                        setLoading(false);
                        return;
                    }
                }

                // Fetch all active products for text search
                const q = query(
                    productsRef,
                    where('status', '==', 'active'),
                    orderBy('createdAt', 'desc'),
                    limit(100) // Increased limit to find more potential matches
                );

                console.log('Executing Firestore query for all active products...');
                const querySnapshot = await getDocs(q);
                console.log(`Found ${querySnapshot.size} total products in database`);

                const closeMatchesArray = [];
                const fuzzyMatchesArray = [];

                // Process all products
                querySnapshot.forEach((doc) => {
                    const productData = {
                        id: doc.id,
                        ...doc.data()
                    };

                    // Skip if we're filtering by category and product doesn't match
                    if (categoryFilter) {
                        const productCategories = productData.categories || [];
                        const productCategory = productData.category || '';

                        if (!productCategories.includes(categoryFilter) && productCategory !== categoryFilter) {
                            return;
                        }
                    }

                    // Fields to check for matches
                    const nameText = productData.name || '';
                    const descText = productData.description || '';
                    const categoryText = productData.category || '';
                    const tagsText = (productData.tags || []).join(' ');

                    // Check for close matches (partial word matches)
                    if (
                        containsPartialWordMatch(nameText, searchWords) ||
                        containsPartialWordMatch(descText, searchWords) ||
                        containsPartialWordMatch(categoryText, searchWords) ||
                        (productData.tags && productData.tags.some(tag =>
                            containsPartialWordMatch(tag, searchWords)
                        ))
                    ) {
                        // Calculate relevance score for sorting
                        let relevanceScore = 0;

                        // Name match is highest priority
                        if (containsCompleteWord(nameText, searchWords)) {
                            relevanceScore += 100;
                        }
                        else if (containsPartialWordMatch(nameText, searchWords)) {
                            relevanceScore += 50;
                        }

                        // Description match
                        if (containsPartialWordMatch(descText, searchWords)) {
                            relevanceScore += 20;
                        }

                        // Category match
                        if (containsPartialWordMatch(categoryText, searchWords)) {
                            relevanceScore += 30;
                        }

                        // Tags match
                        if (productData.tags && productData.tags.some(tag => containsPartialWordMatch(tag, searchWords))) {
                            relevanceScore += 25;
                        }

                        closeMatchesArray.push({
                            ...productData,
                            relevanceScore
                        });
                    }
                    // Calculate similarity for fuzzy matching
                    else if (searchQuery.trim()) {
                        // Get highest similarity score from any field
                        const nameSimilarity = calculateSimilarity(searchQuery, nameText);
                        const descSimilarity = calculateSimilarity(searchQuery, descText);
                        const categorySimilarity = calculateSimilarity(searchQuery, categoryText);
                        const tagsSimilarity = calculateSimilarity(searchQuery, tagsText);

                        const highestSimilarity = Math.max(
                            nameSimilarity,
                            descSimilarity,
                            categorySimilarity,
                            tagsSimilarity
                        );

                        // Only include if similarity is above threshold (30%)
                        if (highestSimilarity > 30) {
                            fuzzyMatchesArray.push({
                                ...productData,
                                similarity: highestSimilarity,
                                relevanceScore: highestSimilarity / 2 // Convert to score comparable with close matches
                            });
                        }
                    }
                });

                // Apply sorting based on selected option
                const sortProducts = (products) => {
                    switch (sortOption) {
                        case 'relevance':
                            return products.sort((a, b) => b.relevanceScore - a.relevanceScore);
                        case 'price-low':
                            return products.sort((a, b) => (a.price || 0) - (b.price || 0));
                        case 'price-high':
                            return products.sort((a, b) => (b.price || 0) - (a.price || 0));
                        case 'newest':
                            return products.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
                        case 'rating':
                            return products.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
                        default:
                            return products;
                    }
                };

                // Sort the results
                const sortedCloseMatches = sortProducts(closeMatchesArray);
                const sortedFuzzyMatches = sortProducts(fuzzyMatchesArray);

                console.log(`Found ${sortedCloseMatches.length} close matches and ${sortedFuzzyMatches.length} fuzzy matches`);

                setCloseMatches(sortedCloseMatches);
                setFuzzyMatches(sortedFuzzyMatches);
            } catch (err) {
                console.error('Error searching products:', err);
                setError('Failed to search products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [searchQuery, categoryFilter, sortOption]);

    const handleCategoryChange = (category) => {
        setSelectedCategory(category);

        // Update URL with new category parameter
        const newSearchParams = new URLSearchParams();
        if (searchQuery) {
            newSearchParams.set('query', searchQuery);
        }

        if (category) {
            newSearchParams.set('category', category);
        }

        window.history.pushState(
            {},
            '',
            `${window.location.pathname}?${newSearchParams.toString()}`
        );
    };

    const handleSortChange = (e) => {
        setSortOption(e.target.value);
    };    // Handle clicking on a product to navigate to its detail page    
    const handleProductClick = (productId) => {
        navigate(`/product/${productId}`);
    };

    // Helper function to get category name from ID
    const getCategoryName = (categoryId) => {
        const category = allCategories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    };

    const totalResults = closeMatches.length + fuzzyMatches.length + (categoryFilter && !searchQuery ? categoryMatches.length : 0);

    const displayedProducts = categoryFilter && !searchQuery ?
        categoryMatches :
        [...closeMatches, ...fuzzyMatches];

    return (
        <div className="search-page-container">
            <div className="search-header">
                <h1>Search Results</h1>
                <div className="search-box-container">
                    <EnhancedSearchInput
                        placeholder={searchQuery || "Search for products..."}
                        className="search-page-input"
                    />
                </div>                <p className="search-summary">
                    {searchQuery ? (
                        `Showing results for "${searchQuery}"${categoryFilter ? ` in ${getCategoryName(categoryFilter)}` : ''} (${totalResults} products found)`
                    ) : categoryFilter ? (
                        `Browsing ${getCategoryName(categoryFilter)} (${categoryMatches.length} products)`
                    ) : (
                        'Enter a search term to find products'
                    )}
                </p>
            </div>

            <div className="search-filters">
                <div className="filter-section category-filter">
                    <label htmlFor="category-select">Filter by Category:</label>                    <select
                        id="category-select"
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {allCategories.map(category => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-section sort-filter">
                    <label htmlFor="sort-select">Sort by:</label>
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={handleSortChange}
                    >
                        <option value="relevance">Relevance</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="newest">Newest First</option>
                        <option value="rating">Highest Rated</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Searching products...</p>
                </div>
            ) : error ? (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            ) : totalResults === 0 ? (
                <div className="no-results">
                    <h2>No products found</h2>
                    <p>Try searching with different keywords or browse our shop.</p>
                </div>
            ) : (
                <div className="search-results-container">
                    <div className="search-results-grid">
                        {displayedProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                id={product.id}
                                image={product.imageUrl || (product.imageUrls && product.imageUrls[0])}
                                images={product.imageUrls || []}
                                title={product.name || 'Unnamed Product'}
                                description={product.description?.slice(0, 100) || 'No description'}
                                price={product.price || 0}
                                rating={product.averageRating || 0}
                                reviewCount={product.reviewCount || 0}
                                viewers={product.activeViewers || 0}
                                fundingProgress={product.currentFunding ? (product.currentFunding / product.fundingGoal) * 100 : 0}
                                currentFunding={product.currentFunding || 0}
                                fundingGoal={product.fundingGoal || 0}
                                status={product.status}
                                designerId={product.designerId}
                                product={product}
                                onClick={() => handleProductClick(product.id)}
                            />
                        ))}                </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;