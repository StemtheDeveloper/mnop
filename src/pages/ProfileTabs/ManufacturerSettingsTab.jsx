import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { doc, collection, query, where, getDocs, getDoc, setDoc, serverTimestamp, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import ManufacturerSelectionModal from '../../components/manufacturer/ManufacturerSelectionModal';

const ManufacturerSettingsTab = () => {
  const { currentUser, hasRole } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [manufacturerSettings, setManufacturerSettings] = useState({});
  const [manufacturers, setManufacturers] = useState([]);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  const [showManufacturerModal, setShowManufacturerModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [autoTransferFunds, setAutoTransferFunds] = useState(false);
  const [designerProducts, setDesignerProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [manufacturerRequests, setManufacturerRequests] = useState({});

  // Format price as currency
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Calculate funding percentage
  const calculateFundingPercentage = (product) => {
    if (!product.fundingGoal || product.fundingGoal <= 0) return 0;
    const currentFunding = product.currentFunding || 0;
    const percentage = Math.min(100, Math.round((currentFunding / product.fundingGoal) * 100));
    return percentage;
  };

  // Function to fetch designer's products
  const fetchDesignerProducts = async () => {
    if (!currentUser?.uid) return;

    // Only try to fetch products if the user has designer role
    const userIsDesigner = hasRole('designer');
    if (!userIsDesigner) return;

    console.log('Fetching designer products for userId:', currentUser.uid);
    setLoadingProducts(true);

    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('designerId', '==', currentUser.uid));
      const snapshot = await getDocs(q);

      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Designer products fetched:', products.length);
      setDesignerProducts(products);

      // Fetch manufacturer requests for these products
      await fetchManufacturerRequests(products.map(p => p.id));
    } catch (error) {
      console.error('Error fetching products:', error);
      setMessage({ type: 'error', text: 'Failed to load your products.' });
    } finally {
      setLoadingProducts(false);
    }
  };

  // Fetch manufacturer requests for products
  const fetchManufacturerRequests = async (productIds) => {
    if (!productIds || productIds.length === 0) return;

    try {
      const requestsRef = collection(db, 'manufacturerRequests');
      const q = query(
        requestsRef,
        where('productId', 'in', productIds.slice(0, 10)), // Firestore 'in' operator limited to 10 values
        where('designerId', '==', currentUser.uid)
      );

      const snapshot = await getDocs(q);

      const requests = {};
      snapshot.docs.forEach(doc => {
        const request = doc.data();
        requests[request.productId] = {
          id: doc.id,
          ...request
        };
      });

      // If more than 10 products, make additional queries
      if (productIds.length > 10) {
        for (let i = 10; i < productIds.length; i += 10) {
          const batch = productIds.slice(i, i + 10);
          if (batch.length > 0) {
            const batchQuery = query(
              requestsRef,
              where('productId', 'in', batch),
              where('designerId', '==', currentUser.uid)
            );

            const batchSnapshot = await getDocs(batchQuery);
            batchSnapshot.docs.forEach(doc => {
              const request = doc.data();
              requests[request.productId] = {
                id: doc.id,
                ...request
              };
            });
          }
        }
      }

      setManufacturerRequests(requests);
    } catch (error) {
      console.error('Error fetching manufacturer requests:', error);
    }
  };

  // Fetch manufacturer settings and products
  useEffect(() => {
    if (!currentUser?.uid || !hasRole('designer')) return;

    const fetchManufacturerSettings = async () => {
      setLoadingManufacturers(true);

      try {
        // Fetch existing manufacturer settings
        const settingsRef = doc(db, 'designerSettings', currentUser.uid);
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists() && settingsDoc.data().manufacturerSettings) {
          setManufacturerSettings(settingsDoc.data().manufacturerSettings);
          setAutoTransferFunds(settingsDoc.data().autoTransferFunds || false);
        }

        // Fetch ALL manufacturers with manufacturer role (not just verified ones)
        const allManufacturers = [];
        const usersRef = collection(db, 'users');
        const manufacturersQuery = query(
          usersRef,
          where('roles', 'array-contains', 'manufacturer')
        );

        const manufacturersSnapshot = await getDocs(manufacturersQuery);
        manufacturersSnapshot.forEach(doc => {
          allManufacturers.push({
            id: doc.id,
            displayName: doc.data().displayName || doc.data().email,
            verified: doc.data().manufacturerVerified === true,
            ...doc.data()
          });
        });

        setManufacturers(allManufacturers);
      } catch (error) {
        console.error('Error fetching manufacturer settings:', error);
        setMessage({ type: 'error', text: 'Failed to load manufacturer settings.' });
      } finally {
        setLoadingManufacturers(false);
      }
    };

    fetchManufacturerSettings();
    fetchDesignerProducts();
  }, [currentUser?.uid, hasRole]);

  // Send a request to a manufacturer
  const sendManufacturerRequest = async (productId, manufacturerId) => {
    if (!productId || !manufacturerId || !currentUser?.uid) {
      setMessage({ type: 'error', text: 'Missing required information to send request.' });
      return { success: false };
    }

    setLoading(true);

    try {
      const product = designerProducts.find(p => p.id === productId);
      const manufacturer = manufacturers.find(m => m.id === manufacturerId);

      if (!product || !manufacturer) {
        setMessage({ type: 'error', text: 'Product or manufacturer not found.' });
        return { success: false };
      }

      // Check if a request already exists
      const existingRequest = manufacturerRequests[productId];

      if (existingRequest) {
        // If the request exists but for a different manufacturer, update it
        if (existingRequest.manufacturerId !== manufacturerId) {
          const requestRef = doc(db, 'manufacturerRequests', existingRequest.id);
          await updateDoc(requestRef, {
            manufacturerId,
            manufacturerEmail: manufacturer.email,
            status: 'pending',
            updatedAt: serverTimestamp()
          });

          // Create notification for the manufacturer
          await addDoc(collection(db, 'notifications'), {
            userId: manufacturerId,
            title: 'New Manufacturing Request',
            message: `${currentUser.displayName || currentUser.email} has requested your approval to manufacture "${product.name}"`,
            type: 'manufacturer_request',
            productId: productId,
            read: false,
            createdAt: serverTimestamp()
          });

          setMessage({
            type: 'success',
            text: `Request updated and sent to ${manufacturer.displayName || manufacturer.email}`
          });

          // Update local state
          setManufacturerRequests({
            ...manufacturerRequests,
            [productId]: {
              ...existingRequest,
              manufacturerId,
              manufacturerEmail: manufacturer.email,
              status: 'pending',
              updatedAt: new Date()
            }
          });

          return { success: true };
        }

        // Request already exists for this manufacturer
        setMessage({
          type: 'info',
          text: `A request has already been sent to ${manufacturer.displayName || manufacturer.email}`
        });
        return { success: true };
      }

      // Create a new request
      const requestData = {
        productId,
        productName: product.name,
        designerId: currentUser.uid,
        designerEmail: currentUser.email,
        manufacturerId,
        manufacturerEmail: manufacturer.email,
        status: 'pending',
        fundingAmount: product.currentFunding >= product.fundingGoal ? product.currentFunding : 0,
        isFullyFunded: product.currentFunding >= product.fundingGoal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'manufacturerRequests'), requestData);

      // Create notification for the manufacturer
      await addDoc(collection(db, 'notifications'), {
        userId: manufacturerId,
        title: 'New Manufacturing Request',
        message: `${currentUser.displayName || currentUser.email} has requested your approval to manufacture "${product.name}"`,
        type: 'manufacturer_request',
        productId: productId,
        read: false,
        createdAt: serverTimestamp()
      });

      // Add to local state
      setManufacturerRequests({
        ...manufacturerRequests,
        [productId]: {
          id: docRef.id,
          ...requestData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      setMessage({
        type: 'success',
        text: `Request sent to ${manufacturer.displayName || manufacturer.email}`
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending manufacturer request:', error);
      setMessage({ type: 'error', text: 'Failed to send request. Please try again.' });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManufacturerSettings = async () => {
    if (!currentUser?.uid || !hasRole('designer')) {
      setMessage({ type: 'error', text: 'You need to have designer role to save manufacturer settings.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Reference to the designer settings document
      const settingsRef = doc(db, 'designerSettings', currentUser.uid);

      // Prepare the data to save
      const manufacturerData = {
        manufacturerSettings: manufacturerSettings, // Product ID to manufacturer ID mapping
        autoTransferFunds: autoTransferFunds, // Flag to auto-transfer funds when products are fully funded
        updatedAt: serverTimestamp()
      };

      // Check if document exists
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        await updateDoc(settingsRef, manufacturerData);
      } else {
        // Add createdAt for new documents
        await setDoc(settingsRef, {
          ...manufacturerData,
          createdAt: serverTimestamp()
        });
      }

      // Send manufacturer requests for selected products
      for (const [productId, manufacturerId] of Object.entries(manufacturerSettings)) {
        if (manufacturerId) {
          const product = designerProducts.find(p => p.id === productId);

          // Only send requests for products that don't already have a request or 
          // if the manufacturer is different from the current request
          const existingRequest = manufacturerRequests[productId];

          if (!existingRequest || existingRequest.manufacturerId !== manufacturerId) {
            await sendManufacturerRequest(productId, manufacturerId);
          }
        }
      }

      // If auto-transfer is enabled, check if any products are already fully funded
      if (autoTransferFunds) {
        console.log("Auto-transfer funds is enabled, checking for fully funded products...");
        const fullyFundedProducts = designerProducts.filter(
          product => product.currentFunding >= product.fundingGoal &&
            manufacturerSettings[product.id] &&
            !product.manufacturerId &&
            !product.fundsSentToManufacturer
        );

        console.log(`Found ${fullyFundedProducts.length} fully funded products ready for auto-transfer`);

        if (fullyFundedProducts.length > 0) {
          for (const product of fullyFundedProducts) {
            const manufacturerId = manufacturerSettings[product.id];
            const manufacturer = manufacturers.find(m => m.id === manufacturerId);

            if (manufacturer) {
              console.log(`Auto-sending request for product ${product.id} to manufacturer ${manufacturer.email}`);
              await sendManufacturerRequest(product.id, manufacturerId);
            } else {
              console.error(`Manufacturer not found for product ${product.id}`);
            }
          }

          // Refresh products list after sending requests
          if (designerProducts.length > 0) {
            console.log("Refreshing designer products after sending requests");
            fetchDesignerProducts();
          }
        }
      } else {
        console.log("Auto-transfer funds is disabled");
      }

      setMessage({
        type: 'success',
        text: 'Manufacturer settings saved successfully!'
      });
    } catch (error) {
      console.error('Error saving manufacturer settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save manufacturer settings. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Get request status badge
  const getRequestStatusBadge = (productId) => {
    const request = manufacturerRequests[productId];

    if (!request) {
      return null;
    }

    switch (request.status) {
      case 'pending':
        return (
          <span className="status-badge pending">
            Request Pending
          </span>
        );
      case 'approved':
        return (
          <span className="status-badge approved">
            Request Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge rejected">
            Request Rejected
          </span>
        );
      case 'completed':
        return (
          <span className="status-badge completed">
            Funds Transferred
          </span>
        );
      default:
        return null;
    }
  };

  return (<>
    <div className="settings-section manufacturer-settings-section">                                    <h3>Manufacturer Settings</h3>
      <p>Pre-select manufacturers for your products and send requests for approval.</p>

      {loading ? (
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading manufacturer settings...</p>
        </div>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSaveManufacturerSettings();
        }}>
          <div className="form-actions top-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Manufacturer Settings'}
            </button>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="autoTransferFunds"
              checked={autoTransferFunds}
              onChange={(e) => setAutoTransferFunds(e.target.checked)}
            />                                                <label htmlFor="autoTransferFunds">Automatically send request to selected manufacturer when a product is fully funded</label>
            <p className="field-description">
              When enabled, requests will be automatically sent to your pre-selected manufacturer as soon as a product reaches its funding goal.
              This setting applies to all your products that have a manufacturer selected below.
            </p>
          </div>

          <div className="manufacturer-product-section">
            <h4>Assign Manufacturers to Products</h4>
            <p>Select a preferred manufacturer for your products. After saving, a request will be sent to the manufacturer for approval:</p>

            {designerProducts.length === 0 ? (
              <div className="empty-state">
                <p>You don't have any products yet.</p>
                <Link to="/product-upload" className="btn-secondary">
                  Create Your First Product
                </Link>
              </div>
            ) : (
              <div className="manufacturer-product-list">
                {designerProducts
                  .filter(product => product.status === 'active') // Only show active products
                  .map(product => (
                    <div key={product.id} className="manufacturer-product-card">
                      <div className="product-info">
                        <div className="product-image">
                          <img
                            src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                              ? product.imageUrls[0]
                              : product.imageUrl || '/placeholder-product.jpg'}
                            alt={product.name} />
                        </div>
                        <div className="product-details">
                          <h3>{product.name}</h3>
                          {product.fundingGoal > 0 && (
                            <div className="product-funding">
                              <div className="funding-progress-bar">
                                <div
                                  className="funding-bar"
                                  style={{ width: `${calculateFundingPercentage(product)}%` }}
                                ></div>
                              </div>
                              <div className="funding-text">
                                <span>{calculateFundingPercentage(product)}% funded</span>
                                <span>{formatPrice(product.currentFunding || 0)} / {formatPrice(product.fundingGoal)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="manufacturer-selection">
                        <label htmlFor={`manufacturer-${product.id}`}>Preferred Manufacturer:</label>
                        <select
                          id={`manufacturer-${product.id}`}
                          value={manufacturerSettings[product.id] || ''}
                          onChange={(e) => {
                            setManufacturerSettings({
                              ...manufacturerSettings,
                              [product.id]: e.target.value
                            });
                          }}
                          disabled={product.manufacturerId}
                        >
                          <option value="">-- Select a manufacturer --</option>
                          {manufacturers.map(manufacturer => (
                            <option
                              key={manufacturer.id}
                              value={manufacturer.id}
                            >
                              {manufacturer.displayName || manufacturer.email} {manufacturer.manufacturerVerified && "✓"}
                            </option>
                          ))}
                        </select>

                        {getRequestStatusBadge(product.id)}

                        {product.currentFunding >= product.fundingGoal ? (
                          <div className="status-fully-funded">
                            This product is fully funded and ready for manufacturing.
                            {!product.manufacturerId && (
                              <>
                                {manufacturerRequests[product.id]?.status === 'approved' ? (
                                  <button
                                    type="button"
                                    className="btn-select-now"
                                    onClick={() => {
                                      setSelectedProductId(product.id);
                                      setShowManufacturerModal(true);
                                    }}
                                  >
                                    Transfer Funds to Manufacturer
                                  </button>
                                ) : manufacturerRequests[product.id]?.status === 'pending' ? (
                                  <div className="request-pending-message">
                                    Waiting for manufacturer approval before funds can be transferred.
                                  </div>
                                ) : manufacturerRequests[product.id]?.status === 'rejected' ? (
                                  <div className="request-rejected-message">
                                    Manufacturer declined. Please select another manufacturer.
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-select-now"
                                    onClick={() => {
                                      setSelectedProductId(product.id);
                                      setShowManufacturerModal(true);
                                    }}
                                  >
                                    Select Manufacturer Now
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : product.manufacturerId ? (
                          <div className="status-manufacturer-selected">
                            Manufacturer already assigned
                          </div>
                        ) : (
                          <div className="status-pending">
                            {manufacturerRequests[product.id]?.status === 'approved' ?
                              'Request approved. Funds can be transferred when fully funded.' :
                              manufacturerRequests[product.id]?.status === 'pending' ?
                                'Request pending approval from manufacturer.' :
                                manufacturerRequests[product.id]?.status === 'rejected' ?
                                  'Request rejected. Please select another manufacturer.' :
                                  'Will be requested when fully funded'
                            }

                            {autoTransferFunds && manufacturerSettings[product.id] && (
                              <span className="auto-transfer-badge" title="Requests will be automatically sent to this manufacturer when the product is fully funded">
                                Auto-request enabled
                              </span>
                            )}

                            {!autoTransferFunds && manufacturerSettings[product.id] && (
                              <span className="manual-transfer-badge" title="Enable auto-transfer above to automatically send requests to this manufacturer">
                                Manual request required
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}                                            </div>
        </form>
      )}

      {showManufacturerModal && selectedProductId && (
        <ManufacturerSelectionModal
          isOpen={showManufacturerModal}
          onClose={() => setShowManufacturerModal(false)}
          product={designerProducts.find(p => p.id === selectedProductId)}
          onSuccess={() => {
            // Refresh products after successful manufacturer selection
            fetchDesignerProducts();
            setShowManufacturerModal(false);
          }}
          preSelection={!designerProducts.find(p => p.id === selectedProductId)?.currentFunding >=
            designerProducts.find(p => p.id === selectedProductId)?.fundingGoal}
        />
      )}
    </div>
  </>);
};

export default ManufacturerSettingsTab;
