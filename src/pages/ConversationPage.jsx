import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaLock } from 'react-icons/fa';
import '../styles/MessagesPage.css';
import { useUser } from '../context/UserContext';
import messagingService from '../services/messagingService';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

const ConversationPage = () => {
    const { conversationId } = useParams();
    const { user, loading: userLoading } = useUser();
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sendingMessage, setSendingMessage] = useState(false);
    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);

    // Group messages by date
    const groupedMessages = messages.reduce((groups, message) => {
        const date = message.createdAt?.toDate ?
            format(message.createdAt.toDate(), 'yyyy-MM-dd') :
            'unknown-date';

        if (!groups[date]) {
            groups[date] = [];
        }

        groups[date].push(message);
        return groups;
    }, {});

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Wait until the user authentication state is resolved
        if (userLoading) return;

        const loadConversation = async () => {
            if (!user?.uid || !conversationId) return;

            try {
                setLoading(true);

                // Get all user conversations
                const userConversations = await messagingService.getUserConversations(user.uid);

                // Find the current conversation
                const currentConversation = userConversations.find(c => c.id === conversationId);

                if (!currentConversation) {
                    setError('Conversation not found');
                    setLoading(false);
                    return;
                }

                setConversation(currentConversation);

                // Set up real-time subscription to messages
                const unsubscribe = messagingService.subscribeToMessages(
                    conversationId,
                    user.uid,
                    currentConversation.otherParticipant.id,
                    (updatedMessages) => {
                        setMessages(updatedMessages);
                        setLoading(false);
                    }
                );

                // Cleanup subscription on unmount
                return () => unsubscribe();
            } catch (err) {
                console.error('Error loading conversation:', err);
                setError('Failed to load conversation. Please try again.');
                setLoading(false);
            }
        };

        loadConversation();
    }, [user, userLoading, conversationId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !user?.uid || !conversation) return;

        try {
            setSendingMessage(true);

            await messagingService.sendMessage(
                conversationId,
                user.uid,
                conversation.otherParticipant.id,
                newMessage
            );

            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
        } finally {
            setSendingMessage(false);
        }
    };

    if (userLoading) {
        return (
            <div className="conversation-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Checking authentication...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="conversation-page">
                <div className="auth-required-message">
                    <h2>Sign In Required</h2>
                    <p>Please sign in to access your messages.</p>
                    <Link to="/signin" className="back-link">Sign In</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="conversation-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading conversation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="conversation-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p className="error-message">{error}</p>
                    <Link to="/messages" className="back-link">Back to Messages</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="conversation-page">
            <div className="conversation-container">
                <div className="conversation-header">
                    <div className="header-left">
                        <Link to="/messages" className="back-button">
                            <FaArrowLeft />
                        </Link>
                        <div className="recipient-info">
                            <div className="recipient-avatar">
                                {conversation?.otherParticipant?.photoURL ? (
                                    <img
                                        src={conversation.otherParticipant.photoURL}
                                        alt={conversation.otherParticipant.displayName}
                                    />
                                ) : (
                                    <div className="default-avatar">
                                        {conversation?.otherParticipant?.displayName?.charAt(0) ||
                                            conversation?.otherParticipant?.email?.charAt(0) || 'U'}
                                    </div>
                                )}
                            </div>
                            <div className="recipient-name">
                                {conversation?.otherParticipant?.displayName ||
                                    conversation?.otherParticipant?.email ||
                                    'Unknown User'}
                            </div>
                        </div>
                    </div>
                    <div className="encryption-badge">
                        <FaLock />
                        <span>End-to-end encrypted</span>
                    </div>
                </div>

                <div className="messages-container" ref={messageListRef}>
                    {Object.keys(groupedMessages).length === 0 ? (
                        <div className="no-messages-yet">
                            <div className="empty-state-icon">
                                <FaLock size={32} />
                            </div>
                            <h3>No messages yet</h3>
                            <p>Send a message to start an encrypted conversation</p>
                        </div>
                    ) : (
                        Object.entries(groupedMessages).map(([date, messagesForDate]) => (
                            <div key={date} className="message-group">
                                <div className="date-separator">
                                    <span>
                                        {date === format(new Date(), 'yyyy-MM-dd')
                                            ? 'Today'
                                            : date === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
                                                ? 'Yesterday'
                                                : new Date(date).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: new Date(date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                                })}
                                    </span>
                                </div>

                                {messagesForDate.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`message ${message.senderId === user.uid ? 'sent' : 'received'}`}
                                    >
                                        <div className="message-content">
                                            <div className="message-text">
                                                {message.decryptedContent}
                                            </div>
                                            <div className="message-info">
                                                <span className="message-time">
                                                    {message.createdAt?.toDate ?
                                                        format(message.createdAt.toDate(), 'h:mm a') : ''}
                                                </span>

                                                <span className="message-encrypted">
                                                    <FaLock size={10} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="message-input-container">
                    <form className="input-wrapper" onSubmit={handleSendMessage}>
                        <textarea
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                                // Send on Enter (without shift)
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        <button
                            type="submit"
                            className="send-button"
                            disabled={!newMessage.trim() || sendingMessage}
                        >
                            <FaPaperPlane />
                        </button>
                    </form>
                    <div className="encryption-notice">
                        <FaLock size={12} />
                        <span>End-to-end encrypted</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConversationPage;