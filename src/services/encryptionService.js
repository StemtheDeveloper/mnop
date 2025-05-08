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

  /**
   * Encrypts a file using AES encryption
   * @param {File|Blob} file - The file to encrypt
   * @param {string} encryptionKey - The key to use for encryption
   * @returns {Promise<{encryptedFile: Blob, metadata: Object}>} - The encrypted file and its metadata
   */
  async encryptFile(file, encryptionKey) {
    if (!file || !encryptionKey) {
      console.error("Missing required parameters for file encryption");
      return null;
    }

    try {
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Convert ArrayBuffer to WordArray for CryptoJS
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);

      // Encrypt the file content
      const encryptedContent = CryptoJS.AES.encrypt(
        wordArray,
        encryptionKey
      ).toString();

      // Create a new Blob with the encrypted content
      const encryptedBlob = new Blob([encryptedContent], {
        type: "application/encrypted",
      });

      // Return the encrypted file and original metadata
      return {
        encryptedFile: encryptedBlob,
        metadata: {
          originalType: file.type,
          originalSize: file.size,
          originalName: file.name,
          encrypted: true,
        },
      };
    } catch (error) {
      console.error("Failed to encrypt file:", error);
      return null;
    }
  }

  /**
   * Decrypts a file using AES decryption
   * @param {Blob} encryptedBlob - The encrypted file blob
   * @param {string} encryptionKey - The key to use for decryption
   * @param {Object} metadata - Original file metadata including type
   * @returns {Promise<Blob>} - The decrypted file blob
   */
  async decryptFile(encryptedBlob, encryptionKey, metadata) {
    if (!encryptedBlob || !encryptionKey || !metadata) {
      console.error("Missing required parameters for file decryption");
      return null;
    }

    try {
      // Read the encrypted blob as text
      const encryptedContent = await encryptedBlob.text();

      // Decrypt the content
      const decrypted = CryptoJS.AES.decrypt(encryptedContent, encryptionKey);

      // Convert WordArray to Uint8Array
      const wordArray = decrypted;
      const arrayBuffer = wordArrayToArrayBuffer(wordArray);

      // Create a new Blob with the decrypted content and original type
      return new Blob([arrayBuffer], { type: metadata.originalType });
    } catch (error) {
      console.error("Failed to decrypt file:", error);
      return null;
    }
  }

  /**
   * Creates an object URL for an encrypted file
   * @param {string} downloadURL - URL to the encrypted file
   * @param {string} encryptionKey - The key to use for decryption
   * @param {Object} metadata - Original file metadata
   * @returns {Promise<string>} - Object URL for the decrypted file
   */
  async createDecryptedObjectURL(downloadURL, encryptionKey, metadata) {
    try {
      // Try a direct fetch with no special headers or mode first
      let response;
      try {
        response = await fetch(downloadURL);
      } catch (fetchError) {
        console.log(
          "Direct fetch failed, trying alternative approach:",
          fetchError
        );

        // If direct fetch fails, try with 'no-cors' mode
        // Note: This won't give us usable data but might help with detecting availability
        const checkResponse = await fetch(downloadURL, { mode: "no-cors" });

        // If we reach here, the resource exists but CORS is blocking it
        // We'll create a fallback representation instead of trying to fetch the actual content
        throw new Error("Resource exists but CORS is preventing access");
      }

      if (!response.ok) {
        throw new Error(
          `Failed to fetch file: ${response.status} ${response.statusText}`
        );
      }

      const encryptedBlob = await response.blob();

      // Decrypt the file
      const decryptedBlob = await this.decryptFile(
        encryptedBlob,
        encryptionKey,
        metadata
      );

      if (!decryptedBlob) {
        throw new Error("Failed to decrypt file");
      }

      // Create and return an object URL
      return URL.createObjectURL(decryptedBlob);
    } catch (error) {
      console.error("Failed to create decrypted object URL:", error);

      // Create a fallback for development environments
      if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
        try {
          // Create a placeholder image or text based on file type
          const fileType = metadata?.originalType || "application/octet-stream";

          if (fileType.startsWith("image/")) {
            // Create a placeholder image with text
            const canvas = document.createElement("canvas");
            canvas.width = 300;
            canvas.height = 200;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#f0f0f0";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#666666";
            ctx.font = "16px Arial";
            ctx.textAlign = "center";
            ctx.fillText(
              "Encrypted Image",
              canvas.width / 2,
              canvas.height / 2 - 20
            );
            ctx.fillText(
              "(Cannot load due to CORS restrictions)",
              canvas.width / 2,
              canvas.height / 2 + 20
            );

            return new Promise((resolve) => {
              canvas.toBlob((blob) => {
                resolve(URL.createObjectURL(blob));
              }, "image/png");
            });
          } else {
            // For other file types, create a text blob
            const fileSize = metadata?.originalSize
              ? `${(metadata.originalSize / 1024).toFixed(2)} KB`
              : "Unknown size";
            const fileName = metadata?.originalName || "file";
            const fallbackText = `Encrypted File: ${fileName}\nType: ${fileType}\nSize: ${fileSize}\n\nCannot load due to CORS restrictions in development mode.\nPlease deploy your Firebase CORS configuration to resolve this.`;
            const fallbackBlob = new Blob([fallbackText], {
              type: "text/plain",
            });
            return URL.createObjectURL(fallbackBlob);
          }
        } catch (fallbackError) {
          console.error("Fallback approach also failed:", fallbackError);
        }
      }

      throw error;
    }
  }
}

/**
 * Helper function to convert CryptoJS WordArray to ArrayBuffer
 * @param {WordArray} wordArray - CryptoJS WordArray
 * @returns {ArrayBuffer} - ArrayBuffer
 */
function wordArrayToArrayBuffer(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;

  // Create a new ArrayBuffer and Uint8Array based on it
  const buffer = new ArrayBuffer(sigBytes);
  const view = new Uint8Array(buffer);

  // Copy the bytes from WordArray to ArrayBuffer
  for (let i = 0; i < sigBytes; i++) {
    const byteIndex = Math.floor(i / 4);
    const byteOffset = i % 4;
    const wordValue = words[byteIndex];
    view[i] = (wordValue >> (24 - 8 * byteOffset)) & 0xff;
  }

  return buffer;
}

export default new EncryptionService();
