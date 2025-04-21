// filepath: c:\Users\GGPC\Desktop\mnop-app\src\services\cryptoService.js
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Service for handling end-to-end encryption operations
 * Uses Web Crypto API for cryptographic operations
 */
class CryptoService {
  constructor() {
    this.keyCache = new Map();
  }

  /**
   * Generate a key pair for a user and store the public key in Firestore
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async generateKeyPair(userId) {
    try {
      // Check if user already has keys in the cache
      if (this.keyCache.has(userId)) {
        return;
      }

      // Check if user already has keys in Firestore
      const keyDoc = await getDoc(doc(db, "cryptoKeys", userId));
      if (keyDoc.exists()) {
        // User already has public key, attempt to retrieve private key from local storage
        const privateKeyJwk = this.getPrivateKeyFromStorage(userId);
        if (privateKeyJwk) {
          try {
            // Import the private key
            const privateKey = await this.importPrivateKey(privateKeyJwk);
            // Import the public key
            const publicKey = await this.importPublicKey(
              keyDoc.data().publicKey
            );

            // Store keys in the cache
            this.keyCache.set(userId, { publicKey, privateKey });
            return;
          } catch (error) {
            console.error(
              "Error importing stored keys, generating new ones:",
              error
            );
            // Continue to generate new keys if import fails
          }
        }
      }

      // Generate new key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true, // extractable
        ["encrypt", "decrypt"] // key usage
      );

      // Export public key to JWK format
      const publicKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        keyPair.publicKey
      );

      // Export private key to JWK format (for storage)
      const privateKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        keyPair.privateKey
      );

      // Save public key to Firestore
      await setDoc(doc(db, "cryptoKeys", userId), {
        publicKey: publicKeyJwk,
        createdAt: new Date(),
      });

      // Save private key to local storage (encrypt with a storage password in production)
      this.savePrivateKeyToStorage(userId, privateKeyJwk);

      // Cache keys
      this.keyCache.set(userId, {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      });
    } catch (error) {
      console.error("Error generating key pair:", error);
      throw error;
    }
  }

  /**
   * Get the public key for a user
   * @param {string} userId - User ID
   * @returns {Promise<CryptoKey>} Public key for the user
   */
  async getPublicKey(userId) {
    try {
      // Check if user's public key is in the cache
      if (this.keyCache.has(userId)) {
        return this.keyCache.get(userId).publicKey;
      }

      // Fetch public key from Firestore
      const keyDoc = await getDoc(doc(db, "cryptoKeys", userId));
      if (!keyDoc.exists()) {
        throw new Error(`Public key not found for user: ${userId}`);
      }

      // Import the public key
      const publicKey = await this.importPublicKey(keyDoc.data().publicKey);

      // Store in cache (without private key)
      this.keyCache.set(userId, { ...this.keyCache.get(userId), publicKey });

      return publicKey;
    } catch (error) {
      console.error("Error getting public key:", error);
      throw error;
    }
  }

  /**
   * Get the current user's private key
   * @param {string} userId - User ID
   * @returns {Promise<CryptoKey>} Private key for the user
   */
  async getPrivateKey(userId) {
    try {
      // Check if user's private key is in the cache
      if (this.keyCache.has(userId) && this.keyCache.get(userId).privateKey) {
        return this.keyCache.get(userId).privateKey;
      }

      // Try to get private key from local storage
      const privateKeyJwk = this.getPrivateKeyFromStorage(userId);
      if (!privateKeyJwk) {
        throw new Error(`Private key not found for user: ${userId}`);
      }

      // Import the private key
      const privateKey = await this.importPrivateKey(privateKeyJwk);

      // Store in cache
      this.keyCache.set(userId, { ...this.keyCache.get(userId), privateKey });

      return privateKey;
    } catch (error) {
      console.error("Error getting private key:", error);
      throw error;
    }
  }

  /**
   * Encrypt a message for a recipient
   * @param {string} message - Message to encrypt
   * @param {string} recipientId - Recipient's user ID
   * @returns {Promise<string>} Base64-encoded encrypted message
   */
  async encryptMessage(message, recipientId) {
    try {
      // Get recipient's public key
      const publicKey = await this.getPublicKey(recipientId);

      // Convert message to ArrayBuffer
      const encoder = new TextEncoder();
      const encodedMessage = encoder.encode(message);

      // Encrypt the message
      const encryptedData = await window.crypto.subtle.encrypt(
        {
          name: "RSA-OAEP",
        },
        publicKey,
        encodedMessage
      );

      // Convert encrypted data to Base64 string
      return this.arrayBufferToBase64(encryptedData);
    } catch (error) {
      console.error("Error encrypting message:", error);
      throw error;
    }
  }

  /**
   * Decrypt a message using the current user's private key
   * @param {string} encryptedMessage - Base64-encoded encrypted message
   * @param {string} userId - Current user's ID
   * @returns {Promise<string>} Decrypted message
   */
  async decryptMessage(encryptedMessage, userId) {
    try {
      // Get user's private key
      const privateKey = await this.getPrivateKey(userId);

      // Convert Base64 string to ArrayBuffer
      const encryptedData = this.base64ToArrayBuffer(encryptedMessage);

      // Decrypt the message
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey,
        encryptedData
      );

      // Convert decrypted data to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error("Error decrypting message:", error);
      return "[Decryption failed]";
    }
  }

  /**
   * Import a public key from JWK format
   * @param {Object} jwk - Public key in JWK format
   * @returns {Promise<CryptoKey>} Imported public key
   */
  async importPublicKey(jwk) {
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  }

  /**
   * Import a private key from JWK format
   * @param {Object} jwk - Private key in JWK format
   * @returns {Promise<CryptoKey>} Imported private key
   */
  async importPrivateKey(jwk) {
    return window.crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["decrypt"]
    );
  }

  /**
   * Save private key to local storage
   * In production, this should be encrypted with a user password
   * @param {string} userId - User ID
   * @param {Object} privateKeyJwk - Private key in JWK format
   */
  savePrivateKeyToStorage(userId, privateKeyJwk) {
    try {
      localStorage.setItem(
        `crypto_private_key_${userId}`,
        JSON.stringify(privateKeyJwk)
      );
    } catch (error) {
      console.error("Error saving private key to storage:", error);
    }
  }

  /**
   * Get private key from local storage
   * @param {string} userId - User ID
   * @returns {Object|null} Private key in JWK format or null if not found
   */
  getPrivateKeyFromStorage(userId) {
    try {
      const keyString = localStorage.getItem(`crypto_private_key_${userId}`);
      return keyString ? JSON.parse(keyString) : null;
    } catch (error) {
      console.error("Error getting private key from storage:", error);
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer} buffer - ArrayBuffer to convert
   * @returns {string} Base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   * @param {string} base64 - Base64 string to convert
   * @returns {ArrayBuffer} Converted ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Remove all keys and reset the service
   * Used for testing or account reset
   * @param {string} userId - User ID to clear keys for
   */
  async clearKeys(userId) {
    this.keyCache.delete(userId);
    localStorage.removeItem(`crypto_private_key_${userId}`);
  }
}

const cryptoService = new CryptoService();
export default cryptoService;
