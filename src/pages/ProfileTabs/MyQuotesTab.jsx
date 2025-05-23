import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';
import '../../styles/ManufacturerQuotes.css';
import '../../styles/ProfileTabs.css';

const MyQuotesTab = () => {
  const { currentUser, userProfile, hasRole } = useUser();
  const { userId: urlUserId } = useParams();
  const userId = urlUserId || currentUser?.uid;
  const isOwnProfile = currentUser && userId === currentUser.uid;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [manufacturerRequests, setManufacturerRequests] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [designerRequests, setDesignerRequests] = useState([]);
  const [designerLoading, setDesignerLoading] = useState(true);
  const [designerError, setDesignerError] = useState(null);

  // Check if user has manufacturer role
  const isManufacturer = hasRole('manufacturer');

  useEffect(() => {
    // Only fetch if this is the user's own profile and they're a manufacturer
    if (!isOwnProfile || !isManufacturer) {
      setLoading(false);
      return;
    }

    const fetchManufacturerRequests = async () => {
      try {
        // Get requests for this manufacturer
        const requestsRef = collection(db, 'manufacturerRequests');
        const requestsQuery = query(
          requestsRef,
          where('manufacturerId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(50) // Limit to 50 most recent requests
        );

        const snapshot = await getDocs(requestsQuery);

        if (snapshot.empty) {
          setManufacturerRequests([]);
          setLoading(false);
          return;
        }

        // Get basic request data
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Enhanced requests with product data
        const enhancedRequests = await Promise.all(
          requestsData.map(async request => {
            try {
              // If there's a product ID, fetch the product details
              if (request.productId) {
                const productRef = doc(db, 'products', request.productId);
                const productSnap = await getDoc(productRef);

                if (productSnap.exists()) {
                  const productData = productSnap.data();

                  return {
                    ...request,
                    createdAt: request.createdAt?.toDate() || new Date(),
                    updatedAt: request.updatedAt?.toDate() || new Date(),
                    deadline: request.deadline?.toDate() || null,
                    fundsTransferredAt: request.fundsTransferredAt?.toDate() || null,
                    // Use product data for missing fields
                    productName: request.productName || productData.name || 'Unnamed Product',
                    designerName: request.designerName || productData.designerName || 'Unknown Designer',
                    designerEmail: request.designerEmail || productData.designerEmail || 'Unknown',
                    budget: request.budget || request.fundingAmount || productData.fundingGoal || 0,
                    status: request.status || 'pending',
                    isUrgent: request.isUrgent || false,
                    product: {
                      id: productSnap.id,
                      ...productData
                    }
                  };
                }
              }

              // If no product or product fetch failed
              return {
                ...request,
                createdAt: request.createdAt?.toDate() || new Date(),
                updatedAt: request.updatedAt?.toDate() || new Date(),
                deadline: request.deadline?.toDate() || null,
                fundsTransferredAt: request.fundsTransferredAt?.toDate() || null,
                productName: request.productName || 'Unnamed Product',
                designerName: request.designerName || 'Unknown Designer',
                designerEmail: request.designerEmail || 'Unknown',
                budget: request.budget || request.fundingAmount || 0,
                status: request.status || 'pending',
                isUrgent: request.isUrgent || false
              };
            } catch (error) {
              console.error(`Error fetching product details for request ${request.id}:`, error);
              return {
                ...request,
                createdAt: request.createdAt?.toDate() || new Date(),
                updatedAt: request.updatedAt?.toDate() || new Date(),
                deadline: request.deadline?.toDate() || null,
                fundsTransferredAt: request.fundsTransferredAt?.toDate() || null,
                productName: request.productName || 'Unnamed Product',
                designerName: request.designerName || 'Unknown Designer',
                designerEmail: request.designerEmail || 'Unknown',
                budget: request.budget || request.fundingAmount || 0,
                status: request.status || 'pending',
                isUrgent: request.isUrgent || false
              };
            }
          })
        );

        setManufacturerRequests(enhancedRequests);
      } catch (err) {
        console.error('Error fetching manufacturer requests:', err);
        setError('Failed to load your manufacturing requests. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturerRequests();
  }, [userId, isOwnProfile, isManufacturer]);

  // Fetch requests sent by the designer (if user is a designer)
  useEffect(() => {
    const fetchDesignerRequests = async () => {
      if (!isOwnProfile || !hasRole('designer')) {
        setDesignerLoading(false);
        return;
      }
      setDesignerLoading(true);
      try {
        // Get requests sent by this designer
        const requestsRef = collection(db, 'manufacturerRequests');
        const requestsQuery = query(
          requestsRef,
          where('designerId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(requestsQuery);
        if (snapshot.empty) {
          setDesignerRequests([]);
          setDesignerLoading(false);
          return;
        }
        // Get basic request data
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Enhanced requests with product data
        const enhancedRequests = await Promise.all(
          requestsData.map(async request => {
            try {
              // If there's a product ID, fetch the product details
              let product = null;
              if (request.productId) {
                const productRef = doc(db, 'products', request.productId);
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                  product = { id: productSnap.id, ...productSnap.data() };
                }
              }
              return {
                ...request,
                createdAt: request.createdAt?.toDate() || new Date(),
                updatedAt: request.updatedAt?.toDate() || new Date(),
                deadline: request.deadline?.toDate() || null,
                fundsTransferredAt: request.fundsTransferredAt?.toDate() || null,
                productName: request.productName || product?.name || 'Unnamed Product',
                manufacturerName: request.manufacturerName || 'Not assigned',
                status: request.status || 'pending',
                manufacturingCostEstimate: request.manufacturingCostEstimate,
                retailPriceSuggestion: request.retailPriceSuggestion,
                estimateMessage: request.estimateMessage,
                product
              };
            } catch (error) {
              return {
                ...request,
                createdAt: request.createdAt?.toDate() || new Date(),
                updatedAt: request.updatedAt?.toDate() || new Date(),
                deadline: request.deadline?.toDate() || null,
                fundsTransferredAt: request.fundsTransferredAt?.toDate() || null,
                productName: request.productName || 'Unnamed Product',
                manufacturerName: request.manufacturerName || 'Not assigned',
                status: request.status || 'pending',
                manufacturingCostEstimate: request.manufacturingCostEstimate,
                retailPriceSuggestion: request.retailPriceSuggestion,
                estimateMessage: request.estimateMessage,
                product: null
              };
            }
          })
        );
        setDesignerRequests(enhancedRequests);
      } catch (err) {
        setDesignerError('Failed to load your sent manufacturing requests. Please try again later.');
      } finally {
        setDesignerLoading(false);
      }
    };
    fetchDesignerRequests();
  }, [userId, isOwnProfile, hasRole]);

  // Get status badge class based on status
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'in_progress': return 'status-in-progress';
      case 'rejected': return 'status-rejected';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-rejected';
      default: return 'status-pending';
    }
  };

  // Get readable status text
  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'approved': return 'Approved';
      case 'in_progress': return 'In Progress';
      case 'rejected': return 'Rejected';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Navigate to request details
  const viewRequestDetails = (requestId) => {
    // Double-check role before navigating
    if (hasRole('manufacturer')) {
      navigate(`/manufacturer/requests/${requestId}`);
    } else {
      // If user somehow lost manufacturer role
      setError('You must have manufacturer permissions to view request details.');
    }
  };

  // Filter requests based on active tab
  const filteredRequests = manufacturerRequests.filter(request => {
    if (activeTab === 'pending') {
      return request.status === 'pending';
    } else if (activeTab === 'approved') {
      return request.status === 'approved' || request.status === 'in_progress';
    } else if (activeTab === 'completed') {
      return request.status === 'completed';
    } else if (activeTab === 'rejected') {
      return request.status === 'rejected' || request.status === 'cancelled';
    }
    return true; // 'all' tab
  });

  // Count requests by status for the tabs
  const pendingCount = manufacturerRequests.filter(req => req.status === 'pending').length;
  const approvedCount = manufacturerRequests.filter(req =>
    req.status === 'approved' || req.status === 'in_progress'
  ).length;
  const completedCount = manufacturerRequests.filter(req => req.status === 'completed').length;
  const rejectedCount = manufacturerRequests.filter(req =>
    req.status === 'rejected' || req.status === 'cancelled'
  ).length;

  // If not own profile or not a manufacturer, show limited info
  if (!isOwnProfile || !isManufacturer) {
    return (
      <div className="settings-section quotes-section">
        <h3>Manufacturing Requests</h3>
        <p>This information is only available to the profile owner.</p>
      </div>
    );
  }

  return (
    <div className="settings-section quotes-section">
      <h3>My Manufacturing Requests</h3>
      <p>Manage manufacturing requests from designers.</p>

      {loading ? (
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading your manufacturing requests...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : manufacturerRequests.length === 0 ? (
        <div className="empty-state">
          <p>You don't have any manufacturing requests yet.</p>
          <p>When designers request your manufacturing services, they'll appear here.</p>
        </div>
      ) : (
        <>
          <div className="manufacturer-tabs">
            <button
              className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span className="count">{manufacturerRequests.length}</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending <span className="count">{pendingCount}</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => setActiveTab('approved')}
            >
              Approved <span className="count">{approvedCount}</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed <span className="count">{completedCount}</span>
            </button>
            <button
              className={`tab-button ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => setActiveTab('rejected')}
            >
              Rejected <span className="count">{rejectedCount}</span>
            </button>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="empty-state">
              <p>No manufacturing requests found in this category.</p>
            </div>
          ) : (
            <div className="requests-table-container">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Designer</th>
                    <th>Requested On</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(request => (
                    <tr key={request.id} className={request.isUrgent ? 'urgent-row' : ''}>
                      <td>
                        {request.productName}
                        {request.isUrgent && <span className="urgent-badge">Urgent</span>}
                      </td>
                      <td>{request.designerName}</td>
                      <td>
                        {formatDate(request.createdAt)}
                        {request.deadline && (
                          <div className="deadline-info">
                            Due: {formatDate(request.deadline)}
                          </div>
                        )}
                      </td>
                      <td>{formatCurrency(request.budget)}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                          {getStatusText(request.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-small view-details-btn"
                          onClick={() => viewRequestDetails(request.id)}
                          title="View details of this manufacturing request"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Designer's sent requests section */}
      {isOwnProfile && hasRole('designer') && (
        <div className="designer-requests-section">
          <h3>Requests Sent to Manufacturers</h3>
          <p>Track the status of your manufacturing requests and see manufacturer feedback.</p>
          {designerLoading ? (
            <div className="loading-container">
              <LoadingSpinner />
              <p>Loading your sent requests...</p>
            </div>
          ) : designerError ? (
            <div className="error-message">{designerError}</div>
          ) : designerRequests.length === 0 ? (
            <div className="empty-state">
              <p>You haven't sent any manufacturing requests yet.</p>
            </div>
          ) : (
            <div className="requests-table-container">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Manufacturer</th>
                    <th>Requested On</th>
                    <th>Status</th>
                    <th>Cost Estimate</th>
                    <th>Retail Price</th>
                    <th>Manufacturer Message</th>
                  </tr>
                </thead>
                <tbody>
                  {designerRequests.map(request => (
                    <tr key={request.id}>
                      <td>{request.productName}</td>
                      <td>{request.manufacturerName || 'Not assigned'}</td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td>
                        <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                          {getStatusText(request.status)}
                        </span>
                      </td>
                      <td>{request.manufacturingCostEstimate !== undefined && request.manufacturingCostEstimate !== null ? formatCurrency(request.manufacturingCostEstimate) : '—'}</td>
                      <td>{request.retailPriceSuggestion !== undefined && request.retailPriceSuggestion !== null ? formatCurrency(request.retailPriceSuggestion) : '—'}</td>
                      <td>{request.estimateMessage ? <span className="manufacturer-message">{request.estimateMessage}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyQuotesTab;
