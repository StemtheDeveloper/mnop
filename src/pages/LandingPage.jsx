import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';
import '../styles/LandingPage.css';

function LandingPage() {
  const [featuredProduct, setFeaturedProduct] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Mock news data (in a real app, this would come from an API or Firestore)
  const newsItems = [
    {
      id: 1,
      title: "Designer Showcase: Spring 2025 Collection",
      date: "April 15, 2025",
      image: "https://firebasestorage.googleapis.com/v0/b/m-nop-39b2f.appspot.com/o/news%2Fdesigner-showcase.jpg?alt=media",
      excerpt: "Explore our latest designer showcase featuring innovative products from emerging talent.",
      link: "/news/designer-showcase"
    },
    {
      id: 2,
      title: "New Manufacturing Partnership Announced",
      date: "April 10, 2025",
      image: "https://firebasestorage.googleapis.com/v0/b/m-nop-39b2f.appspot.com/o/news%2Fmanufacturing-partners.jpg?alt=media",
      excerpt: "M'NOP partners with leading sustainable manufacturers to bring eco-friendly products to market.",
      link: "/news/manufacturing-partnership"
    },
    {
      id: 3,
      title: "Investor Spotlight: Funding the Future",
      date: "April 5, 2025",
      image: "https://firebasestorage.googleapis.com/v0/b/m-nop-39b2f.appspot.com/o/news%2Finvestor-spotlight.jpg?alt=media",
      excerpt: "Learn about how our investors are helping bring innovative designs to life through crowdfunding.",
      link: "/news/investor-spotlight"
    }
  ];
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Fetch the most liked product for the featured section
        const productsRef = collection(db, 'products');

        // Query for active products with the highest likes count
        const featuredQuery = query(
          productsRef,
          where('status', '==', 'active'),
          orderBy('likesCount', 'desc'),
          limit(1)
        );

        let featuredSnapshot = await getDocs(featuredQuery);

        // If no products found with likes, try to get any active product
        if (featuredSnapshot.empty) {
          console.log("No featured products found based on likes, fetching any active product");
          const backupQuery = query(
            productsRef,
            where('status', '==', 'active'),
            limit(1)
          );
          featuredSnapshot = await getDocs(backupQuery);
        }

        if (!featuredSnapshot.empty) {
          setFeaturedProduct({
            id: featuredSnapshot.docs[0].id,
            ...featuredSnapshot.docs[0].data()
          });
        }

        // Query for recommended products (newest active products)
        const recommendedQuery = query(
          productsRef,
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(4)
        );

        const recommendedSnapshot = await getDocs(recommendedQuery);
        const recommendedList = recommendedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setRecommendedProducts(recommendedList);        // If we still don't have a featured product but have recommended products, use the first recommended product
        // We need to check featuredSnapshot.empty because featuredProduct state might not be updated yet (it's asynchronous)
        if (featuredSnapshot.empty && recommendedList.length > 0) {
          console.log("Using a recommended product as featured product");
          setFeaturedProduct(recommendedList[0]);
        }

        // As a last resort, create a default featured product
        if (featuredSnapshot.empty && recommendedList.length === 0) {
          console.log("Creating a default featured product");
          setFeaturedProduct({
            id: 'default-product',
            name: 'Featured Product',
            description: 'This is a placeholder for our featured product. Check back soon for actual featured products!',
            price: 99.99,
            imageUrl: 'https://placehold.co/600x400?text=Featured+Product',
            likesCount: 0,
            reviewCount: 0,
            averageRating: 0
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again.');
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Format price as currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price || 0);
  };

  // Handle navigation to product detail
  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <h1>Welcome to M'NOP</h1>
        <p>Connecting designers, manufacturers, and investors to bring innovative products to market.</p>
        <div className="hero-buttons">
          <Link to="/shop" className="btn-primary">Browse Products</Link>
          <Link to="/register" className="btn-secondary">Join Our Community</Link>
        </div>
      </div>

      {/* Featured Product Section */}
      <section className="featured-product-section">
        <h2>Featured Product</h2>

        {loading ? (
          <div className="loading-spinner">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : featuredProduct ? (
          <div className="featured-product-container">
            <div className="featured-product-image">
              <img
                src={
                  featuredProduct.imageUrls?.[0] ||
                  featuredProduct.imageUrl ||
                  'https://placehold.co/600x400?text=Featured+Product'
                }
                alt={featuredProduct.name}
              />
            </div>
            <div className="featured-product-content">
              <span className="featured-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                </svg>
                Most Popular
              </span>
              <h3 className="featured-product-title">{featuredProduct.name}</h3>
              <p className="featured-product-description">
                {featuredProduct.description?.length > 200
                  ? `${featuredProduct.description.substring(0, 200)}...`
                  : featuredProduct.description}
              </p>
              <div className="featured-product-details">
                <div className="featured-product-price">{formatPrice(featuredProduct.price)}</div>
                <div className="featured-product-stats">
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    {featuredProduct.likesCount || 0} likes
                  </span>
                  {featuredProduct.reviewCount > 0 && (
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      {featuredProduct.averageRating || 0} ({featuredProduct.reviewCount || 0} reviews)
                    </span>
                  )}
                </div>
              </div>
              <div className="featured-product-action">
                <button
                  className="btn-primary"
                  onClick={() => handleProductClick(featuredProduct.id)}
                >
                  View Product
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-products-message">No featured product available at this time.</div>
        )}
      </section>

      {/* News Section */}
      <section className="news-section">
        <h2>Latest News</h2>
        <div className="news-grid">
          {newsItems.map(news => (
            <div key={news.id} className="news-card">
              <div className="news-card-image">
                <img src={news.image} alt={news.title} />
              </div>
              <div className="news-card-content">
                <div className="news-card-date">{news.date}</div>
                <h3 className="news-card-title">{news.title}</h3>
                <p className="news-card-excerpt">{news.excerpt}</p>
                <Link to={news.link} className="news-card-link">Read More</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommended Products Section */}
      <section className="recommended-section">
        <h2>Recommended Products</h2>

        {loading ? (
          <div className="loading-spinner">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : recommendedProducts.length > 0 ? (
          <div className="recommended-grid">
            {recommendedProducts.map(product => (
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
                onClick={() => handleProductClick(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="no-products-message">No recommended products available at this time.</div>
        )}
      </section>
    </div>
  );
}

export default LandingPage;
