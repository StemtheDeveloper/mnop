import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';

const MyProductsTab = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, hasRole } = useUser();

  // Parameters from URL
  const params = useParams();
  const userId = params.id || currentUser?.uid; // Use URL param or current user's ID

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser && userId === currentUser.uid;

  // State for products
  const [designerProducts, setDesignerProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch designer's products
  useEffect(() => {
    const fetchDesignerProducts = async () => {
      if (!userId) return;

      // Only try to fetch products if the user has designer role or it's a profile page
      setLoadingProducts(true);

      try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('designerId', '==', userId));
        const snapshot = await getDocs(q);

        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log('Designer products fetched:', products.length);
        setDesignerProducts(products);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchDesignerProducts();
  }, [userId]);

  // Format price as currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price || 0);
  };

  // Calculate funding percentage
  const calculateFundingPercentage = (product) => {
    if (!product.fundingGoal || product.fundingGoal <= 0) return 0;
    const currentFunding = product.currentFunding || 0;
    const percentage = Math.min(100, Math.round((currentFunding / product.fundingGoal) * 100));
    return percentage;
  };

  // Handler for editing a product
  const handleEditProduct = (productId) => {
    navigate(`/product-edit/${productId}`);
  };

  // Check if a field should be displayed based on privacy settings
  const shouldShowField = (fieldName) => {
    // If viewing own profile, always show everything
    if (isOwnProfile) return true;

    // If not viewing own profile, check privacy settings
    // Make sure privacy settings exist and the field is explicitly allowed
    return userProfile?.privacy?.[fieldName] === true;
  };

  return (<div className="settings-section products-section">
    <h3>Manage Products</h3>

    {isOwnProfile && (
      <div className="section-actions">
        <Link to="/product-upload" className="btn-primary">
          Upload New Product
        </Link>
      </div>
    )}

    {isOwnProfile ? (
      // Product management for profile owner
      <>
        {loadingProducts ? (
          <div className="loading-container">
            <LoadingSpinner />
            <p>Loading your products...</p>
          </div>
        ) : designerProducts.length === 0 ? (
          <div className="empty-state">
            <p>You haven't uploaded any products yet.</p>
            <Link to="/product-upload" className="btn-secondary">
              Create Your First Product
            </Link>
          </div>
        ) : (
          <div className="product-management-list">
            {designerProducts.map(product => (
              <div key={product.id} className="managed-product-card">
                <div className="product-image">
                  <img
                    src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                      ? product.imageUrls[0]
                      : product.imageUrl || '/placeholder-product.jpg'}
                    alt={product.name} />
                  <span className={`product-status status-${product.status || 'pending'}`}>
                    {product.status || 'Pending'}
                  </span>
                </div>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <div className="product-meta">
                    <span className="product-price">{formatPrice(product.price)}</span>
                    <span className="product-date">Created: {formatDate(product.createdAt)}</span>
                  </div>
                  {product.fundingGoal > 0 && (
                    <div className="product-funding">
                      <div className="funding-progress-bar">
                        <div
                          className="funding-bar"
                          style={{ width: `${calculateFundingPercentage(product)}%` }}
                        ></div>
                      </div>
                      <div className="funding-text">
                        <span className="funding-percentage">
                          {calculateFundingPercentage(product)}% funded
                        </span>
                        <span className="funding-amount">
                          {formatPrice(product.currentFunding || 0)} of {formatPrice(product.fundingGoal)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="product-actions">
                    <button
                      onClick={() => handleEditProduct(product.id)}
                      className="btn-edit"
                    >
                      Edit Product
                    </button>
                    <Link
                      to={`/product/${product.id}`}
                      className="btn-view"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    ) : (
      // Products view for visitors respecting privacy settings
      <>
        {!shouldShowField('showProducts') ? (
          <div className="profile-private-notice">
            <p>This user has chosen to keep their products private.</p>
          </div>
        ) : loadingProducts ? (
          <div className="loading-container">
            <LoadingSpinner />
            <p>Loading products...</p>
          </div>
        ) : designerProducts.length === 0 ? (
          <div className="empty-state">
            <p>This user hasn't uploaded any products yet.</p>
          </div>
        ) : (
          <div className="product-grid visitor-view">
            {designerProducts
              .filter(product => product.status === 'active')
              .map(product => (
                <div key={product.id} className="product-card">
                  <Link to={`/product/${product.id}`} className="product-link">
                    <div className="product-image">
                      <img
                        src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                          ? product.imageUrls[0]
                          : product.imageUrl || '/placeholder-product.jpg'}
                        alt={product.name} />
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <div className="product-price">{formatPrice(product.price)}</div>
                    </div>
                  </Link>
                </div>
              ))}
          </div>
        )}
      </>
    )}
  </div>);
};

export default MyProductsTab;
