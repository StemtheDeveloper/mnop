import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/LoadingSpinner';
import '../../styles/ManufacturerQuotes.css';

const MyQuotesTab = () => {
  const { currentUser, userProfile } = useUser();
  const { userId: urlUserId } = useParams();
  const userId = urlUserId || currentUser?.uid;
  const isOwnProfile = currentUser && userId === currentUser.uid;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [manufacturerRequests, setManufacturerRequests] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Check if user has manufacturer role
  const isManufacturer = userProfile?.roles?.includes('manufacturer');

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

        // Process the request data and include extra info for display
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            deadline: data.deadline?.toDate() || null,
            fundsTransferredAt: data.fundsTransferredAt?.toDate() || null,
            // Add default values for potentially missing fields
            productName: data.productName || 'Unnamed Product',
            designerName: data.designerName || 'Unknown Designer',
            designerEmail: data.designerEmail || 'Unknown',
            status: data.status || 'pending',
            isUrgent: data.isUrgent || false
          };
        });

        setManufacturerRequests(requests);
      } catch (err) {
        console.error('Error fetching manufacturer requests:', err);
        setError('Failed to load your manufacturing requests. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchManufacturerRequests();
  }, [userId, isOwnProfile, isManufacturer]);

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

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
    navigate(`/manufacturer/requests/${requestId}`);
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
    </div>
  );
};

export default MyQuotesTab;
