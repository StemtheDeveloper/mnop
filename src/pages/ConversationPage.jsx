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
    FaEye,
    FaDownload,
    FaCheck,
    FaFileArchive
} from 'react-icons/fa';
import '../styles/MessagesPage.css';
import { useUser } from '../context/UserContext';
import messagingService from '../services/messagingService';
import encryptionService from '../services/encryptionService';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

const FileGalleryPreview = ({ messages, isDecrypting, decryptedUrls, decryptErrors, setPendingDecryption }) => {
    const [activeTab, setActiveTab] = useState('images');
    const [fileItems, setFileItems] = useState([]);
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [selectedItems, setSelectedItems] = useState({});
    const [previewItem, setPreviewItem] = useState(null);
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
    }, [fileItems, decryptedUrls, decryptErrors, isDecrypting, setPendingDecryption]);

    // Toggle selection of an item
    const toggleItemSelection = (id) => {
        setSelectedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Count selected items
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;

    // Generate a download URL for a file
    const getDownloadUrl = (file) => {
        const isEncrypted = file.fileData.isEncrypted ||
            (file.fileData.encryptionMetadata && file.fileData.encryptionMetadata.encrypted);

        if (isEncrypted && decryptedUrls[file.url]) {
            return decryptedUrls[file.url];
        }
        return file.url;
    };

    // Download a single file
    const downloadFile = (file) => {
        const downloadUrl = getDownloadUrl(file);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.name || `file-${new Date().getTime()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Download all selected files as ZIP
    const downloadSelectedAsZip = async () => {
        try {
            setDownloadingZip(true);

            // Check if JSZip is available, if not load it dynamically
            if (typeof JSZip === 'undefined') {
                // Create a script element to load JSZip
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.async = true;

                // Wait for the script to load
                await new Promise((resolve, reject) => {
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            // Create new ZIP instance
            const zip = new JSZip();
            const selectedFiles = fileItems.filter(file => selectedItems[file.id]);

            // Add each selected file to the zip
            for (const file of selectedFiles) {
                const downloadUrl = getDownloadUrl(file);
                // Fetch the file data
                const response = await fetch(downloadUrl);
                const blob = await response.blob();
                // Add to zip with filename
                const fileName = file.name || `file-${file.id}`;
                zip.file(fileName, blob);
            }

            // Generate the zip file
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            // Create download link for the zip
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `attachments-${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the object URL
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Error generating zip file:', error);
            alert('Failed to create ZIP file. Please try again.');
        } finally {
            setDownloadingZip(false);
        }
    };

    // Open a preview modal for an item
    const openPreview = (file) => {
        setPreviewItem(file);
    };

    // Close the preview modal
    const closePreview = () => {
        setPreviewItem(null);
    };

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
        const isSelected = !!selectedItems[file.id];

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
                    className={`gallery-item image ${isSelected ? 'selected' : ''}`}
                    ref={setItemRef}
                    key={file.id}
                    onClick={() => toggleItemSelection(file.id)}
                >
                    {content}
                    <div className="gallery-item-overlay">
                        <div className="gallery-item-actions">
                            <button
                                className="gallery-item-action preview"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openPreview(file);
                                }}
                                title="Preview"
                            >
                                <FaEye />
                            </button>
                            <button
                                className="gallery-item-action download"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(file);
                                }}
                                title="Download"
                            >
                                <FaDownload />
                            </button>
                        </div>
                    </div>
                    {isSelected && (
                        <div className="selection-indicator">
                            <FaCheck />
                        </div>
                    )}
                </div>
            );
        } else {
            // File icon based on type
            let icon = <FaFile />;
            if (file.type === 'document') icon = <FaFileAlt />;
            if (file.type === 'video') icon = <FaVideo />;

            return (
                <div
                    className={`gallery-item file ${isSelected ? 'selected' : ''}`}
                    ref={setItemRef}
                    key={file.id}
                    onClick={() => toggleItemSelection(file.id)}
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
                    <div className="gallery-item-overlay">
                        <div className="gallery-item-actions">
                            <button
                                className="gallery-item-action download"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    downloadFile(file);
                                }}
                                title="Download"
                            >
                                <FaDownload />
                            </button>
                        </div>
                    </div>
                    {isSelected && (
                        <div className="selection-indicator">
                            <FaCheck />
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
                <div className="gallery-actions">
                    {selectedCount > 0 && (
                        <button
                            className="download-selected-btn"
                            onClick={downloadSelectedAsZip}
                            disabled={downloadingZip}
                        >
                            {downloadingZip ? (
                                <>
                                    <LoadingSpinner size="small" /> Creating ZIP...
                                </>
                            ) : (
                                <>
                                    <FaDownload /> Download Selected ({selectedCount})
                                </>
                            )}
                        </button>
                    )}
                    <button
                        className="download-all-btn"
                        onClick={() => {
                            // Select all files
                            const newSelection = {};
                            fileItems.forEach(file => {
                                newSelection[file.id] = true;
                            });
                            setSelectedItems(newSelection);
                            // Trigger download
                            downloadSelectedAsZip();
                        }}
                        disabled={downloadingZip || fileItems.length === 0}
                    >
                        <FaFileArchive /> Download All as ZIP
                    </button>
                </div>
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

            {/* Preview Modal */}
            {previewItem && (
                <div className="preview-modal-overlay" onClick={closePreview}>
                    <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
                        <button className="close-preview-btn" onClick={closePreview}>
                            <FaTimes />
                        </button>
                        <h3 className="preview-title">{previewItem.name}</h3>
                        <div className="preview-content">
                            {previewItem.type === 'image' && (
                                <img
                                    src={
                                        previewItem.fileData.isEncrypted && decryptedUrls[previewItem.url]
                                            ? decryptedUrls[previewItem.url]
                                            : previewItem.url
                                    }
                                    alt={previewItem.name}
                                    className="preview-image"
                                />
                            )}
                            {previewItem.type === 'video' && (
                                <video controls className="preview-video">
                                    <source
                                        src={
                                            previewItem.fileData.isEncrypted && decryptedUrls[previewItem.url]
                                                ? decryptedUrls[previewItem.url]
                                                : previewItem.url
                                        }
                                        type={previewItem.fileData.type}
                                    />
                                    Your browser does not support video playback.
                                </video>
                            )}
                            {(previewItem.type !== 'image' && previewItem.type !== 'video') && (
                                <div className="file-preview-placeholder">
                                    <FaFile size={64} />
                                    <p>Preview not available for this file type</p>
                                </div>
                            )}
                        </div>
                        <div className="preview-actions">
                            <button
                                className="preview-download-btn"
                                onClick={() => downloadFile(previewItem)}
                            >
                                <FaDownload /> Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileGalleryPreview;

// Display file gallery preview only when there are messages with attachments
{
    showGallery && messages.some(message => message.hasAttachment) && (
        <FileGalleryPreview
            messages={messages}
            isDecrypting={isDecrypting}
            decryptedUrls={decryptedUrls}
            decryptErrors={decryptErrors}
            setPendingDecryption={setPendingDecryption}
        />
    )
}