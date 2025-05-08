// filepath: c:\Users\GGPC\Desktop\mnop-app\src\services\cacheService.js

/**
 * Cache Service
 * Provides a centralized caching mechanism for frequently accessed data
 * to reduce Firestore reads and improve application performance
 */
class CacheService {
  constructor() {
    this.cache = {};
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL in milliseconds

    // Configure cache sizes for different data types
    this.maxEntries = {
      products: 100,
      users: 50,
      categories: 20,
      reviews: 200,
      default: 50,
    };

    // Statistics for monitoring cache performance
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
    };
  }

  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found or expired
   */
  get(key) {
    if (!key) return null;

    const cacheItem = this.cache[key];

    // Check if item exists and hasn't expired
    if (cacheItem && cacheItem.expiresAt > Date.now()) {
      this.stats.hits++;
      return cacheItem.value;
    }

    // Item doesn't exist or has expired
    if (cacheItem) {
      // Clean up expired item
      delete this.cache[key];
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {string} category - Data category (e.g., 'products', 'users')
   * @param {number} [ttl] - Time to live in milliseconds (optional, uses default if not specified)
   */
  set(key, value, category = "default", ttl = this.defaultTTL) {
    if (!key || value === undefined) return;

    // Manage cache size for the category
    this.ensureCacheSize(category);

    // Store the item with expiration time
    this.cache[key] = {
      value,
      category,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    };

    this.stats.sets++;
  }

  /**
   * Ensure the cache for a specific category doesn't exceed maximum size
   * Uses LRU (Least Recently Used) eviction policy
   * @param {string} category - Data category
   */
  ensureCacheSize(category) {
    const categoryItems = Object.entries(this.cache).filter(
      ([_, item]) => item.category === category
    );

    const maxSize = this.maxEntries[category] || this.maxEntries.default;

    // If we're at capacity, remove oldest items
    if (categoryItems.length >= maxSize) {
      // Sort by creation time (oldest first)
      const sortedItems = categoryItems.sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      );

      // Remove oldest items to make room (remove 20% of max size)
      const itemsToRemove = Math.max(1, Math.ceil(maxSize * 0.2));
      for (let i = 0; i < itemsToRemove && i < sortedItems.length; i++) {
        delete this.cache[sortedItems[i][0]];
        this.stats.evictions++;
      }
    }
  }

  /**
   * Remove an item from the cache
   * @param {string} key - Cache key to remove
   */
  remove(key) {
    if (this.cache[key]) {
      delete this.cache[key];
    }
  }

  /**
   * Remove all items matching a pattern
   * @param {RegExp} pattern - Regular expression pattern to match keys
   */
  removePattern(pattern) {
    Object.keys(this.cache).forEach((key) => {
      if (pattern.test(key)) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Clear all items in a category
   * @param {string} category - Category to clear
   */
  clearCategory(category) {
    Object.keys(this.cache).forEach((key) => {
      if (this.cache[key].category === category) {
        delete this.cache[key];
      }
    });
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache = {};
  }

  /**
   * Get cache performance statistics
   * @returns {Object} Statistics about cache performance
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate =
      totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      totalRequests,
      hitRate: hitRate.toFixed(2) + "%",
      cacheSize: Object.keys(this.cache).length,
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
    };
  }
}

// Create and export a singleton instance
const cacheService = new CacheService();
export default cacheService;
