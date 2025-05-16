import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    FaUser,
    FaShieldAlt,
    FaImages,
    FaTh,
    FaCog,
    FaPlay,
    FaEye
} from 'react-icons/fa';

import { useUser } from '../context/UserContext';
import messagingService from '../services/messagingService';
import encryptionService from '../services/encryptionService';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { useToast } from '../context/ToastContext';
import { errorToToast, handleErrorWithToast } from '../utils/errorToToast';

const FileGalleryPreview = ({ messages, isDecrypting, decryptedUrls, decryptErrors }) => {
    const [activeTab, setActiveTab] = useState('images');
    const [fileItems, setFileItems] = useState([]);
    const observerRef = useRef({});
    const itemRefs = useRef({});

    // Process messages to extract all file attachments
    useEffect(() => {
        const extractFiles = () => {
            const files = [];
            messages.forEach(message => {
                if (message.hasAttachment && (message.attachmentData || message.fileData)) {
                    const fileData = message.attachmentData || message.fileData;
                    const fileType = fileData.type ?
                        messagingService.getFileTypeCategory(fileData.type) : 'other';

                    files.push({
                        id: message.id,
                        url: fileData.url || fileData.downloadURL,
                        name: fileData.name || fileData.fileName || "File",
                        type: fileType,
                        fileData: fileData,
                        timestamp: message.createdAt?.toDate ? message.createdAt.toDate() : new Date()
                    });
                }
            });
            setFileItems(files);
        };

        extractFiles();
    }, [messages]);

    // Create and clean up IntersectionObserver instances
    useEffect(() => {
        // Cleanup function
        return () => {
            // Clean up all observers when component unmounts
            Object.values(observerRef.current).forEach(observer => {
                if (observer) {
                    observer.disconnect();
                }
            });
        };
    }, []);

    // Setup observers when fileItems change
    useEffect(() => {
        fileItems.forEach(file => {
            // Skip if there's already an observer for this file
            if (observerRef.current[file.id]) return;

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            // File is visible, prepare it for decryption if needed
                            const fileData = file.fileData;
                            const isEncrypted = fileData.isEncrypted ||
                                (fileData.encryptionMetadata && fileData.encryptionMetadata.encrypted);

                            if (isEncrypted && !decryptedUrls[file.url] && !decryptErrors[file.url] && !isDecrypting[file.url]) {
                                // Request decryption by adding to pendingDecryption
                                setPendingDecryption(prev => ({
                                    ...prev,
                                    [file.url]: fileData
                                }));
                            }
                        }
                    });
                },
                { threshold: 0.1 } // Trigger when at least 10% of the item is visible
            );

            // Store the observer
            observerRef.current[file.id] = observer;

            // Start observing when the ref is available
            if (itemRefs.current[file.id]) {
                observer.observe(itemRefs.current[file.id]);
            }
        });
    }, [fileItems, decryptedUrls, decryptErrors, isDecrypting]);

    // Filter files based on active tab
    const filteredFiles = fileItems.filter(file => {
        if (activeTab === 'all') return true;
        if (activeTab === 'images') return file.type === 'image';
        if (activeTab === 'documents') return file.type === 'document';
        if (activeTab === 'other') return file.type !== 'image' && file.type !== 'document';
        return true;
    });

    if (fileItems.length === 0) return null;

    // Function to determine if a file is a GIF
    const isGifFile = (file) => {
        return file.fileData.type === 'image/gif' ||
            (file.name && file.name.toLowerCase().endsWith('.gif'));
    };

    const renderFileItem = (file) => {
        const isEncrypted = file.fileData.isEncrypted ||
            (file.fileData.encryptionMetadata && file.fileData.encryptionMetadata.encrypted);

        // Set up the ref callback
        const setItemRef = (element) => {
            itemRefs.current[file.id] = element;

            // If we have an element and an observer, start observing
            if (element && observerRef.current[file.id]) {
                observerRef.current[file.id].observe(element);
            }
        };

        if (file.type === 'image') {
            let content;
            const isGif = isGifFile(file);

            if (isEncrypted) {
                if (isDecrypting[file.url]) {
                    content = (
                        <>
                            <div className="loading-overlay">
                                <LoadingSpinner size="small" />
                            </div>
                        </>
                    );
                } else if (decryptErrors[file.url]) {
                    content = (
                        <>
                            <div className="error-indicator">
                                <FaExclamationTriangle size={10} />
                            </div>
                        </>
                    );
                } else if (decryptedUrls[file.url]) {
                    content = (
                        <>
                            <img src={decryptedUrls[file.url]} alt={file.name} />
                            {isGif && <span className="gif-badge">GIF</span>}
                        </>
                    );
                } else {
                    // Placeholder or loading indicator
                    content = <FaImage size={24} color="#cccccc" />;
                }
            } else {
                content = (
                    <>
                        <img src={file.url} alt={file.name} />
                        {isGif && <span className="gif-badge">GIF</span>}
                    </>
                );
            }

            return (
                <div
                    className={`gallery-item image`}
                    ref={setItemRef}
                    key={file.id}
                >
                    {content}
                </div>
            );
        } else {
            // File icon based on type
            let icon = <FaFile />;
            if (file.type === 'document') icon = <FaFileAlt />;
            if (file.type === 'video') icon = <FaVideo />;

            return (
                <div
                    className="gallery-item file"
                    ref={setItemRef}
                    key={file.id}
                >
                    <div className="file-icon">{icon}</div>
                    <div className="file-name">{file.name}</div>
                    {isEncrypted && isDecrypting[file.url] && (
                        <div className="loading-overlay">
                            <LoadingSpinner size="small" />
                        </div>
                    )}
                    {isEncrypted && decryptErrors[file.url] && (
                        <div className="error-indicator">
                            <FaExclamationTriangle size={10} />
                        </div>
                    )}
                </div>
            );
        }
    };

    return (
        <div className="file-gallery-preview">
            <div className="gallery-header">
                <h3>
                    <FaImages /> Attachments
                </h3>
            </div>

            <div className="gallery-tabs">
                <button
                    className={`gallery-tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    <FaTh /> All ({fileItems.length})
                </button>
                <button
                    className={`gallery-tab ${activeTab === 'images' ? 'active' : ''}`}
                    onClick={() => setActiveTab('images')}
                >
                    <FaImage /> Images ({fileItems.filter(f => f.type === 'image').length})
                </button>
                <button
                    className={`gallery-tab ${activeTab === 'documents' ? 'active' : ''}`}
                    onClick={() => setActiveTab('documents')}
                >
                    <FaFileAlt /> Documents ({fileItems.filter(f => f.type === 'document').length})
                </button>
                <button
                    className={`gallery-tab ${activeTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveTab('other')}
                >
                    <FaFile /> Other ({fileItems.filter(f => f.type !== 'image' && f.type !== 'document').length})
                </button>
            </div>

            <div className="gallery-grid">
                {filteredFiles.map(file => renderFileItem(file))}
            </div>
        </div>
    );
};

const ConversationPage = () => {
    const { conversationId } = useParams();
    const { user, loading: userLoading } = useUser();
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { success: showSuccess, error: showError } = useToast();
    const [sendingMessage, setSendingMessage] = useState(false);
    const [sendProgress, setSendProgress] = useState(0);
    const [attachment, setAttachment] = useState(null);
    const [attachmentPreview, setAttachmentPreview] = useState(null);
    const [activeMessageOptions, setActiveMessageOptions] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    // State variables for file attachments
    const [decryptedUrls, setDecryptedUrls] = useState({});
    const [decryptErrors, setDecryptErrors] = useState({});
    const [isDecrypting, setIsDecrypting] = useState({});
    // Track which attachments need decryption
    const [pendingDecryption, setPendingDecryption] = useState({});

    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const optionsMenuRef = useRef(null);
    const settingsMenuRef = useRef(null);

    // Setup an attachment ref map to store references to attachment elements
    const attachmentRefs = useRef(new Map());

    // Create a single useCallback for attachment ref handling outside of the renderFileAttachment function
    const attachmentRefCallback = useCallback((node, fileUrl, isEncrypted, decryptedUrl, decrypting, decryptError, fileData) => {
        if (!node || !isEncrypted) return;

        // Remove any existing observer
        const existingObserver = attachmentRefs.current.get(fileUrl)?.observer;
        if (existingObserver) {
            existingObserver.disconnect();
        }

        // Create an intersection observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !decryptedUrl && !decrypting && !decryptError) {
                    // This attachment is now visible in the viewport, decrypt it
                    setPendingDecryption(prev => ({
                        ...prev,
                        [fileUrl]: fileData
                    }));
                    // Unobserve once we've triggered decryption
                    observer.unobserve(node);
                }
            });
        }, { threshold: 0.1 }); // Trigger when at least 10% is visible

        // Store the observer and node
        attachmentRefs.current.set(fileUrl, { observer, node });

        // Start observing
        observer.observe(node);

        // Return cleanup function
        return () => {
            observer.disconnect();
            attachmentRefs.current.delete(fileUrl);
        };
    }, []);

    // Effect to clean up all observers on unmount
    useEffect(() => {
        return () => {
            // Clean up all observers when component unmounts
            attachmentRefs.current.forEach(({ observer }) => {
                if (observer) {
                    observer.disconnect();
                }
            });
            attachmentRefs.current.clear();
        };
    }, []);

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

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    };

    useEffect(() => {
        if (messages.length > 0 && !loading) {
            scrollToBottom();
        }
    }, [messages, loading]);

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
                // Use handleErrorWithToast to handle error and show toast notification
                const errorMsg = handleErrorWithToast(err, showError, 'Failed to load conversation. Please try again.');
                setError(errorMsg);
                setLoading(false);
            }
        };

        loadConversation();
    }, [user, userLoading, conversationId]);

    // Decrypt file utility function (updated error handling for CORS errors)
    const decryptFile = async (fileData) => {
        if (!fileData || !conversation) return;

        const fileUrl = fileData.url || fileData.downloadURL;
        if (!fileUrl) return;

        setIsDecrypting(prev => ({ ...prev, [fileUrl]: true }));
        setDecryptErrors(prev => ({ ...prev, [fileUrl]: null }));

        try {
            const encryptionKey = encryptionService.generateConversationKey(
                user.uid,
                conversation.otherParticipant.id
            );

            const objectUrl = await encryptionService.createDecryptedObjectURL(
                fileUrl,
                encryptionKey,
                fileData.encryptionMetadata || {
                    originalType: fileData.fileType || fileData.type,
                    originalSize: fileData.fileSize || fileData.size,
                    originalName: fileData.fileName || fileData.name
                }
            );

            setDecryptedUrls(prev => ({ ...prev, [fileUrl]: objectUrl }));
        } catch (error) {
            console.error('Error decrypting file:', error);
            // Check if error is CORS-related
            const isCorsError = error.message?.includes('CORS') ||
                error.message?.includes('cross-origin') ||
                error.message?.includes('Access-Control-Allow-Origin');

            if (isCorsError && process.env.NODE_ENV === 'development') {
                // In development, show a more helpful error about CORS
                setDecryptErrors(prev => ({ ...prev, [fileUrl]: 'CORS restrictions in development environment. Showing placeholder.' }));
            } else {
                setDecryptErrors(prev => ({ ...prev, [fileUrl]: 'Failed to decrypt file. It may be corrupted or from a different conversation.' }));
            }
        } finally {
            setIsDecrypting(prev => ({ ...prev, [fileUrl]: false }));
            setPendingDecryption(prev => {
                const newState = { ...prev };
                delete newState[fileUrl];
                return newState;
            });
        }
    };

    // Effect for handling decryption requests - replaces the effect inside renderFileAttachment
    useEffect(() => {
        Object.entries(pendingDecryption).forEach(([url, fileData]) => {
            if (!isDecrypting[url] && !decryptedUrls[url] && !decryptErrors[url]) {
                decryptFile(fileData);
            }
        });

        // Cleanup function for object URLs
        return () => {
            Object.values(decryptedUrls).forEach(url => {
                URL.revokeObjectURL(url);
            });
        };
    }, [pendingDecryption, conversation, user]);

    // Add a new useEffect to track files that need decryption
    useEffect(() => {
        // Process messages to find encrypted files that need decryption
        messages.forEach(message => {
            if (message.hasAttachment && (message.attachmentData || message.fileData)) {
                const fileData = message.attachmentData || message.fileData;
                const isEncrypted = fileData.isEncrypted || (fileData.encryptionMetadata && fileData.encryptionMetadata.encrypted);
                const fileUrl = fileData.url || fileData.downloadURL;

                if (isEncrypted && fileUrl &&
                    !decryptedUrls[fileUrl] &&
                    !decryptErrors[fileUrl] &&
                    !isDecrypting[fileUrl] &&
                    !pendingDecryption[fileUrl]) {
                    setPendingDecryption(prev => ({
                        ...prev,
                        [fileUrl]: fileData
                    }));
                }
            }
        });
    }, [messages, decryptedUrls, decryptErrors, isDecrypting, pendingDecryption]);

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
                setSendingMessage(false);
                scrollToBottom();
            }, 500);
        } catch (err) {
            console.error('Error sending message:', err);
            // Use handleErrorWithToast to handle error and show toast notification
            const errorMsg = handleErrorWithToast(err, showError, 'Failed to send message. Please try again.');
            setError(errorMsg);
            setSendingMessage(false);
        }
    };

    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return; if (file.size > 20 * 1024 * 1024) {
            const errorMsg = 'File size exceeds 20MB limit';
            setError(errorMsg);
            showError(errorMsg);
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

    // Update this function to add intersection observer for file decryption
    const renderFileAttachment = useCallback((fileData, messageId) => {
        if (!fileData) return null;

        const fileType = fileData.type ? messagingService.getFileTypeCategory(fileData.type) : 'other';
        const isEncrypted = fileData.isEncrypted || (fileData.encryptionMetadata && fileData.encryptionMetadata.encrypted);
        const fileUrl = fileData.url || fileData.downloadURL;
        const decryptedUrl = decryptedUrls[fileUrl];
        const decryptError = decryptErrors[fileUrl];
        const decrypting = isDecrypting[fileUrl];

        // Check if the file is a GIF
        const isGif = fileData.type === 'image/gif' ||
            (fileData.name && fileData.name.toLowerCase().endsWith('.gif')) ||
            (fileData.fileName && fileData.fileName.toLowerCase().endsWith('.gif'));

        // Reference callback function for intersection observer
        const attachmentRef = (node) => attachmentRefCallback(node, fileUrl, isEncrypted, decryptedUrl, decrypting, decryptError, fileData);

        if (fileType === 'image') {
            if (isEncrypted) {
                if (decrypting) {
                    return (
                        <div className="attachment-container image-attachment is-decrypting" ref={attachmentRef}>
                            <div className="decryption-loader">
                                <LoadingSpinner />
                                <span>Decrypting image...</span>
                            </div>
                        </div>
                    );
                } else if (decryptError) {
                    return (
                        <div className="attachment-container image-attachment error" ref={attachmentRef}>
                            <div className="error-message">
                                <FaExclamationTriangle />
                                <span>{decryptError}</span>
                            </div>
                        </div>
                    );
                } else if (decryptedUrl) {
                    return (
                        <div className={`attachment-container ${isGif ? 'gif-attachment' : 'image-attachment'}`}>
                            <a href={decryptedUrl} target="_blank" rel="noopener noreferrer">
                                <img src={decryptedUrl} alt={fileData.name || fileData.fileName || "Decrypted image"} />
                                {isGif && <span className="gif-badge">GIF</span>}
                            </a>
                        </div>
                    );
                }

                // Placeholder while waiting for decryption to be triggered by visibility
                return (
                    <div className="attachment-container image-attachment" ref={attachmentRef}>
                        <div className="image-placeholder" style={{ width: '200px', height: '150px', backgroundColor: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaImage size={40} color="#cccccc" />
                        </div>
                    </div>
                );
            } else {
                // Regular image handling (including GIFs)
                return (
                    <div className={`attachment-container ${isGif ? 'gif-attachment' : 'image-attachment'}`}>
                        <a href={fileData.url || fileData.downloadURL} target="_blank" rel="noopener noreferrer">
                            <img src={fileData.url || fileData.downloadURL} alt={fileData.name || fileData.fileName || "Image attachment"} />
                            {isGif && <span className="gif-badge">GIF</span>}
                        </a>
                    </div>
                );
            }
        }

        if (fileType === 'video') {
            if (isEncrypted) {
                if (decrypting) {
                    return (
                        <div className="attachment-container video-attachment is-decrypting" ref={attachmentRef}>
                            <div className="decryption-loader">
                                <LoadingSpinner />
                                <span>Decrypting video...</span>
                            </div>
                        </div>
                    );
                } else if (decryptError) {
                    return (
                        <div className="attachment-container video-attachment error" ref={attachmentRef}>
                            <div className="error-message">
                                <FaExclamationTriangle />
                                <span>{decryptError}</span>
                            </div>
                        </div>
                    );
                } else if (decryptedUrl) {
                    return (
                        <div className="attachment-container video-attachment">
                            <div className="video-preview-wrapper">
                                <video controls>
                                    <source src={decryptedUrl} type={fileData.type || fileData.fileType} />
                                    Your browser does not support the video tag.
                                </video>
                                <div className="play-button-overlay">
                                    <FaPlay />
                                </div>
                            </div>
                        </div>
                    );
                }

                // Placeholder while waiting for decryption
                return (
                    <div className="attachment-container video-attachment" ref={attachmentRef}>
                        <div className="video-placeholder" style={{ width: '200px', height: '150px', backgroundColor: '#f0f0f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaVideo size={40} color="#cccccc" />
                        </div>
                    </div>
                );
            } else {
                return (
                    <div className="attachment-container video-attachment">
                        <div className="video-preview-wrapper">
                            <video controls>
                                <source src={fileData.url || fileData.downloadURL} type={fileData.type || fileData.fileType} />
                                Your browser does not support the video tag.
                            </video>
                            <div className="play-button-overlay">
                                <FaPlay />
                            </div>
                        </div>
                    </div>
                );
            }
        }

        // Handle other file types
        let icon = <FaFile />;
        if (fileType === 'document') icon = <FaFileAlt />;
        if (fileType === 'image') icon = <FaImage />;
        if (fileType === 'video') icon = <FaVideo />;

        if (isEncrypted) {
            if (decrypting) {
                return (
                    <div className="attachment-container file-attachment is-decrypting" ref={attachmentRef}>
                        <div className="decryption-loader">
                            <LoadingSpinner />
                            <span>Decrypting file...</span>
                        </div>
                    </div>
                );
            } else if (decryptError) {
                return (
                    <div className="attachment-container file-attachment error" ref={attachmentRef}>
                        <div className="error-message">
                            <FaExclamationTriangle />
                            <span>{decryptError}</span>
                        </div>
                    </div>
                );
            } else if (decryptedUrl) {
                return (
                    <div className="attachment-container file-attachment">
                        <a href={decryptedUrl} target="_blank" rel="noopener noreferrer" download={fileData.name || fileData.fileName} className="file-download-link">
                            <div className="file-icon">{icon}</div>
                            <div className="file-info">
                                <span className="file-name">{fileData.name || fileData.fileName || "File attachment"}</span>
                                <span className="file-size">{fileData.size || fileData.fileSize ? `${((fileData.size || fileData.fileSize) / 1024).toFixed(2)} KB` : ''}</span>
                            </div>
                        </a>
                    </div>
                );
            }

            // Placeholder while waiting for decryption
            return (
                <div className="attachment-container file-attachment" ref={attachmentRef}>
                    <div className="file-placeholder" style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="file-icon">{icon}</div>
                        <div className="file-info">
                            <span className="file-name">{fileData.name || fileData.fileName || "File attachment"}</span>
                            <span className="file-size">{fileData.size || fileData.fileSize ? `${((fileData.size || fileData.fileSize) / 1024).toFixed(2)} KB` : ''}</span>
                        </div>
                    </div>
                </div>
            );
        }

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
    }, [decryptedUrls, decryptErrors, isDecrypting, attachmentRefCallback]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
                setActiveMessageOptions(null);
            }
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
                setShowSettings(false);
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
            // Use handleErrorWithToast to handle error and show toast notification
            const errorMsg = handleErrorWithToast(err, showError, 'Failed to edit message. Please try again.');
            setError(errorMsg);
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
            // Use handleErrorWithToast to handle error and show toast notification
            const errorMsg = handleErrorWithToast(err, showError, 'Failed to delete message. Please try again.');
            setError(errorMsg);
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
            // Use handleErrorWithToast to handle error and show toast notification
            const errorMsg = handleErrorWithToast(err, showError, 'Failed to delete conversation. Please try again.');
            setError(errorMsg);
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
    } if (error) {
        // Show error message as toast notification
        errorToToast(error, showError);
        return (
            <div className="conversation-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
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
                        <div className="settings-dropdown">
                            <button
                                className="settings-button"
                                onClick={() => setShowSettings(!showSettings)}
                                aria-label="Conversation settings"
                            >
                                <FaCog />
                            </button>
                            {showSettings && (
                                <div className="settings-menu" ref={settingsMenuRef}>
                                    <button
                                        className="settings-item"
                                        onClick={() => {
                                            setShowGallery(!showGallery);
                                            setShowSettings(false);
                                        }}
                                    >
                                        <FaImages /> {showGallery ? "Hide Attachments Gallery" : "Show Attachments Gallery"}
                                    </button>
                                    <button
                                        className="settings-item"
                                        onClick={() => {
                                            setShowDeleteConfirm(true);
                                            setShowSettings(false);
                                        }}
                                    >
                                        <FaTrashAlt /> Delete Conversation
                                    </button>
                                </div>
                            )}
                        </div>
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
                                                    {/* Image preview above message if it's an image attachment */}
                                                    {message.hasAttachment && (message.attachmentData || message.fileData) &&
                                                        (message.attachmentData?.type?.startsWith('image/') ||
                                                            message.fileData?.type?.startsWith('image/')) && (
                                                            <div className="image-preview-above-message">
                                                                {isDecrypting[message.attachmentData?.url || message.fileData?.url || message.fileData?.downloadURL] ? (
                                                                    <div className="preview-loading">
                                                                        <LoadingSpinner />
                                                                        <span>Loading image preview...</span>
                                                                    </div>
                                                                ) : decryptedUrls[message.attachmentData?.url || message.fileData?.url || message.fileData?.downloadURL] ? (
                                                                    <img
                                                                        src={decryptedUrls[message.attachmentData?.url || message.fileData?.url || message.fileData?.downloadURL]}
                                                                        alt="Image preview"
                                                                        className="message-image-preview"
                                                                    />
                                                                ) : message.attachmentData?.url || message.fileData?.url || message.fileData?.downloadURL ? (
                                                                    <img
                                                                        src={message.attachmentData?.url || message.fileData?.url || message.fileData?.downloadURL}
                                                                        alt="Image preview"
                                                                        className="message-image-preview"
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        )}

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

                {/* Display file gallery preview only when there are messages with attachments */}
                {showGallery && messages.some(message => message.hasAttachment) && (
                    <FileGalleryPreview
                        messages={messages}
                        isDecrypting={isDecrypting}
                        decryptedUrls={decryptedUrls}
                        decryptErrors={decryptErrors}
                    />
                )}

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
                        <span>End-to-end encrypted messages and files</span>
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