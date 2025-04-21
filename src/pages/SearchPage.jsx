import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/SearchPage.css';

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('query') || '';

    const [closeMatches, setCloseMatches] = useState([]);
    const [fuzzyMatches, setFuzzyMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
    };

    useEffect(() => {
        const fetchProducts = async () => {
            if (!searchQuery.trim()) {
                setCloseMatches([]);
                setFuzzyMatches([]);
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

                console.log('Searching for:', searchWords);

                // Create a query against the products collection
                const productsRef = collection(db, 'products');

                // Fetch all active products
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
                        closeMatchesArray.push(productData);
                    }
                    // Calculate similarity for fuzzy matching
                    else {
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
                                similarity: highestSimilarity
                            });
                        }
                    }
                });

                // Sort fuzzy matches by similarity (most similar first)
                fuzzyMatchesArray.sort((a, b) => b.similarity - a.similarity);

                console.log(`Found ${closeMatchesArray.length} close matches and ${fuzzyMatchesArray.length} fuzzy matches`);

                if (closeMatchesArray.length > 0) {
                    console.log('Sample close match:', closeMatchesArray[0].name);
                }

                if (fuzzyMatchesArray.length > 0) {
                    console.log('Sample fuzzy match:', fuzzyMatchesArray[0].name, 'with similarity', fuzzyMatchesArray[0].similarity.toFixed(2) + '%');
                }

                setCloseMatches(closeMatchesArray);
                setFuzzyMatches(fuzzyMatchesArray);
            } catch (err) {
                console.error('Error searching products:', err);
                setError('Failed to search products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [searchQuery]);

    const totalResults = closeMatches.length + fuzzyMatches.length;

    return (
        <div className="search-page-container">
            <div className="search-header">
                <h1>Search Results</h1>
                <p>
                    {searchQuery ? (
                        `Showing results for "${searchQuery}" (${totalResults} products found)`
                    ) : (
                        'Enter a search term to find products'
                    )}
                </p>
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
                <>
                    {closeMatches.length > 0 && (
                        <div className="search-section">
                            <h2 className="section-title">Close Matches</h2>
                            <p className="section-description">Products that directly match your search terms</p>
                            <div className="search-results">
                                {closeMatches.map(product => (
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
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {fuzzyMatches.length > 0 && (
                        <div className="search-section">
                            <h2 className="section-title">Similar Results</h2>
                            <p className="section-description">Products that might be relevant to your search</p>
                            <div className="search-results">
                                {fuzzyMatches.map(product => (
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
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SearchPage;