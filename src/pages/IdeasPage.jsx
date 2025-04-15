import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, deleteDoc, where, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { db, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import IdeaCard from '../components/IdeaCard';
import '../styles/IdeasPage.css';

const IdeasPage = () => {
    const { currentUser, userProfile, userRole } = useUser();
    const { showSuccess, showError } = useToast();
    const [ideas, setIdeas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'furniture',
        imageFile: null,
        imagePreview: null
    });
    const [submitting, setSubmitting] = useState(false);
    const [filter, setFilter] = useState('latest');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastVisible, setLastVisible] = useState(null);

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesRef = collection(db, 'categories');
                const snapshot = await getDocs(categoriesRef);
                const categoriesList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                }));
                setCategories(categoriesList);
            } catch (error) {
                console.error("Error fetching categories:", error);
                showError("Failed to load categories");
            }
        };

        fetchCategories();
    }, [showError]);

    // Fetch ideas based on filter and category
    useEffect(() => {
        const fetchIdeas = async () => {
            setLoading(true);
            try {
                const ideasRef = collection(db, 'ideas');
                let q;

                // Apply category filter if not "all"
                if (selectedCategory !== 'all') {
                    q = query(
                        ideasRef,
                        where('category', '==', selectedCategory),
                        limit(12)
                    );
                } else {
                    q = query(ideasRef, limit(12));
                }

                // Apply sorting based on filter
                if (filter === 'latest') {
                    q = query(q, orderBy('createdAt', 'desc'));
                } else if (filter === 'popular') {
                    q = query(q, orderBy('votes', 'desc'));
                } else if (filter === 'trending') {
                    // For trending, we combine recency and popularity
                    q = query(q, orderBy('trendingScore', 'desc'));
                }

                const snapshot = await getDocs(q);

                // Get ideas with user data
                const ideasWithUserData = await Promise.all(
                    snapshot.docs.map(async (document) => {
                        const ideaData = {
                            id: document.id,
                            ...document.data(),
                            createdAt: document.data().createdAt?.toDate() || new Date()
                        };

                        // Get user profile for each idea
                        if (ideaData.userId) {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', ideaData.userId));
                                if (userDoc.exists()) {
                                    ideaData.user = {
                                        displayName: userDoc.data().displayName || 'Anonymous',
                                        photoURL: userDoc.data().photoURL || null,
                                    };
                                }
                            } catch (error) {
                                console.error("Error fetching user data:", error);
                            }
                        }

                        return ideaData;
                    })
                );

                setIdeas(ideasWithUserData);
                setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
                setHasMore(snapshot.docs.length === 12);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching ideas:", error);
                showError("Failed to load ideas");
                setLoading(false);
            }
        };

        fetchIdeas();
    }, [filter, selectedCategory, showError]);

    // Load more ideas
    const handleLoadMore = async () => {
        if (!lastVisible || loadingMore) return;

        setLoadingMore(true);
        try {
            const ideasRef = collection(db, 'ideas');
            let q;

            // Apply category filter if not "all"
            if (selectedCategory !== 'all') {
                q = query(
                    ideasRef,
                    where('category', '==', selectedCategory),
                    limit(12)
                );
            } else {
                q = query(ideasRef, limit(12));
            }

            // Apply sorting based on filter
            if (filter === 'latest') {
                q = query(q, orderBy('createdAt', 'desc'));
            } else if (filter === 'popular') {
                q = query(q, orderBy('votes', 'desc'));
            } else if (filter === 'trending') {
                q = query(q, orderBy('trendingScore', 'desc'));
            }

            // Start after last visible document
            q = query(q, startAfter(lastVisible));

            const snapshot = await getDocs(q);

            // Get ideas with user data
            const moreIdeasWithUserData = await Promise.all(
                snapshot.docs.map(async (document) => {
                    const ideaData = {
                        id: document.id,
                        ...document.data(),
                        createdAt: document.data().createdAt?.toDate() || new Date()
                    };

                    // Get user profile for each idea
                    if (ideaData.userId) {
                        try {
                            const userDoc = await getDoc(doc(db, 'users', ideaData.userId));
                            if (userDoc.exists()) {
                                ideaData.user = {
                                    displayName: userDoc.data().displayName || 'Anonymous',
                                    photoURL: userDoc.data().photoURL || null,
                                };
                            }
                        } catch (error) {
                            console.error("Error fetching user data:", error);
                        }
                    }

                    return ideaData;
                })
            );

            setIdeas(prevIdeas => [...prevIdeas, ...moreIdeasWithUserData]);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 12);
        } catch (error) {
            console.error("Error loading more ideas:", error);
            showError("Failed to load more ideas");
        } finally {
            setLoadingMore(false);
        }
    };

    // Handle form input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    // Handle image selection
    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showError("Image size should not exceed 5MB");
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                showError("Please select an image file");
                return;
            }

            setFormData({
                ...formData,
                imageFile: file,
                imagePreview: URL.createObjectURL(file)
            });
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showError("Please sign in to submit an idea");
            return;
        }

        // Validate form
        if (!formData.title.trim() || !formData.description.trim()) {
            showError("Please fill in all required fields");
            return;
        }

        setSubmitting(true);

        try {
            let imageUrl = null;

            // Upload image if provided
            if (formData.imageFile) {
                const storageRef = ref(storage, `idea_images/${currentUser.uid}/${Date.now()}_${formData.imageFile.name}`);
                const uploadResult = await uploadBytes(storageRef, formData.imageFile);
                imageUrl = await getDownloadURL(uploadResult.ref);
            }

            // Create idea document
            const ideaData = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                imageUrl: imageUrl,
                userId: currentUser.uid,
                userName: userProfile?.displayName || 'Anonymous',
                userPhotoURL: userProfile?.photoURL || null,
                createdAt: serverTimestamp(),
                votes: 0,
                voters: [],
                comments: 0,
                trendingScore: 0 // Initial trending score
            };

            await addDoc(collection(db, 'ideas'), ideaData);

            // Reset form and close modal
            setFormData({
                title: '',
                description: '',
                category: 'furniture',
                imageFile: null,
                imagePreview: null
            });
            setShowModal(false);

            showSuccess("Your idea has been submitted successfully!");

            // Refresh ideas list
            // The useEffect will handle this since we're using the latest filter
        } catch (error) {
            console.error("Error submitting idea:", error);
            showError("Failed to submit your idea. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // Handle voting for an idea
    const handleVote = async (ideaId, currentVotes) => {
        if (!currentUser) {
            showError("Please sign in to vote");
            return;
        }

        try {
            const ideaRef = doc(db, 'ideas', ideaId);
            const ideaDoc = await getDoc(ideaRef);

            if (!ideaDoc.exists()) {
                showError("Idea not found");
                return;
            }

            const voters = ideaDoc.data().voters || [];

            // Check if user already voted
            if (voters.includes(currentUser.uid)) {
                // Remove vote
                await updateDoc(ideaRef, {
                    votes: increment(-1),
                    voters: voters.filter(id => id !== currentUser.uid),
                    trendingScore: calculateTrendingScore(
                        currentVotes - 1,
                        ideaDoc.data().createdAt?.toDate() || new Date()
                    )
                });

                // Update local state
                setIdeas(ideas.map(idea => {
                    if (idea.id === ideaId) {
                        return {
                            ...idea,
                            votes: idea.votes - 1,
                            voters: idea.voters.filter(id => id !== currentUser.uid)
                        };
                    }
                    return idea;
                }));
            } else {
                // Add vote
                await updateDoc(ideaRef, {
                    votes: increment(1),
                    voters: [...voters, currentUser.uid],
                    trendingScore: calculateTrendingScore(
                        currentVotes + 1,
                        ideaDoc.data().createdAt?.toDate() || new Date()
                    )
                });

                // Update local state
                setIdeas(ideas.map(idea => {
                    if (idea.id === ideaId) {
                        return {
                            ...idea,
                            votes: idea.votes + 1,
                            voters: [...(idea.voters || []), currentUser.uid]
                        };
                    }
                    return idea;
                }));
            }
        } catch (error) {
            console.error("Error voting:", error);
            showError("Failed to register your vote");
        }
    };

    // Handle deleting an idea
    const handleDelete = async (ideaId) => {
        if (!currentUser) return;

        if (!window.confirm("Are you sure you want to delete this idea?")) {
            return;
        }

        try {
            // Check if current user is the owner or an admin
            const ideaRef = doc(db, 'ideas', ideaId);
            const ideaDoc = await getDoc(ideaRef);

            if (!ideaDoc.exists()) {
                showError("Idea not found");
                return;
            }

            const ideaData = ideaDoc.data();
            const isOwner = ideaData.userId === currentUser.uid;
            const isAdmin = userRole && (Array.isArray(userRole) ? userRole.includes('admin') : userRole === 'admin');

            if (!isOwner && !isAdmin) {
                showError("You don't have permission to delete this idea");
                return;
            }

            // Delete the idea
            await deleteDoc(ideaRef);

            // Update local state
            setIdeas(ideas.filter(idea => idea.id !== ideaId));

            showSuccess("Idea deleted successfully");
        } catch (error) {
            console.error("Error deleting idea:", error);
            showError("Failed to delete idea");
        }
    };

    // Calculate trending score based on votes and recency
    const calculateTrendingScore = (votes, createdAt) => {
        const now = new Date();
        const ageInHours = (now - createdAt) / (1000 * 60 * 60);
        // Score decays over time, but is boosted by votes
        return votes / (Math.pow(ageInHours + 2, 1.5));
    };

    return (
        <div className="ideas-page">
            <div className="ideas-banner">
                <h1>Innovation Hub</h1>
                <p>Share your product ideas and vote on others to help bring them to life!</p>
            </div>

            <div className="ideas-container">
                <div className="ideas-controls">
                    <div className="filter-controls">
                        <div className="filter-group">
                            <label htmlFor="filter-select">Sort By:</label>
                            <select
                                id="filter-select"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="latest">Latest</option>
                                <option value="popular">Most Popular</option>
                                <option value="trending">Trending</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="category-select">Category:</label>
                            <select
                                id="category-select"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        className="submit-idea-btn"
                        onClick={() => setShowModal(true)}
                    >
                        <span>+</span> Submit New Idea
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading ideas...</p>
                    </div>
                ) : ideas.length === 0 ? (
                    <div className="no-ideas">
                        <div className="no-ideas-icon">💡</div>
                        <h2>No ideas found</h2>
                        <p>Be the first to share an innovative product idea!</p>
                        <button
                            className="submit-idea-btn"
                            onClick={() => setShowModal(true)}
                        >
                            Submit New Idea
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ideas-grid">
                            {ideas.map(idea => (
                                <IdeaCard
                                    key={idea.id}
                                    idea={idea}
                                    currentUser={currentUser}
                                    onVote={handleVote}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="load-more-container">
                                <button
                                    className="load-more-btn"
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Loading...' : 'Load More Ideas'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {showModal && (
                <Modal title="Submit a New Idea" onClose={() => setShowModal(false)}>
                    <form onSubmit={handleSubmit} className="idea-form">
                        <div className="form-group">
                            <label htmlFor="title">Title*</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Enter a catchy title for your idea"
                                required
                                maxLength={100}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="category">Category*</label>
                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                required
                            >
                                {categories.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description*</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe your product idea in detail. What problem does it solve? Who is it for?"
                                required
                                rows={5}
                                maxLength={2000}
                            ></textarea>
                        </div>

                        <div className="form-group">
                            <label htmlFor="image">Image (Optional)</label>
                            <input
                                type="file"
                                id="image"
                                name="image"
                                onChange={handleImageChange}
                                accept="image/*"
                                className="file-input"
                            />
                            <p className="form-help">Max file size: 5MB. Recommended dimensions: 1200x800px</p>

                            {formData.imagePreview && (
                                <div className="image-preview">
                                    <img src={formData.imagePreview} alt="Preview" />
                                    <button
                                        type="button"
                                        className="remove-image"
                                        onClick={() => setFormData({
                                            ...formData,
                                            imageFile: null,
                                            imagePreview: null
                                        })}
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="cancel-btn"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={submitting}
                            >
                                {submitting ? 'Submitting...' : 'Submit Idea'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default IdeasPage;
