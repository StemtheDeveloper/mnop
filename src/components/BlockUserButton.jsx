import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import '../styles/BlockUserButton.css';

/**
 * Button component for blocking/unblocking users
 * 
 * @param {Object} props Component props
 * @param {string} props.userId ID of the user to block/unblock
 * @param {function} props.onBlock Callback after user is blocked
 * @param {function} props.onUnblock Callback after user is unblocked
 * @param {string} props.buttonStyle Style variant (default, outline, text)
 * @param {boolean} props.showIcon Whether to show block icon
 * @param {string} props.className Additional class names
 */
const BlockUserButton = ({
    userId,
    onBlock,
    onUnblock,
    buttonStyle = 'default',
    showIcon = true,
    className = ''
}) => {
    const { currentUser, isUserBlocked, shouldBlockContent, blockUser, unblockUser } = useUser();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Check if this user is blocked
    const isBlocked = isUserBlocked && userId ? isUserBlocked(userId) : false;
    const blocksContent = shouldBlockContent && userId ? shouldBlockContent(userId) : false;

    // Don't show the block button if viewing own profile
    if (!currentUser?.uid || !userId || currentUser.uid === userId) {
        return null;
    }

    const handleBlockClick = () => {
        if (isBlocked) {
            // If already blocked, show the confirmation menu
            setShowOptions(!showOptions);
        } else {
            // If not blocked, show the options menu
            setShowOptions(!showOptions);
        }
    };

    const handleBlockUser = async (blockContentOption = true) => {
        setIsProcessing(true);
        setShowOptions(false);

        try {
            const result = await blockUser(userId, blockContentOption);

            if (result.success && onBlock) {
                onBlock(blockContentOption);
            }
        } catch (err) {
            console.error('Error blocking user:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnblockUser = async () => {
        setIsProcessing(true);
        setShowOptions(false);

        try {
            const result = await unblockUser(userId);

            if (result.success && onUnblock) {
                onUnblock();
            }
        } catch (err) {
            console.error('Error unblocking user:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Determine button classes based on style prop
    const buttonClasses = [
        'block-user-button',
        isBlocked ? 'blocked' : '',
        `style-${buttonStyle}`,
        className
    ].filter(Boolean).join(' ');

    // Determine button icon based on state
    const buttonIcon = isBlocked
        ? '🚫'
        : isHovered ? '❌' : '🚫';

    const buttonText = isProcessing
        ? 'Processing...'
        : isBlocked
            ? `${blocksContent ? 'Blocked & Content Hidden' : 'Blocked'}`
            : 'Block';

    return (
        <div className="block-user-container">
            <button
                className={buttonClasses}
                onClick={handleBlockClick}
                disabled={isProcessing}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                aria-label={isBlocked ? "Unblock this user" : "Block this user"}
                title={isBlocked ? "Click to unblock" : "Block this user"}
            >
                {showIcon && <span className="block-icon">{buttonIcon}</span>}
                <span className="block-text">{buttonText}</span>
            </button>

            {showOptions && !isBlocked && (
                <div className="block-options">
                    <div className="block-options-header">
                        Block this user?
                    </div>
                    <button
                        onClick={() => handleBlockUser(false)}
                        className="block-option-button"
                    >
                        Block User Only
                    </button>
                    <button
                        onClick={() => handleBlockUser(true)}
                        className="block-option-button block-with-content"
                    >
                        Block User & Hide Content
                    </button>
                    <button
                        onClick={() => setShowOptions(false)}
                        className="block-option-button cancel"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {showOptions && isBlocked && (
                <div className="block-options">
                    <div className="block-options-header">
                        Unblock this user?
                    </div>
                    <button
                        onClick={handleUnblockUser}
                        className="block-option-button unblock"
                    >
                        Unblock User
                    </button>
                    <button
                        onClick={() => setShowOptions(false)}
                        className="block-option-button cancel"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};

export default BlockUserButton;
