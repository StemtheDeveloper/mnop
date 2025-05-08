import React, { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const IdeaCard = ({ idea, currentUser, onVote, onDelete }) => {
    const [showMore, setShowMore] = useState(false);

    const {
        id,
        title,
        description,
        category,
        imageUrl,
        votes,
        voters = [],
        createdAt,
        comments,
        userId,
        userName,
        userPhotoURL,
        user = {}
    } = idea;

    // Get user display info - prefer fetched user data, but fallback to idea data
    const displayName = user.displayName || userName || 'Anonymous';
    const profilePhoto = user.photoURL || userPhotoURL;

    // Check if current user has voted for this idea
    const hasVoted = currentUser && voters.includes(currentUser.uid);

    // Check if current user can delete this idea
    const canDelete = currentUser && (
        userId === currentUser.uid ||
        (currentUser.role && (
            Array.isArray(currentUser.role)
                ? currentUser.role.includes('admin')
                : currentUser.role === 'admin'
        ))
    );

    // Format the date
    const timeAgo = createdAt
        ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
        : 'recently';

    // Handle description text overflow
    const isLongDescription = description && description.length > 150;
    const displayDescription = isLongDescription && !showMore
        ? `${description.substring(0, 150)}...`
        : description;

    return (
        <div className="idea-card">
            {imageUrl && (
                <div className="idea-image">
                    <img src={imageUrl} alt={title} />
                </div>
            )}

            <div className="idea-content">
                <h3 className="idea-title">{title}</h3>

                <div className="idea-category">
                    <span className="category-tag">{category}</span>
                </div>

                <p className="idea-description">
                    {displayDescription}
                    {isLongDescription && (
                        <button
                            className="read-more-btn"
                            onClick={() => setShowMore(!showMore)}
                        >
                            {showMore ? 'Show less' : 'Read more'}
                        </button>
                    )}
                </p>

                <div className="idea-footer">
                    <div className="idea-author">
                        {profilePhoto ? (
                            <img
                                src={profilePhoto}
                                alt={displayName}
                                className="author-avatar"
                            />
                        ) : (
                            <div className="author-avatar default-avatar">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="author-name">{displayName}</span>
                        <span className="idea-date">{timeAgo}</span>
                    </div>

                    <div className="idea-actions">
                        <button
                            className={`vote-button ${hasVoted ? 'voted' : ''}`}
                            onClick={() => onVote(id, votes)}
                            title={hasVoted ? "Remove vote" : "Vote for this idea"}
                        >
                            <span className="vote-icon">⬆</span>
                            <span className="vote-count">{votes}</span>
                        </button>

                        <Link to={`/ideas/${id}`} className="comments-link">
                            <span className="comments-icon">💬</span>
                            <span className="comments-count">{comments || 0}</span>
                        </Link>

                        {canDelete && (
                            <button
                                className="delete-button"
                                onClick={() => onDelete(id)}
                                title="Delete idea"
                            >
                                <span className="delete-icon">🗑️</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Custom comparison function for React.memo
const areEqual = (prevProps, nextProps) => {
    // Compare idea essential properties
    const prevIdea = prevProps.idea;
    const nextIdea = nextProps.idea;

    // Basic equality check for idea's core properties
    const ideaEqual =
        prevIdea.id === nextIdea.id &&
        prevIdea.title === nextIdea.title &&
        prevIdea.description === nextIdea.description &&
        prevIdea.votes === nextIdea.votes &&
        prevIdea.comments === nextIdea.comments;

    // Check if the current user's voting status changed
    const prevHasVoted = prevProps.currentUser && prevIdea.voters?.includes(prevProps.currentUser.uid);
    const nextHasVoted = nextProps.currentUser && nextIdea.voters?.includes(nextProps.currentUser.uid);

    return (
        ideaEqual &&
        prevHasVoted === nextHasVoted &&
        prevProps.onVote === nextProps.onVote &&
        prevProps.onDelete === nextProps.onDelete
    );
};

export default memo(IdeaCard, areEqual);
