// filepath: c:\Users\GGPC\Desktop\mnop-app\src\pages\ConversationDetailPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
// Correct the import path for useToast
import { useToast } from '../contexts/ToastContext'; // Changed from ../context/ToastContext
import messageService from '../services/messageService';
import cryptoService from '../services/cryptoService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ConversationDetailPage.css';

const ConversationDetailPage = () => {
    const { conversationId } = useParams();
    const [conversation, setConversation] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    const { currentUser } = useUser();
    // Use the correct function names provided by the context
    const { success, error: showError } = useToast(); // Changed showSuccess to success, kept showError alias for error
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const messageInputRef = useRef(null);

    // Scroll to bottom of messages when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Function to ensure crypto keys are generated for the conversation
    const ensureCryptoKeys = async (conversationData, userId, otherUserId) => {
        try {
            console.log("Ensuring crypto keys are available for conversation");

            // First ensure the user has a key pair
            await cryptoService.generateKeyPair(userId);

            // Check if conversation has a keyId
            if (!conversationData.keyId) {
                console.log("No keyId found in conversation, generating new secure session");

                // Initialize a new secure session
                const { encryptedKey, keyId } = await cryptoService.initializeSecureSession(
                    userId,
                    otherUserId,
                    conversationData.id
                );

                // Update the conversation with the new key information
                await messageService.updateConversationKey(
                    conversationData.id,
                    keyId,
                    userId,
                    encryptedKey
                );

                // Update local state
                setConversation(prev => ({ ...prev, keyId }));

                console.log("New secure session created with keyId:", keyId);
                return keyId;
            }

            // If keyId exists but session key is not in memory, try to load it
            if (conversationData.keyId && !cryptoService.sessionKeys.has(conversationData.keyId)) {
                try {
                    console.log("Loading existing session key with keyId:", conversationData.keyId);
                    await cryptoService.loadAndDecryptSessionKey(conversationData.keyId, userId);
                } catch (error) {
                    console.error("Error loading existing session key:", error);

                    // If loading fails, create a new session
                    console.log("Creating new session key after failed load");
                    const { encryptedKey, keyId } = await cryptoService.initializeSecureSession(
                        userId,
                        otherUserId,
                        conversationData.id
                    );

                    // Update the conversation
                    await messageService.updateConversationKey(
                        conversationData.id,
                        keyId,
                        userId,
                        encryptedKey
                    );

                    // Update local state
                    setConversation(prev => ({ ...prev, keyId }));

                    console.log("Created replacement session key with keyId:", keyId);
                    return keyId;
                }
            }

            return conversationData.keyId;
        } catch (error) {
            console.error("Error ensuring crypto keys:", error);
            throw error;
        }
    };

    // Load conversation data and set up real-time subscription
    useEffect(() => {
        if (!currentUser || !conversationId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        let unsubscribe = null; // Initialize unsubscribe to null

        const fetchConversation = async () => {
            try {
                // Get basic conversation info first
                const conversationInfo = await messageService.getConversationInfo(
                    conversationId,
                    currentUser.uid
                );

                if (!conversationInfo) {
                    throw new Error('Conversation not found');
                }

                setConversation(conversationInfo);

                // Determine the other user in the conversation
                const otherUserId = conversationInfo.participants.find(
                    id => id !== currentUser.uid
                );

                if (otherUserId) {
                    // Get other user data directly from conversationInfo
                    const otherUserData = {
                        id: otherUserId,
                        displayName: conversationInfo.participantNames?.[otherUserId] || 'Unknown User',
                        photoURL: conversationInfo.participantPhotos?.[otherUserId] || null,
                    };
                    setOtherUser(otherUserData);
                } else {
                    throw new Error('Could not determine the other participant.');
                }

                // Mark conversation as read
                await messageService.markConversationAsRead(conversationId, currentUser.uid);

                // Ensure crypto keys are set up
                const currentKeyId = await ensureCryptoKeys(
                    { ...conversationInfo, id: conversationId },
                    currentUser.uid,
                    otherUserId
                );

                // Load and decrypt the session key for this conversation using the determined keyId
                await cryptoService.loadAndDecryptSessionKey(currentKeyId, currentUser.uid);

                // Success, now we can subscribe to real-time messages
                setLoading(false);

                // Set up subscription to messages *after* successfully fetching conversation
                unsubscribe = messageService.subscribeToMessages(
                    conversationId,
                    currentUser.uid, // Pass userId for decryption context
                    async (messagesData) => {
                        // Decrypt the messages before displaying them
                        const decryptedMessages = await Promise.all(
                            messagesData.map(async (message) => {
                                // Check if message is encrypted and has necessary fields
                                if (message.encrypted && message.ciphertext && message.iv) {
                                    try {
                                        // Get the session key (should be loaded by now)
                                        const sessionKey = cryptoService.sessionKeys.get(currentKeyId);
                                        if (!sessionKey) {
                                            console.warn('Session key not available for decryption during subscription update.');
                                            return {
                                                ...message,
                                                decryptedContent: '[Encryption key unavailable]'
                                            };
                                        }

                                        let decryptedContent = '[Encrypted]'; // Default placeholder

                                        // Only decrypt messages sent TO the current user OR FROM the current user
                                        // (Assuming sender also needs to see decrypted content)
                                        // Adjust logic if sender should see ciphertext or a different representation
                                        if (message.recipientId === currentUser.uid || message.senderId === currentUser.uid) {
                                            decryptedContent = await cryptoService.decryptMessage(
                                                message.ciphertext, // Pass ciphertext
                                                message.iv,         // Pass iv
                                                sessionKey          // Pass the CryptoKey
                                            );
                                        }

                                        return {
                                            ...message,
                                            decryptedContent // Use the decrypted content
                                        };
                                    } catch (err) {
                                        console.error('Error decrypting message:', err);
                                        return {
                                            ...message,
                                            decryptedContent: '[Unable to decrypt message]'
                                        };
                                    }
                                } else if (message.encrypted) {
                                    // Encrypted flag is true, but ciphertext/iv might be missing
                                    return {
                                        ...message,
                                        decryptedContent: '[Encrypted data missing]'
                                    };
                                }

                                // If not encrypted, use the plain text content (assuming it exists)
                                return {
                                    ...message,
                                    decryptedContent: message.text || message.content || '' // Adjust based on your non-encrypted message structure
                                };
                            })
                        );

                        setMessages(decryptedMessages);
                    }
                );

            } catch (err) {
                // Catch errors from getConversationInfo or other parts of the try block
                console.error('Error loading conversation:', err);
                // Preserve specific error message if it was set during key init
                if (!error) {
                    setError(err.message || 'Failed to load conversation');
                }
                setLoading(false);
            }
        };

        fetchConversation();

        // Clean up subscription when component unmounts
        return () => {
            // Check if unsubscribe is a function before calling
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [currentUser, conversationId]);

    // Handle sending a new message
    const handleSendMessage = async (e) => {
        e.preventDefault();

        // *** ADDED: Prevent sending if there was an error loading the conversation/keys ***
        if (!newMessage.trim() || !conversation || !otherUser || error) return;

        setSending(true);

        try {
            // Get the session key using the keyId from the conversation state
            const sessionKey = cryptoService.sessionKeys.get(conversation.keyId);

            if (!sessionKey) {
                throw new Error("Session key not available for encryption.");
            }

            // Encrypt the message using the retrieved session key
            const { ciphertext, iv } = await cryptoService.encryptMessage(
                newMessage,
                sessionKey // Pass the actual CryptoKey
            );

            // Send the encrypted message components
            await messageService.sendMessage(
                conversationId,
                currentUser.uid,
                otherUser.id,
                newMessage, // Keep plain text for sender's preview/history if needed
                ciphertext, // Pass ciphertext
                iv          // Pass iv
            );

            // Clear the input
            setNewMessage('');

            // Focus the input for the next message
            messageInputRef.current?.focus();
            // Optionally show success toast
            // success('Message sent!'); // Uncomment if you want a success toast
        } catch (err) {
            console.error('Error sending message:', err);
            showError('Failed to send message'); // Use the showError alias
        } finally {
            setSending(false);
        }
    };

    // Format message timestamp
    const formatMessageTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Handle going back to messages list
    const handleBack = () => {
        navigate('/messages');
    };

    if (!currentUser) {
        return (
            <div className="conversation-detail-page">
                <div className="error-container">
                    <h2>Authentication Required</h2>
                    <p>Please sign in to view this conversation.</p>
                    <Link to="/sign-in" className="back-link">Sign In</Link>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="conversation-detail-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <Link to="/messages" className="back-link">Back to Messages</Link>
                </div>
            </div>
        );
    }

    // *** MODIFIED: Show loading state even if otherUser is not yet loaded, as long as loading is true ***
    if (loading) {
        return (
            <div className="conversation-detail-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading conversation...</p>
                </div>
            </div>
        );
    }

    // *** ADDED: Handle case where loading is finished but conversation/otherUser failed to load (excluding the specific key error handled above) ***
    if (!conversation || !otherUser) {
        // If there's no specific error message already, show a generic one.
        if (!error) {
            setError("Failed to load conversation details.");
        }
        return (
            <div className="conversation-detail-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <Link to="/messages" className="back-link">Back to Messages</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="conversation-detail-page">
            <div className="conversation-header">
                <button
                    className="back-button"
                    onClick={handleBack}
                    aria-label="Back to messages"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="conversation-user">
                    <div className="user-avatar">
                        {otherUser.photoURL ? (
                            <img src={otherUser.photoURL} alt={otherUser.displayName || 'User'} />
                        ) : (
                            <div className="default-avatar">
                                {otherUser.displayName?.charAt(0) || otherUser.email?.charAt(0) || '?'}
                            </div>
                        )}
                    </div>

                    <div className="user-info">
                        <h2>{otherUser.displayName || otherUser.email}</h2>
                        <div className="encryption-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>End-to-end encrypted</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="message-list">
                {messages.length === 0 ? (
                    <div className="no-messages">
                        Start a conversation with {otherUser.displayName || otherUser.email}
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`message-bubble ${message.senderId === currentUser.uid ? 'sent' : 'received'}`}
                        >
                            <div className="message-content">
                                <p>{message.decryptedContent}</p>
                                {message.encrypted && (
                                    <div className="message-encrypted-indicator">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <div className="message-time">
                                {formatMessageTime(message.timestamp)}
                                {message.senderId === currentUser.uid && (
                                    <span className="message-status">
                                        {message.read ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="message-form" onSubmit={handleSendMessage}>
                <div className="form-input-wrapper">
                    <input
                        type="text"
                        ref={messageInputRef}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending || !!error} // Disable input if sending or if there's an error
                    />
                    <div className="encryption-indicator">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                </div>

                <button
                    type="submit"
                    className="send-button"
                    disabled={!newMessage.trim() || sending || !!error} // Disable button if sending or if there's an error
                >
                    {sending ? (
                        <LoadingSpinner size="small" />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
};

export default ConversationDetailPage;