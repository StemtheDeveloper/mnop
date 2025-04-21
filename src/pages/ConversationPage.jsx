// filepath: c:\Users\GGPC\Desktop\mnop-app\src\pages\ConversationPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import messageService from '../services/messageService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/MessagesPage.css';

const ConversationPage = () => {
    const { conversationId } = useParams();
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast() || {
        showSuccess: () => console.warn('ToastProvider not found.'),
        showError: () => console.warn('ToastProvider not found.')
    };

    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState(null);

    const messageContainerRef = useRef(null);
    const messageInputRef = useRef(null);

    useEffect(() => {
        // Scroll to bottom when messages change
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!currentUser) {
            navigate('/login', { state: { from: `/messages/${conversationId}`, message: 'Please sign in to view messages' } });
            return;
        }

        setLoading(true);
        setError(null);

        // Load conversation details
        const loadConversation = async () => {
            try {
                const conversationData = await messageService.getConversation(conversationId, currentUser.uid);
                setConversation(conversationData);

                // Focus the message input when conversation loads
                if (messageInputRef.current) {
                    messageInputRef.current.focus();
                }
            } catch (err) {
                console.error('Error loading conversation:', err);
                setError('Could not load conversation. It may not exist or you may not have access.');
            } finally {
                setLoading(false);
            }
        };

        loadConversation();

        // Subscribe to messages
        const unsubscribe = messageService.subscribeToMessages(
            conversationId,
            currentUser.uid,
            (messagesList) => {
                setMessages(messagesList);
                setLoading(false);
            }
        );

        return () => {
            unsubscribe(); // Clean up subscription
        };
    }, [conversationId, currentUser, navigate]);

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || sending) return;

        setSending(true);
        setError(null);

        try {
            await messageService.sendMessage(conversationId, currentUser.uid, newMessage);
            setNewMessage('');
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
            showError('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const formatMessageTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    };

    // Group messages by date
    const groupMessagesByDate = () => {
        const groups = {};

        messages.forEach(message => {
            const date = message.timestamp ? formatDate(message.timestamp) : 'Unknown Date';
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
        });

        return groups;
    };

    const messageGroups = groupMessagesByDate();

    if (!currentUser) {
        return (
            <div className="conversation-page">
                <div className="auth-required-message">
                    Please sign in to view messages.
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        {!loading && conversation && (
                            <div className="recipient-info">
                                <div className="recipient-avatar">
                                    {conversation.participantInfo?.[conversation.participants.find(id => id !== currentUser.uid)]?.photoURL ? (
                                        <img
                                            src={conversation.participantInfo[conversation.participants.find(id => id !== currentUser.uid)].photoURL}
                                            alt="Recipient"
                                        />
                                    ) : (
                                        <div className="default-avatar">
                                            {conversation.participantInfo?.[conversation.participants.find(id => id !== currentUser.uid)]?.displayName?.charAt(0) || '?'}
                                        </div>
                                    )}
                                </div>
                                <div className="recipient-name">
                                    {conversation.participantInfo?.[conversation.participants.find(id => id !== currentUser.uid)]?.displayName || 'User'}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="header-right">
                        {conversation?.encrypted && (
                            <div className="encryption-badge" title="End-to-end encrypted conversation">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>Encrypted</span>
                            </div>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading messages...</p>
                    </div>
                ) : error ? (
                    <div className="error-container">
                        <p className="error-message">{error}</p>
                        <Link to="/messages" className="button">
                            Back to Messages
                        </Link>
                    </div>
                ) : (
                    <div className="messages-container" ref={messageContainerRef}>
                        {Object.keys(messageGroups).length === 0 ? (
                            <div className="no-messages-yet">
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            Object.entries(messageGroups).map(([date, dateMessages]) => (
                                <div key={date} className="message-group">
                                    <div className="date-separator">
                                        <span>{date}</span>
                                    </div>
                                    {dateMessages.map(message => (
                                        <div
                                            key={message.id}
                                            className={`message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`}
                                        >
                                            <div className="message-content">
                                                <div className="message-text">
                                                    {message.decryptedContent}
                                                </div>
                                                <div className="message-info">
                                                    <span className="message-time">
                                                        {formatMessageTime(message.timestamp)}
                                                    </span>
                                                    {message.encrypted && (
                                                        <span className="message-encrypted">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                            </svg>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                )}

                <div className="message-input-container">
                    <form onSubmit={handleSendMessage}>
                        <div className="input-wrapper">
                            <textarea
                                ref={messageInputRef}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                className="send-button"
                                disabled={!newMessage.trim() || sending}
                            >
                                {sending ? (
                                    <LoadingSpinner size="small" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                )}
                            </button>
                        </div>
                        {conversation?.encrypted && (
                            <div className="encryption-notice">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>End-to-end encrypted</span>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ConversationPage;