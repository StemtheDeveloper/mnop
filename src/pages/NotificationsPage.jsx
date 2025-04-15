import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/NotificationsPage.css';

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useUser();

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            try {
                const notificationsRef = collection(db, 'notifications');
                const q = query(
                    notificationsRef,
                    where('userId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc')
                );

                const querySnapshot = await getDocs(q);

                const notificationsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setNotifications(notificationsData);
            } catch (err) {
                console.error('Error fetching notifications:', err);
                setError('Failed to load notifications');
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [currentUser]);

    if (loading) return <LoadingSpinner />;

    if (error) {
        return <div className="notifications-error">{error}</div>;
    }

    return (
        <div className="notifications-page">
            <h1>Notifications</h1>

            {notifications.length === 0 ? (
                <div className="no-notifications">
                    <p>You don't have any notifications yet.</p>
                </div>
            ) : (
                <div className="notifications-list">
                    {notifications.map(notification => (
                        <div
                            key={notification.id}
                            className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                        >
                            <div className="notification-icon">
                                {notification.type === 'order' && <span className="icon-order">📦</span>}
                                {notification.type === 'message' && <span className="icon-message">💬</span>}
                                {notification.type === 'system' && <span className="icon-system">🔔</span>}
                            </div>
                            <div className="notification-content">
                                <p>{notification.message}</p>
                                <span className="notification-time">
                                    {notification.createdAt?.toDate().toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
