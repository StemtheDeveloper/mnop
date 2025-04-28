import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    FaArrowLeft,
    FaPaperPlane,
    FaLock,
    FaFileAlt,
    FaImage,
    FaVideo,
    FaFile,
    FaPaperclip,
    FaTimes,
    FaExclamationTriangle,
    FaEllipsisV,
    FaPen,
    FaTrash,
    FaTrashAlt,
    FaUser
} from 'react-icons/fa';
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
    const [sendProgress, setSendProgress] = useState(0);
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const [activeMessageOptions, setActiveMessageOptions] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const optionsMenuRef = useRef(null);

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

    // const scrollToBottom = () => {
    //     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // };

    // useEffect(() => {
    //     scrollToBottom();
    // }, [messages]);

    useEffect(() => {
        if (userLoading) return;

        const loadConversation = async () => {
            if (!user?.uid || !conversationId) return;

            try {
                setLoading(true);

                const userConversations = await messagingService.getUserConversations(user.uid);
                const currentConversation = userConversations.find(c => c.id === conversationId);

                if (!currentConversation) {
                    setError('Conversation not found');
                    setLoading(false);
                    return;
                }

                setConversation(currentConversation);

                const unsubscribe = messagingService.subscribeToMessages(
                    conversationId,
                    user.uid,
                    currentConversation.otherParticipant.id,
                    (updatedMessages) => {
                        setMessages(updatedMessages);
                        setLoading(false);
                    }
                );

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

        if ((!newMessage.trim() && !attachment) || !user?.uid || !conversation) return;

        try {
            setSendingMessage(true);
            setSendProgress(10);

            const progressInterval = setInterval(() => {
                setSendProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            await messagingService.sendMessage(
                conversationId,
                user.uid,
                conversation.otherParticipant.id,
                newMessage,
                attachment
            );

            clearInterval(progressInterval);
            setSendProgress(100);

            setNewMessage('');
            setAttachment(null);
            setAttachmentPreview(null);

            setTimeout(() => {
                setSendProgress(0);
            }, 500);
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

        if (file.size > 20 * 1024 * 1024) {
            setError('File size exceeds 20MB limit');
            return;
        }

        setAttachment(file);

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

        if (fileType === 'image') {
            return (
                <div className="attachment-container image-attachment">
                    <a href={fileData.url || fileData.downloadURL} target="_blank" rel="noopener noreferrer">
                        <img src={fileData.url || fileData.downloadURL} alt={fileData.name || fileData.fileName || "Image attachment"} />
                    </a>
                </div>
            );
        }

        if (fileType === 'video') {
            return (
                <div className="attachment-container video-attachment">
                    <video controls>
                        <source src={fileData.url || fileData.downloadURL} type={fileData.type || fileData.fileType} />
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        }

        let icon = <FaFile />;
        if (fileType === 'document') icon = <FaFileAlt />;
        if (fileType === 'image') icon = <FaImage />;
        if (fileType === 'video') icon = <FaVideo />;

        return (
            <div className="attachment-container file-attachment">
                <a href={fileData.url || fileData.downloadURL} target="_blank" rel="noopener noreferrer" className="file-download-link">
                    <div className="file-icon">{icon}</div>
                    <div className="file-info">
                        <span className="file-name">{fileData.name || fileData.fileName || "File attachment"}</span>
                        <span className="file-size">{fileData.size || fileData.fileSize ? `${((fileData.size || fileData.fileSize) / 1024).toFixed(2)} KB` : ''}</span>
                    </div>
                </a>
            </div>
        );
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
                setActiveMessageOptions(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleEditMessage = (message) => {
        setEditingMessage(message);
        setEditingContent(message.decryptedContent);
        setActiveMessageOptions(null);
    };

    const cancelEditing = () => {
        setEditingMessage(null);
        setEditingContent('');
    };

    const saveEditedMessage = async () => {
        if (!editingContent.trim() || !user?.uid || !conversation || !editingMessage) return;

        try {
            setIsDeleting(true);
            await messagingService.editMessage(
                editingMessage.id,
                editingContent,
                user.uid,
                conversation.otherParticipant.id
            );
            setEditingMessage(null);
            setEditingContent('');
        } catch (err) {
            console.error('Error editing message:', err);
            setError('Failed to edit message. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!user?.uid || !messageId) return;

        try {
            setIsDeleting(true);
            await messagingService.deleteMessage(messageId, user.uid);
            setActiveMessageOptions(null);
        } catch (err) {
            console.error('Error deleting message:', err);
            setError('Failed to delete message. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteConversation = async () => {
        if (!user?.uid || !conversationId) return;

        try {
            setIsDeleting(true);
            await messagingService.deleteConversation(conversationId, user.uid);
            navigate('/messages');
        } catch (err) {
            console.error('Error deleting conversation:', err);
            setError('Failed to delete conversation. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const toggleMessageOptions = (messageId) => {
        setActiveMessageOptions(activeMessageOptions === messageId ? null : messageId);
    };

    const renderMessageOptions = (message) => {
        if (message.senderId !== user?.uid) return null;

        return (
            <div className="message-options">
                <button
                    className="message-options-btn"
                    onClick={() => toggleMessageOptions(message.id)}
                    aria-label="Message options"
                >
                    <FaEllipsisV />
                </button>

                {activeMessageOptions === message.id && (
                    <div className="message-options-menu" ref={optionsMenuRef}>
                        {!message.hasAttachment && (
                            <button
                                className="option-btn edit-btn"
                                onClick={() => handleEditMessage(message)}
                            >
                                <FaPen /> Edit
                            </button>
                        )}
                        <button
                            className="option-btn delete-btn"
                            onClick={() => handleDeleteMessage(message.id)}
                        >
                            <FaTrash /> Delete
                        </button>
                    </div>
                )}
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
                            <div className="recipient-details">
                                <div className="recipient-name">
                                    {conversation?.otherParticipant?.displayName ||
                                        conversation?.otherParticipant?.email ||
                                        'Unknown User'}
                                </div>
                                {conversation?.otherParticipant?.id && (
                                    <Link
                                        to={`/user/${conversation?.otherParticipant?.id}`}
                                        className="recipient-profile-link"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <FaUser /> View Profile
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="header-controls">
                        <div className="encryption-badge">
                            <FaLock />
                            <span>End-to-end encrypted</span>
                        </div>
                        <button
                            className="delete-conversation-btn"
                            onClick={() => setShowDeleteConfirm(true)}
                            aria-label="Delete conversation"
                        >
                            <FaTrashAlt />
                        </button>
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
                                            {editingMessage?.id === message.id ? (
                                                <div className="edit-message-form">
                                                    <textarea
                                                        value={editingContent}
                                                        onChange={(e) => setEditingContent(e.target.value)}
                                                        className="edit-message-input"
                                                    />
                                                    <div className="edit-message-actions">
                                                        <button
                                                            onClick={cancelEditing}
                                                            className="cancel-edit-btn"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={saveEditedMessage}
                                                            className="save-edit-btn"
                                                            disabled={!editingContent.trim() || isDeleting}
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
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
                                                            {message.edited && <span className="edited-indicator"> (edited)</span>}
                                                        </span>

                                                        <span className="message-encrypted">
                                                            <FaLock size={10} />
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {message.senderId === user.uid && !editingMessage && (
                                            renderMessageOptions(message)
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {attachment && renderAttachmentPreview()}

                <div className="message-input-container">
                    {sendingMessage && (
                        <div className="send-progress-bar">
                            <div className="send-progress" style={{ width: `${sendProgress}%` }}></div>
                        </div>
                    )}
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
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                        />
                        <button
                            type="submit"
                            className="send-button"
                            disabled={(!newMessage.trim() && !attachment) || sendingMessage}
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
                        <span>End-to-end encrypted messages</span>
                        {attachment && (
                            <div className="file-encryption-warning">
                                <FaExclamationTriangle size={12} />
                                <span>Note: Files are not encrypted</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="delete-confirm-modal">
                        <h3>Delete Conversation</h3>
                        <p>Are you sure you want to delete this entire conversation? This action cannot be undone.</p>
                        <div className="delete-confirm-actions">
                            <button
                                className="cancel-delete-btn"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-delete-btn"
                                onClick={handleDeleteConversation}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationPage;