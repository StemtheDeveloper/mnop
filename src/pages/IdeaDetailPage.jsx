import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, updateDoc, query, where, orderBy, getDocs, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import '../styles/IdeaDetailPage.css';
import BlockedContentIndicator from '../components/BlockedContentIndicator';
import { useBlockedContentFilter } from '../components/BlockedContentFilter';

const IdeaDetailPage = () => {
    const { ideaId } = useParams();
    const { currentUser, userProfile } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    const [idea, setIdea] = useState(null);
    const [comments, setComments] = useState([]);
    const [allComments, setAllComments] = useState([]);
    const [hiddenCommentIds, setHiddenCommentIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [commentText, setCommentText] = useState('');

    // Function to toggle visibility of a blocked comment
    const handleToggleBlockedComment = (commentId) => {
        if (hiddenCommentIds.includes(commentId)) {
            setHiddenCommentIds(prev => prev.filter(id => id !== commentId));
        } else {
            setHiddenCommentIds(prev => [...prev, commentId]);
        }
    };

    // Filter comments using the blocked content filter hook
    const filteredComments = useBlockedContentFilter(allComments, 'userId');

    // Effect to update comments based on filtered results and hidden state
    useEffect(() => {
        let commentsToDisplay = [...filteredComments];

        if (allComments.length > filteredComments.length) {
            const blockedComments = allComments.filter(comment => {
                return !filteredComments.some(fc => fc.id === comment.id) &&
                    !hiddenCommentIds.includes(comment.id);
            });
            commentsToDisplay = [...commentsToDisplay, ...blockedComments];
        }

        setComments(commentsToDisplay);
    }, [filteredComments, allComments, hiddenCommentIds]);

    // Fetch idea and comments
    useEffect(() => {
        const fetchIdeaAndComments = async () => {
            if (!ideaId) return;

            try {
                // Fetch idea data
                const ideaRef = doc(db, 'ideas', ideaId);
                const ideaDoc = await getDoc(ideaRef);

                if (!ideaDoc.exists()) {
                    navigate('/ideas');
                    showError("Idea not found");
                    return;
                }

                const ideaData = {
                    id: ideaDoc.id,
                    ...ideaDoc.data(),
                    createdAt: ideaDoc.data().createdAt?.toDate() || new Date()
                };

                // Get user profile for author
                if (ideaData.userId) {
                    const userDoc = await getDoc(doc(db, 'users', ideaData.userId));
                    if (userDoc.exists()) {
                        ideaData.user = {
                            displayName: userDoc.data().displayName || 'Anonymous',
                            photoURL: userDoc.data().photoURL || null
                        };
                    }
                }

                setIdea(ideaData);

                // Fetch comments for this idea
                const commentsRef = collection(db, 'idea_comments');
                const commentsQuery = query(
                    commentsRef,
                    where('ideaId', '==', ideaId),
                    orderBy('createdAt', 'asc')
                );

                const commentSnapshot = await getDocs(commentsQuery);

                // Get comments with user data
                const commentsData = await Promise.all(
                    commentSnapshot.docs.map(async (document) => {
                        const commentData = {
                            id: document.id,
                            ...document.data(),
                            createdAt: document.data().createdAt?.toDate() || new Date()
                        };

                        // Get user profile for each comment
                        if (commentData.userId) {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', commentData.userId));
                                if (userDoc.exists()) {
                                    commentData.user = {
                                        displayName: userDoc.data().displayName || 'Anonymous',
                                        photoURL: userDoc.data().photoURL || null,
                                    };
                                }
                            } catch (error) {
                                console.error("Error fetching user data for comment:", error);
                            }
                        }

                        return commentData;
                    })
                );

                setAllComments(commentsData);
            } catch (error) {
                console.error("Error fetching idea details:", error);
                showError("Failed to load idea details");
            } finally {
                setLoading(false);
            }
        };

        fetchIdeaAndComments();
    }, [ideaId, navigate, showError]);

    // Handle voting for the idea
    const handleVote = async () => {
        if (!currentUser) {
            showError("Please sign in to vote");
            return;
        }

        if (!idea) return;

        try {
            const ideaRef = doc(db, 'ideas', ideaId);
            const voters = idea.voters || [];

            if (voters.includes(currentUser.uid)) {
                // Remove vote
                await updateDoc(ideaRef, {
                    votes: increment(-1),
                    voters: voters.filter(id => id !== currentUser.uid),
                    trendingScore: calculateTrendingScore(
                        idea.votes - 1,
                        idea.createdAt
                    )
                });

                setIdea({
                    ...idea,
                    votes: idea.votes - 1,
                    voters: voters.filter(id => id !== currentUser.uid)
                });
            } else {
                // Add vote
                await updateDoc(ideaRef, {
                    votes: increment(1),
                    voters: [...voters, currentUser.uid],
                    trendingScore: calculateTrendingScore(
                        idea.votes + 1,
                        idea.createdAt
                    )
                });

                setIdea({
                    ...idea,
                    votes: idea.votes + 1,
                    voters: [...voters, currentUser.uid]
                });
            }
        } catch (error) {
            console.error("Error voting:", error);
            showError("Failed to register your vote");
        }
    };

    // Submit a new comment
    const handleCommentSubmit = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showError("Please sign in to comment");
            return;
        }

        if (!commentText.trim()) {
            showError("Comment cannot be empty");
            return;
        }

        setSubmitting(true);

        try {
            // Add comment to Firestore
            const commentData = {
                ideaId,
                userId: currentUser.uid,
                userName: userProfile?.displayName || 'Anonymous',
                userPhotoURL: userProfile?.photoURL || null,
                text: commentText.trim(),
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'idea_comments'), commentData);

            // Update comment count in the idea document
            await updateDoc(doc(db, 'ideas', ideaId), {
                comments: increment(1)
            });

            // Update local state
            const newComment = {
                id: docRef.id,
                ...commentData,
                createdAt: new Date(),
                user: {
                    displayName: userProfile?.displayName || 'Anonymous',
                    photoURL: userProfile?.photoURL || null
                }
            };

            setAllComments([...allComments, newComment]);
            setIdea({
                ...idea,
                comments: (idea.comments || 0) + 1
            });

            // Clear form
            setCommentText('');
            showSuccess("Comment added successfully");
        } catch (error) {
            console.error("Error adding comment:", error);
            showError("Failed to add comment");
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate trending score based on votes and recency
    const calculateTrendingScore = (votes, createdAt) => {
        const now = new Date();
        const ageInHours = (now - createdAt) / (1000 * 60 * 60);
        return votes / (Math.pow(ageInHours + 2, 1.5));
    };

    // Format the date
    const formatDate = (date) => {
        if (!date) return 'recently';
        return formatDistanceToNow(new Date(date), { addSuffix: true });
    };

    if (loading) {
        return (
            <div className="idea-detail-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading idea details...</p>
                </div>
            </div>
        );
    }

    if (!idea) {
        return (
            <div className="idea-detail-page">
                <div className="error-container">
                    <p>Idea not found</p>
                    <Link to="/ideas" className="back-button">Back to Ideas</Link>
                </div>
            </div>
        );
    }

    // Check if current user has voted for this idea
    const hasVoted = currentUser && idea.voters && idea.voters.includes(currentUser.uid);

    // Get user display info - prefer fetched user data, but fallback to idea data
    const displayName = idea.user?.displayName || idea.userName || 'Anonymous';
    const profilePhoto = idea.user?.photoURL || idea.userPhotoURL;

    return (
        <div className="idea-detail-page">
            <div className="idea-detail-container">
                <div className="back-link-container">
                    <Link to="/ideas" className="back-link">
                        <span>←</span> Back to Ideas
                    </Link>
                </div>

                <div className="idea-detail-card">
                    {idea.imageUrl && (
                        <div className="idea-detail-image">
                            <img src={idea.imageUrl} alt={idea.title} />
                        </div>
                    )}

                    <div className="idea-detail-content">
                        <div className="idea-detail-header">
                            <h1>{idea.title}</h1>
                            <div className="idea-detail-meta">
                                <div className="idea-detail-category">
                                    <span className="category-label">{idea.category}</span>
                                </div>
                                <div className="idea-detail-date">
                                    Posted {formatDate(idea.createdAt)}
                                </div>
                            </div>
                        </div>

                        <div className="idea-detail-author">
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
                            <span className="author-name">by {displayName}</span>
                        </div>

                        <div className="idea-detail-description">
                            <p>{idea.description}</p>
                        </div>

                        <div className="idea-detail-footer">
                            <div className="idea-detail-stats">
                                <div className="vote-stats">
                                    <button
                                        className={`vote-button-large ${hasVoted ? 'voted' : ''}`}
                                        onClick={handleVote}
                                        disabled={!currentUser}
                                    >
                                        <span className="vote-icon">⬆</span>
                                        <span className="vote-label">
                                            {hasVoted ? 'Upvoted' : 'Upvote'}
                                        </span>
                                        <span className="vote-count">{idea.votes || 0}</span>
                                    </button>

                                    {!currentUser && (
                                        <div className="signin-prompt">
                                            <Link to="/signin">Sign in</Link> to vote
                                        </div>
                                    )}
                                </div>

                                <div className="comment-stats">
                                    <span className="comment-icon">💬</span>
                                    <span className="comment-count">{comments.length}</span>
                                    <span className="comment-label">Comments</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="comments-section">
                    <h2>{comments.length > 0 ? 'Comments' : 'No comments yet'}</h2>

                    {currentUser ? (
                        <form onSubmit={handleCommentSubmit} className="comment-form">
                            <div className="comment-form-content">
                                {userProfile?.photoURL ? (
                                    <img
                                        src={userProfile.photoURL}
                                        alt={userProfile.displayName}
                                        className="comment-user-avatar"
                                    />
                                ) : (
                                    <div className="comment-user-avatar default-avatar">
                                        {userProfile?.displayName?.charAt(0).toUpperCase() || 'A'}
                                    </div>
                                )}

                                <textarea
                                    placeholder="Add your thoughts..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    required
                                    maxLength={2000}
                                    disabled={submitting}
                                ></textarea>
                            </div>

                            <div className="comment-form-actions">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="post-comment-btn"
                                >
                                    {submitting ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="comment-signin">
                            <Link to="/signin" className="signin-link">Sign in</Link> to leave a comment
                        </div>
                    )}

                    <div className="comments-list">
                        {comments.map(comment => {
                            const isBlocked = isUserBlocked && isUserBlocked(comment.userId);

                            if (isBlocked && !hiddenCommentIds.includes(comment.id)) {
                                return (
                                    <BlockedContentIndicator
                                        key={comment.id}
                                        userId={comment.userId}
                                        contentType="comment"
                                        onShowContent={() => handleToggleBlockedComment(comment.id)}
                                    />
                                );
                            }

                            return (
                                <div key={comment.id} className="comment-item">
                                    <div className="comment-avatar">
                                        {comment.user?.photoURL || comment.userPhotoURL ? (
                                            <img
                                                src={comment.user?.photoURL || comment.userPhotoURL}
                                                alt={comment.user?.displayName || comment.userName}
                                            />
                                        ) : (
                                            <div className="default-avatar">
                                                {(comment.user?.displayName || comment.userName || 'A').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="comment-content">
                                        <div className="comment-header">
                                            <span className="comment-author">
                                                {comment.user?.displayName || comment.userName || 'Anonymous'}
                                            </span>
                                            <span className="comment-time">
                                                {formatDate(comment.createdAt)}
                                            </span>
                                        </div>

                                        <div className="comment-text">
                                            {comment.text}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="related-ideas-prompt">
                    <Link to="/ideas" className="back-to-ideas">
                        Browse more ideas
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default IdeaDetailPage;
