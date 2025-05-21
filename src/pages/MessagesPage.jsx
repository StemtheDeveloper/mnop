import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaLock, FaPlus, FaSearch, FaArrowLeft, FaPaperPlane, FaUser } from 'react-icons/fa';
import '../styles/MessagesPage.css';
import { useUser } from '../context/UserContext';
import messagingService from '../services/messagingService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { errorToToast, handleErrorWithToast } from '../utils/errorToToast';
import BlockedContentIndicator from '../components/BlockedContentIndicator';

const MessagesPage = () => {
    const { user, userProfile, loading: userLoading, isUserBlocked, shouldBlockContent } = useUser();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [composing, setComposing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [message, setMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [allMessages, setAllMessages] = useState([]);
    const [hiddenMessageIds, setHiddenMessageIds] = useState([]);
    const navigate = useNavigate();
    const { success: showSuccess, error: showError } = useToast();

    useEffect(() => {
        const loadConversations = async () => {
            if (!user?.uid) return;
            try {
                setLoading(true);
                const userConversations = await messagingService.getUserConversations(user.uid);
                setConversations(userConversations);
            } catch (err) {
                console.error('Error loading conversations:', err);
                const errorMsg = handleErrorWithToast(err, showError, 'Failed to load conversations. Please try again.');
                setError(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        loadConversations();
    }, [user]);

    useEffect(() => {
        if (!composing || !user?.uid) return;

        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearching(true);
                const results = await messagingService.searchUsers(searchTerm, user.uid);
                setSearchResults(results);
            } catch (err) {
                console.error('Error searching for users:', err);
                handleErrorWithToast(err, showError, 'Error searching for users. Please try again.');
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, user, composing]);

    const handleNewMessage = () => {
        setComposing(true);
        setSelectedUser(null);
        setMessage('');
        setSearchTerm('');
        setSearchResults([]);
    };

    const handleBackToList = () => {
        setComposing(false);
        setSelectedUser(null);
    };

    const handleUserSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim() || !user?.uid) return;

        try {
            setSearching(true);
            const results = await messagingService.searchUsers(searchTerm, user.uid);
            setSearchResults(results);
        } catch (err) {
            console.error('Error searching for users:', err);
            handleErrorWithToast(err, showError, 'Error searching for users. Please try again.');
        } finally {
            setSearching(false);
        }
    };

    const handleUserSelect = (selectedUser) => {
        setSelectedUser(selectedUser);
        setSearchResults([]);
        setSearchTerm('');
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !user?.uid || !selectedUser?.id) return;

        try {
            setSendingMessage(true);

            const conversation = await messagingService.findOrCreateConversation(
                user.uid,
                selectedUser.id
            );

            await messagingService.sendMessage(
                conversation.id,
                user.uid,
                selectedUser.id,
                message
            );

            navigate(`/messages/${conversation.id}`);
        } catch (err) {
            console.error('Error sending message:', err);
            const errorMsg = handleErrorWithToast(err, showError, 'Failed to send message. Please try again.');
            setError(errorMsg);
        } finally {
            setSendingMessage(false);
        }
    };

    const handleToggleBlockedMessage = (messageId) => {
        if (hiddenMessageIds.includes(messageId)) {
            setHiddenMessageIds(prev => prev.filter(id => id !== messageId));
        } else {
            setHiddenMessageIds(prev => [...prev, messageId]);
        }
    };

    useEffect(() => {
        if (!allMessages.length || !isUserBlocked) return;

        const filteredMessages = allMessages.filter(message => {
            if (message.senderId === user?.uid) return true;

            if (isUserBlocked(message.senderId) && hiddenMessageIds.includes(message.id)) {
                return true;
            }

            return !isUserBlocked(message.senderId) || !shouldBlockContent(message.senderId);
        });

        setConversations(filteredMessages);
    }, [allMessages, isUserBlocked, shouldBlockContent, user?.uid, hiddenMessageIds]);

    const renderMessage = (message) => {
        const isBlocked = message.senderId !== user?.uid && isUserBlocked && isUserBlocked(message.senderId);
        const shouldShow = hiddenMessageIds.includes(message.id);

        if (isBlocked && !shouldShow) {
            return (
                <div key={message.id} className="message received blocked">
                    <BlockedContentIndicator
                        userId={message.senderId}
                        contentType="message"
                        onShowContent={() => handleToggleBlockedMessage(message.id)}
                    />
                </div>
            );
        }

        return (
            <div key={message.id} className="message">
                <p>{message.content}</p>
            </div>
        );
    };

    if (userLoading) {
        return (
            <div className="messages-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="messages-page">
                <div className="auth-required-message">
                    <h2>Sign In Required</h2>
                    <p>Please sign in to access your messages.</p>
                    <Link to="/signin" className="back-link">Sign In</Link>
                </div>
            </div>
        );
    }

    if (composing) {
        return (
            <div className="messages-page">
                <div className="messages-container new-conversation-container">
                    <div className="new-conversation-header">
                        <button className="back-button" onClick={handleBackToList}>
                            <FaArrowLeft />
                        </button>
                        <h2>New Message</h2>
                    </div>

                    {!selectedUser ? (
                        <div className="user-search-section">
                            <form onSubmit={handleUserSearch} className="search-form">
                                <div className="search-input-container">
                                    <input
                                        type="text"
                                        placeholder="Search for a user..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                    <button type="submit" className="search-button" disabled={searching}>
                                        <FaSearch />
                                    </button>
                                </div>
                            </form>

                            <div className="search-results">
                                {searching ? (
                                    <div className="searching-indicator">
                                        <LoadingSpinner size="small" />
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map((user) => (
                                        <div
                                            key={user.id}
                                            className="user-result"
                                            onClick={() => handleUserSelect(user)}
                                        >
                                            <div className="user-avatar">
                                                {user.photoURL ? (
                                                    <img src={user.photoURL} alt={user.displayName} />
                                                ) : (
                                                    <div className="default-avatar">
                                                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="user-info">
                                                <h3 className="user-name">
                                                    {user.displayName || 'User'}
                                                </h3>
                                                <p className="user-email">{user.email}</p>
                                                <Link to={`/user/${user.id}`} className="view-profile-link">
                                                    <FaUser /> View Profile
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                ) : searchTerm ? (
                                    <div className="no-results">No users found matching "{searchTerm}"</div>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div className="compose-message-section">
                            <div className="selected-user">
                                <div className="user-avatar">
                                    {selectedUser.photoURL ? (
                                        <img src={selectedUser.photoURL} alt={selectedUser.displayName} />
                                    ) : (
                                        <div className="default-avatar">
                                            {selectedUser.displayName?.charAt(0) || selectedUser.email?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="user-info">
                                    <h3 className="user-name">
                                        {selectedUser.displayName || 'User'}
                                    </h3>
                                    <p className="user-email">{selectedUser.email}</p>
                                    <Link to={`/user/${selectedUser.id}`} className="view-profile-link">
                                        <FaUser /> View Profile
                                    </Link>
                                </div>
                            </div>

                            <div className="encrypt-badge">
                                <FaLock />
                                <span>End-to-end encrypted</span>
                            </div>

                            <form className="compose-form" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                                <textarea
                                    placeholder="Type your message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                />

                                <div className="compose-actions">
                                    <button
                                        type="button"
                                        className="cancel-button"
                                        onClick={handleBackToList}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="send-button"
                                        disabled={!message.trim() || sendingMessage}
                                    >
                                        {sendingMessage ? (
                                            <div className="sending-indicator">
                                                <LoadingSpinner size="small" />
                                            </div>
                                        ) : (
                                            <div className="send-icon">
                                                <FaPaperPlane />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="messages-page">
            <div className="messages-container">
                <div className="messages-header">
                    <h1>Messages</h1>
                    <button className="new-message-button" onClick={handleNewMessage}>
                        <FaPlus />
                        <span>New Message</span>
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading conversations...</p>
                    </div>
                ) : error ? (
                    <div>
                        {errorToToast(error, showError)}
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="no-messages">
                        <h2>No messages yet</h2>
                        <p>Start a new conversation to message other users</p>
                    </div>
                ) : (
                    <div className="conversations-list">
                        {conversations.map((conversation) => (
                            <Link
                                to={`/messages/${conversation.id}`}
                                key={conversation.id}
                                className={`conversation-item ${conversation.lastMessage && conversation.lastMessage.senderId !== user.uid && !conversation.read ? 'unread' : ''}`}
                            >
                                <div className="conversation-avatar">
                                    {conversation.otherParticipant?.photoURL ? (
                                        <img
                                            src={conversation.otherParticipant.photoURL}
                                            alt={conversation.otherParticipant.displayName}
                                        />
                                    ) : (
                                        <div className="default-avatar">
                                            {conversation.otherParticipant?.displayName?.charAt(0) ||
                                                conversation.otherParticipant?.email?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>

                                <div className="conversation-content">
                                    <div className="conversation-header">
                                        <h3 className="conversation-name">
                                            {conversation.otherParticipant?.displayName ||
                                                conversation.otherParticipant?.email ||
                                                'Unknown User'}
                                            {conversation.otherParticipant?.id && (
                                                <button
                                                    className="view-profile-btn"
                                                    title="View Profile"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        navigate(`/user/${conversation.otherParticipant.id}`);
                                                    }}
                                                >
                                                    <FaUser /> View Profile
                                                </button>
                                            )}
                                        </h3>
                                        <span className="conversation-time">
                                            {conversation.lastMessage?.timestamp?.toDate ?
                                                new Date(conversation.lastMessage.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>

                                    <div className="conversation-preview">
                                        <p>
                                            {conversation.encrypted ? (
                                                <>
                                                    <FaLock size={12} style={{ marginRight: '4px' }} />
                                                    Encrypted message
                                                </>
                                            ) : conversation.lastMessage?.preview || 'Start a conversation'}
                                        </p>
                                        <div className="conversation-meta">
                                            {conversation.encrypted && (
                                                <span className="encrypted-badge">
                                                    <FaLock />
                                                </span>
                                            )}
                                            {conversation.lastMessage &&
                                                conversation.lastMessage.senderId !== user.uid &&
                                                !conversation.read && (
                                                    <span className="unread-badge">1</span>
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