import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import messageService from '../services/messageService';
import cryptoService from '../services/cryptoService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/MessagesPage.css';

// Default no-op functions if ToastContext is not available
const defaultToastFunctions = {
    showSuccess: () => console.warn('ToastProvider not found.'),
    showError: () => console.warn('ToastProvider not found.'),
};

const MessagesPage = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newConversation, setNewConversation] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [initialMessage, setInitialMessage] = useState('');
    const [creatingConversation, setCreatingConversation] = useState(false);

    const { currentUser } = useUser();
    // Use default functions if useToast() returns undefined/null
    const { showSuccess, showError } = useToast() || defaultToastFunctions;
    const navigate = useNavigate();
    const messageInputRef = useRef(null);

    useEffect(() => {
        if (newConversation && selectedUser && messageInputRef.current) {
            messageInputRef.current.focus();
        }
    }, [newConversation, selectedUser]);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = messageService.subscribeToConversations(
            currentUser.uid,
            (conversationsData) => {
                setConversations(conversationsData);
                setLoading(false);
            }
        );

        cryptoService.generateKeyPair(currentUser.uid)
            .then(() => {
                console.log('Crypto initialized for user');
            })
            .catch(err => {
                console.error('Error initializing crypto:', err);
            });

        return () => unsubscribe();
    }, [currentUser]);

    const handleUserSearch = async (e) => {
        e.preventDefault();

        if (!userSearchQuery.trim()) return;

        setSearching(true);

        try {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('email', '>=', userSearchQuery),
                where('email', '<=', userSearchQuery + '\uf8ff'),
                orderBy('email'),
            );

            const querySnapshot = await getDocs(q);

            const users = querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(user => user.id !== currentUser.uid);

            setSearchResults(users);
        } catch (err) {
            console.error('Error searching for users:', err);
            showError('Failed to search for users');
        } finally {
            setSearching(false);
        }
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchResults([]);
        setUserSearchQuery('');
    };

    const handleStartConversation = async (e) => {
        e.preventDefault();

        if (!initialMessage.trim() || !selectedUser) return;

        setCreatingConversation(true);

        try {
            const conversationId = await messageService.createConversation(
                currentUser.uid,
                selectedUser.id,
                initialMessage
            );

            navigate(`/messages/${conversationId}`);

            showSuccess('Conversation started!');
        } catch (err) {
            console.error('Error starting conversation:', err);
            showError('Failed to start conversation');
            setCreatingConversation(false);
        }
    };

    const formatConversationTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const cancelNewConversation = () => {
        setNewConversation(false);
        setSelectedUser(null);
        setInitialMessage('');
    };

    if (!currentUser) {
        return (
            <div className="messages-page">
                <div className="messages-container">
                    <h1>Messages</h1>
                    <p className="auth-required-message">Please sign in to view your messages.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-page">
            <div className="messages-container">
                <div className="messages-header">
                    <h1>Messages</h1>
                    {!newConversation && (
                        <button
                            className="new-message-button"
                            onClick={() => setNewConversation(true)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                            New Message
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading conversations...</p>
                    </div>
                ) : newConversation ? (
                    <div className="new-conversation-container">
                        <div className="new-conversation-header">
                            <button
                                className="back-button"
                                onClick={cancelNewConversation}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <h2>New Secure Message</h2>
                        </div>

                        {!selectedUser ? (
                            <div className="user-search-section">
                                <p className="search-info">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                    <span>Messages are end-to-end encrypted</span>
                                </p>

                                <form onSubmit={handleUserSearch} className="user-search-form">
                                    <input
                                        type="text"
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        placeholder="Search by email address"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!userSearchQuery.trim() || searching}
                                    >
                                        {searching ? (
                                            <LoadingSpinner size="small" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8"></circle>
                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                        )}
                                    </button>
                                </form>

                                {searchResults.length > 0 ? (
                                    <div className="search-results">
                                        <h3>Search Results</h3>
                                        <ul className="users-list">
                                            {searchResults.map(user => (
                                                <li
                                                    key={user.id}
                                                    className="user-item"
                                                    onClick={() => handleSelectUser(user)}
                                                >
                                                    <div className="user-avatar">
                                                        {user.photoURL ? (
                                                            <img src={user.photoURL} alt={user.displayName || 'User'} />
                                                        ) : (
                                                            <div className="default-avatar">
                                                                {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="user-info">
                                                        <p className="user-name">{user.displayName || 'User'}</p>
                                                        <p className="user-email">{user.email}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : userSearchQuery && !searching ? (
                                    <div className="no-results">
                                        <p>No users found matching "{userSearchQuery}"</p>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="compose-message-section">
                                <div className="selected-user">
                                    <div className="user-avatar">
                                        {selectedUser.photoURL ? (
                                            <img src={selectedUser.photoURL} alt={selectedUser.displayName || 'User'} />
                                        ) : (
                                            <div className="default-avatar">
                                                {selectedUser.displayName?.charAt(0) || selectedUser.email?.charAt(0) || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="user-info">
                                        <p className="user-name">{selectedUser.displayName || 'User'}</p>
                                        <p className="user-email">{selectedUser.email}</p>
                                    </div>
                                </div>

                                <form onSubmit={handleStartConversation} className="compose-form">
                                    <div className="encrypt-badge">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                        <span>End-to-end encrypted</span>
                                    </div>

                                    <textarea
                                        ref={messageInputRef}
                                        value={initialMessage}
                                        onChange={(e) => setInitialMessage(e.target.value)}
                                        placeholder="Type your message..."
                                        required
                                        rows={4}
                                    />

                                    <div className="compose-actions">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={cancelNewConversation}
                                            disabled={creatingConversation}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="send-button"
                                            disabled={!initialMessage.trim() || creatingConversation}
                                        >
                                            {creatingConversation ? (
                                                <>
                                                    <LoadingSpinner size="small" />
                                                    <span>Sending...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                                    </svg>
                                                    <span>Send Message</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="no-messages">
                        <h2>No conversations yet</h2>
                        <p>Start a new conversation by clicking "New Message"</p>
                    </div>
                ) : (
                    <div className="conversations-list">
                        {conversations.map(conversation => (
                            <Link
                                key={conversation.id}
                                to={`/messages/${conversation.id}`}
                                className={`conversation-item ${conversation.unreadCount > 0 ? 'unread' : ''}`}
                            >
                                <div className="conversation-avatar">
                                    {conversation.otherUserPhoto ? (
                                        <img
                                            src={conversation.otherUserPhoto}
                                            alt={conversation.otherUserName || 'User'}
                                        />
                                    ) : (
                                        <div className="default-avatar">
                                            {conversation.otherUserName?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="conversation-content">
                                    <div className="conversation-header">
                                        <h3 className="conversation-name">{conversation.otherUserName || 'Unknown User'}</h3>
                                        <span className="conversation-time">
                                            {formatConversationTime(conversation.lastMessageAt)}
                                        </span>
                                    </div>
                                    <div className="conversation-preview">
                                        <p>{conversation.lastMessage}</p>

                                        <div className="conversation-meta">
                                            {conversation.encrypted && (
                                                <span className="encrypted-badge">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                    </svg>
                                                </span>
                                            )}

                                            {conversation.unreadCount > 0 && (
                                                <span className="unread-badge">
                                                    {conversation.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesPage;
