import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaLock, FaFileAlt, FaImage, FaVideo, FaFile, FaPaperclip, FaTimes } from 'react-icons/fa';
import '../styles/MessagesPage.css';
import { useUser } from '../context/UserContext';
import messagingService from '../services/messagingService';
import encryptionService from '../services/encryptionService';
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
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const fileInputRef = useRef(null);

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

        // Allow sending if there's either text or an attachment (or both)
        if ((!newMessage.trim() && !attachment) || !user?.uid || !conversation) return;

        try {
            setSendingMessage(true);

            await messagingService.sendMessage(
                conversationId,
                user.uid,
                conversation.otherParticipant.id,
                newMessage,
                attachment
            );

            setNewMessage('');
            setAttachment(null);
            setAttachmentPreview(null);
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
            setError('File size exceeds 20MB limit');
            return;
        }

        setAttachment(file);

        // Create preview URL for images
        if (file.type.startsWith('image/')) {
            const previewUrl = URL.createObjectURL(file);
            setAttachmentPreview(previewUrl);
        } else {
            setAttachmentPreview(null);
        }
    };

    const removeAttachment = () => {
        setAttachment(null);
        setAttachmentPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const renderAttachmentPreview = () => {
        if (!attachment) return null;

        return (
            <div className="attachment-preview">
                <div className="attachment-preview-header">
                    <span className="attachment-name">{attachment.name}</span>
                    <button className="remove-attachment-btn" onClick={removeAttachment}>
                        <FaTimes />
                    </button>
                </div>
                {attachmentPreview ? (
                    <div className="image-preview">
                        <img src={attachmentPreview} alt="Attachment preview" />
                    </div>
                ) : (
                    <div className="file-preview">
                        <FaFile size={24} />
                        <span>{(attachment.size / 1024).toFixed(2)} KB</span>
                    </div>
                )}
            </div>
        );
    };

    const renderFileAttachment = (fileData) => {
        if (!fileData) return null;

        const fileType = fileData.type ? messagingService.getFileTypeCategory(fileData.type) : 'other';
        const [decryptedUrl, setDecryptedUrl] = useState(null);
        const [decrypting, setDecrypting] = useState(false);
        const encryptionKey = encryptionService.generateConversationKey(
            user.uid,
            conversation.otherParticipant.id
        );

        // Effect to decrypt the file when component mounts
        useEffect(() => {
            const decryptFile = async () => {
                if (fileData.isEncrypted || (fileData.decryptedData && fileData.decryptedData.isEncrypted)) {
                    try {
                        setDecrypting(true);
                        // Extract metadata from decrypted data if available
                        const metadata = {
                            originalType: fileData.originalType || fileData.decryptedData?.originalType || fileData.type || fileData.fileType,
                            originalSize: fileData.originalSize || fileData.decryptedData?.originalSize || fileData.size || fileData.fileSize,
                            originalName: fileData.originalName || fileData.decryptedData?.originalName || fileData.name || fileData.fileName
                        };

                        // Get the encrypted file URL
                        const fileUrl = fileData.url || fileData.downloadURL ||
                            fileData.decryptedData?.downloadURL;

                        // Create a decrypted object URL
                        const decryptedObjUrl = await encryptionService.createDecryptedObjectURL(
                            fileUrl,
                            encryptionKey,
                            metadata
                        );

                        setDecryptedUrl(decryptedObjUrl);
                    } catch (error) {
                        console.error("Failed to decrypt file:", error);
                    } finally {
                        setDecrypting(false);
                    }
                } else {
                    // If the file is not encrypted, just use the original URL
                    setDecryptedUrl(fileData.url || fileData.downloadURL);
                }
            };

            decryptFile();

            // Cleanup function to revoke object URL when component unmounts
            return () => {
                if (decryptedUrl) {
                    URL.revokeObjectURL(decryptedUrl);
                }
            };
        }, [fileData, encryptionKey]);

        // Show loading indicator while decrypting
        if (decrypting) {
            return (
                <div className="attachment-container loading-attachment">
                    <div className="file-icon">
                        <LoadingSpinner size="small" />
                    </div>
                    <div className="file-info">
                        <span className="file-name">Decrypting file...</span>
                    </div>
                </div>
            );
        }

        // If we don't have a decrypted URL yet (and not decrypting), show placeholder
        if (!decryptedUrl && !decrypting) {
            return (
                <div className="attachment-container file-attachment">
                    <div className="file-icon"><FaFile /></div>
                    <div className="file-info">
                        <span className="file-name">Unable to decrypt file</span>
                    </div>
                </div>
            );
        }

        // For images
        if (fileType === 'image') {
            return (
                <div className="attachment-container image-attachment">
                    <a href={decryptedUrl} target="_blank" rel="noopener noreferrer">
                        <img src={decryptedUrl} alt={fileData.name || fileData.fileName || "Image attachment"} />
                    </a>
                </div>
            );
        }

        // For videos
        if (fileType === 'video') {
            return (
                <div className="attachment-container video-attachment">
                    <video controls>
                        <source src={decryptedUrl} type={fileData.originalType || fileData.type || fileData.fileType} />
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        }

        // For other files
        let icon = <FaFile />;
        if (fileType === 'document') icon = <FaFileAlt />;
        if (fileType === 'image') icon = <FaImage />;
        if (fileType === 'video') icon = <FaVideo />;

        return (
            <div className="attachment-container file-attachment">
                <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" className="file-download-link">
                    <div className="file-icon">{icon}</div>
                    <div className="file-info">
                        <span className="file-name">{fileData.name || fileData.fileName || "File attachment"}</span>
                        <span className="file-size">{fileData.size || fileData.fileSize ? `${((fileData.size || fileData.fileSize) / 1024).toFixed(2)} KB` : ''}</span>
                    </div>
                </a>
            </div>
        );
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
                                            {message.decryptedContent && (
                                                <div className="message-text">
                                                    {message.decryptedContent}
                                                </div>
                                            )}

                                            {message.hasAttachment && (message.attachmentData || message.fileData) && (
                                                renderFileAttachment(message.attachmentData || message.fileData)
                                            )}

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

                {attachment && renderAttachmentPreview()}

                <div className="message-input-container">
                    <form className="input-wrapper" onSubmit={handleSendMessage}>
                        <button
                            type="button"
                            className="attach-button"
                            onClick={handleAttachmentClick}
                            disabled={sendingMessage || !!attachment}
                        >
                            <FaPaperclip />
                        </button>
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
                            disabled={((!newMessage.trim() && !attachment) || sendingMessage)}
                        >
                            <FaPaperPlane />
                        </button>
                    </form>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    />
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