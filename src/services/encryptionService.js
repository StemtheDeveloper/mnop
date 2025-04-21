// Encryption service for secure messaging
import CryptoJS from "crypto-js";

class EncryptionService {
  /**
   * Generates a secure encryption key for a conversation between two users
   * @param {string} user1Id - First user's ID
   * @param {string} user2Id - Second user's ID
   * @returns {string} - A deterministic encryption key for this conversation
   */
  generateConversationKey(user1Id, user2Id) {
    // Sort IDs to ensure the same key is generated regardless of user order
    const sortedIds = [user1Id, user2Id].sort().join("_");

    // Create a hash of the combined IDs to use as the encryption key
    // This ensures the same key is generated for the same two users
    return CryptoJS.SHA256(sortedIds).toString();
  }

  /**
   * Encrypts a message using AES encryption
   * @param {string} message - The plain text message to encrypt
   * @param {string} encryptionKey - The key to use for encryption
   * @returns {string} - The encrypted message
   */
  encryptMessage(message, encryptionKey) {
    if (!message || !encryptionKey) {
      console.error("Missing required parameters for encryption");
      return null;
    }

    return CryptoJS.AES.encrypt(message, encryptionKey).toString();
  }

  /**
   * Decrypts a message using AES decryption
   * @param {string} encryptedMessage - The encrypted message
   * @param {string} encryptionKey - The key to use for decryption
   * @returns {string} - The decrypted message
   */
  decryptMessage(encryptedMessage, encryptionKey) {
    if (!encryptedMessage || !encryptionKey) {
      console.error("Missing required parameters for decryption");
      return null;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Failed to decrypt message:", error);
      return "[Encrypted message - unable to decrypt]";
    }
  }
}

export default new EncryptionService();
