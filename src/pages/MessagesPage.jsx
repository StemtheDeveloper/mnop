import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/MessagesPage.css';

const MessagesPage = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useUser();

    useEffect(() => {
        const fetchConversations = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            try {
                const conversationsRef = collection(db, 'conversations');
                const q = query(
                    conversationsRef,
                    where('participants', 'array-contains', currentUser.uid),
                    orderBy('lastMessageAt', 'desc')
                );

                const querySnapshot = await getDocs(q);

                const conversationsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setConversations(conversationsData);
            } catch (err) {
                console.error('Error fetching conversations:', err);
                setError('Failed to load messages');
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [currentUser]);

    if (loading) return <LoadingSpinner />;

    if (error) {
        return <div className="messages-error">{error}</div>;
    }

    return (
        <div className="messages-page">
            <h1>Messages</h1>

            {conversations.length === 0 ? (
                <div className="no-messages">
                    <p>You don't have any messages yet.</p>
                </div>
            ) : (
                <div className="conversations-list">
                    {conversations.map(conversation => (
                        <div key={conversation.id} className="conversation-item">
                            <div className="conversation-avatar">
                                <img
                                    src={conversation.otherUserPhoto || 'https://via.placeholder.com/40'}
                                    alt="Profile"
                                />
                            </div>
                            <div className="conversation-content">
                                <h3>{conversation.otherUserName}</h3>
                                <p>{conversation.lastMessage}</p>
                            </div>
                            <div className="conversation-time">
                                {conversation.lastMessageAt?.toDate().toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MessagesPage;
