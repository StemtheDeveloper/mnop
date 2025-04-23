// Messaging service for handling conversations and messages
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "../config/firebase";
import encryptionService from "./encryptionService";

class MessagingService {
  /**
   * Find or create a conversation between two users
   * @param {string} user1Id - First user's ID
   * @param {string} user2Id - Second user's ID
   * @returns {Promise<Object>} - Conversation object with ID
   */
  async findOrCreateConversation(user1Id, user2Id) {
    try {
      // Check if a conversation already exists between these users
      const conversationsRef = collection(db, "conversations");

      // Query where user1 and user2 are participants (in either order)
      const q1 = query(
        conversationsRef,
        where("participants", "array-contains", user1Id)
      );

      const querySnapshot = await getDocs(q1);

      // Find a conversation that includes both users
      const existingConversation = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        return data.participants.includes(user2Id);
      });

      if (existingConversation) {
        return {
          id: existingConversation.id,
          ...existingConversation.data(),
        };
      }

      // If no conversation exists, create a new one
      const newConversation = {
        participants: [user1Id, user2Id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        encrypted: true, // All messages will be encrypted
      };

      const docRef = await addDoc(conversationsRef, newConversation);

      return {
        id: docRef.id,
        ...newConversation,
      };
    } catch (error) {
      console.error("Error finding or creating conversation:", error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} senderId - Sender's user ID
   * @param {string} recipientId - Recipient's user ID
   * @param {string} content - Message content (plaintext)
   * @param {File|Blob} [attachment] - Optional file attachment (will be encrypted)
   * @returns {Promise<Object>} - Sent message object
   */
  async sendMessage(
    conversationId,
    senderId,
    recipientId,
    content,
    attachment = null
  ) {
    try {
      // Generate encryption key for this conversation
      const encryptionKey = encryptionService.generateConversationKey(
        senderId,
        recipientId
      );

      // Only encrypt content if there is any
      let encryptedContent = "";
      if (content && content.trim()) {
        encryptedContent = encryptionService.encryptMessage(
          content,
          encryptionKey
        );

        if (!encryptedContent && content.trim()) {
          throw new Error("Failed to encrypt message");
        }
      }

      const messagesRef = collection(db, "messages");

      // Handle file attachment if provided
      let attachmentData = null;

      if (attachment) {
        const timestamp = Date.now();
        const fileExtension = attachment.name.split(".").pop().toLowerCase();
        const fileName = `${timestamp}-${Math.random()
          .toString(36)
          .substring(2, 15)}.${fileExtension}`;
        const storagePath = `message_attachments/${conversationId}/${fileName}`;

        // Encrypt the file before uploading
        const encryptionResult = await encryptionService.encryptFile(
          attachment,
          encryptionKey
        );

        if (!encryptionResult) {
          throw new Error("Failed to encrypt file attachment");
        }

        // Upload the encrypted file to storage
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, encryptionResult.encryptedFile);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Create attachment data including original file metadata
        attachmentData = {
          fileName: attachment.name,
          fileType: attachment.type,
          fileSize: attachment.size,
          storagePath: storagePath,
          downloadURL: downloadURL,
          // Include original file metadata for decryption
          originalType: encryptionResult.metadata.originalType,
          originalSize: encryptionResult.metadata.originalSize,
          originalName: encryptionResult.metadata.originalName,
          isEncrypted: true,
        };

        // Encrypt attachment metadata
        const encryptedAttachmentData = encryptionService.encryptMessage(
          JSON.stringify(attachmentData),
          encryptionKey
        );

        attachmentData = {
          ...attachmentData,
          encryptedData: encryptedAttachmentData,
        };
      }

      // Create the message object with encrypted content
      const message = {
        conversationId,
        senderId,
        encryptedContent,
        createdAt: serverTimestamp(),
        read: false,
        encrypted: true,
        hasAttachment: attachment !== null,
        attachmentData: attachmentData,
      };

      // Add the message to Firestore
      const docRef = await addDoc(messagesRef, message);

      // Create preview text based on content and/or attachment
      let previewText = "Encrypted message";
      if (attachment) {
        const fileType = attachment.type.split("/")[0];
        switch (fileType) {
          case "image":
            previewText = "📷 Image";
            break;
          case "video":
            previewText = "🎥 Video";
            break;
          case "audio":
            previewText = "🎵 Audio";
            break;
          default:
            previewText = "📎 File attachment";
        }
      }

      // Update the conversation with the last message
      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        lastMessage: {
          senderId,
          preview: previewText,
          timestamp: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      // Get the notification service and send a message notification
      const notificationService = (await import("./notificationService"))
        .default;

      try {
        // Get sender's display name or email
        const senderDoc = await getDoc(doc(db, "users", senderId));
        const senderName =
          senderDoc.data()?.displayName || senderDoc.data()?.email || "Someone";

        // Send notification to recipient
        await notificationService.sendMessageNotification(
          recipientId,
          senderName,
          attachment ? previewText : "You received a new message", // Generic preview for encrypted messages
          conversationId
        );
      } catch (notifError) {
        console.error("Error sending message notification:", notifError);
      }

      return {
        id: docRef.id,
        ...message,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of conversation objects
   */
  async getUserConversations(userId) {
    try {
      const conversationsRef = collection(db, "conversations");

      // Modified query to avoid index requirement - we'll sort client-side
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );

      const querySnapshot = await getDocs(q);

      const conversations = [];

      // Get user data for each participant to show names
      for (const docSnapshot of querySnapshot.docs) {
        const conversation = {
          id: docSnapshot.id,
          ...docSnapshot.data(),
        };

        // Get the other participant's info
        const otherParticipantId = conversation.participants.find(
          (id) => id !== userId
        );

        try {
          const userDocRef = doc(db, "users", otherParticipantId);
          const userDocSnapshot = await getDoc(userDocRef);

          if (userDocSnapshot.exists()) {
            conversation.otherParticipant = {
              id: otherParticipantId,
              ...userDocSnapshot.data(),
            };
          } else {
            conversation.otherParticipant = {
              id: otherParticipantId,
              displayName: "Unknown User",
            };
          }
        } catch (error) {
          console.error("Error getting participant info:", error);
          conversation.otherParticipant = {
            id: otherParticipantId,
            displayName: "Unknown User",
          };
        }

        conversations.push(conversation);
      }

      // Sort conversations by updatedAt timestamp client-side
      return conversations.sort((a, b) => {
        // Handle missing updatedAt fields
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;

        // Convert timestamps to dates for comparison
        const dateA = a.updatedAt.toDate ? a.updatedAt.toDate() : new Date(0);
        const dateB = b.updatedAt.toDate ? b.updatedAt.toDate() : new Date(0);

        // Sort descending (newest first)
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error getting user conversations:", error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - Current user's ID
   * @param {string} otherUserId - Other participant's ID
   * @returns {Promise<Array>} - Array of message objects with decrypted content
   */
  async getConversationMessages(conversationId, userId, otherUserId) {
    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId),
        orderBy("createdAt", "asc")
      );

      const querySnapshot = await getDocs(q);

      // Generate encryption key for this conversation
      const encryptionKey = encryptionService.generateConversationKey(
        userId,
        otherUserId
      );

      // Decrypt all messages
      const messages = querySnapshot.docs.map((doc) => {
        const message = {
          id: doc.id,
          ...doc.data(),
        };

        // Add decrypted content if this is an encrypted message
        if (message.encrypted && message.encryptedContent) {
          message.decryptedContent = encryptionService.decryptMessage(
            message.encryptedContent,
            encryptionKey
          );
        }

        // Decrypt attachment data if present
        if (
          message.hasAttachment &&
          message.attachmentData &&
          message.attachmentData.encryptedData
        ) {
          try {
            const decryptedAttachmentDataStr = encryptionService.decryptMessage(
              message.attachmentData.encryptedData,
              encryptionKey
            );

            if (decryptedAttachmentDataStr) {
              const decryptedAttachmentData = JSON.parse(
                decryptedAttachmentDataStr
              );
              message.attachmentData = {
                ...message.attachmentData,
                decryptedData: decryptedAttachmentData,
              };
            }
          } catch (decryptError) {
            console.error("Error decrypting attachment data:", decryptError);
          }
        }

        return message;
      });

      // Mark unread messages as read if they're for the current user
      const unreadMessages = messages.filter(
        (message) => !message.read && message.senderId !== userId
      );

      if (unreadMessages.length > 0) {
        const batch = [];
        for (const message of unreadMessages) {
          const messageRef = doc(db, "messages", message.id);
          batch.push(updateDoc(messageRef, { read: true }));
        }

        await Promise.all(batch);
      }

      return messages;
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      throw error;
    }
  }

  /**
   * Get real-time updates for a conversation's messages
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - Current user's ID
   * @param {string} otherUserId - Other participant's ID
   * @param {Function} callback - Callback function to receive updates
   * @returns {Function} - Unsubscribe function
   */
  subscribeToMessages(conversationId, userId, otherUserId, callback) {
    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId)
      );

      // Generate encryption key for this conversation
      const encryptionKey = encryptionService.generateConversationKey(
        userId,
        otherUserId
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];

        snapshot.forEach((doc) => {
          const message = {
            id: doc.id,
            ...doc.data(),
          };

          // Add decrypted content
          if (message.encrypted && message.encryptedContent) {
            message.decryptedContent = encryptionService.decryptMessage(
              message.encryptedContent,
              encryptionKey
            );
          }

          // Decrypt attachment data if present
          if (
            message.hasAttachment &&
            message.attachmentData &&
            message.attachmentData.encryptedData
          ) {
            try {
              const decryptedAttachmentDataStr =
                encryptionService.decryptMessage(
                  message.attachmentData.encryptedData,
                  encryptionKey
                );

              if (decryptedAttachmentDataStr) {
                const decryptedAttachmentData = JSON.parse(
                  decryptedAttachmentDataStr
                );

                // Add the storage path reference for frontend use
                const storagePath =
                  decryptedAttachmentData.storagePath ||
                  message.attachmentData.storagePath;

                // Replace the attachmentData with the decrypted version for easier access in UI
                message.fileData = {
                  name: decryptedAttachmentData.fileName,
                  type: decryptedAttachmentData.fileType,
                  size: decryptedAttachmentData.fileSize,
                  url: decryptedAttachmentData.downloadURL,
                  path: storagePath,
                  // Add a direct storage reference for CORS-free access
                  storageRef: storagePath ? ref(storage, storagePath) : null,
                  // Add original file metadata for decryption
                  originalType:
                    decryptedAttachmentData.originalType ||
                    decryptedAttachmentData.fileType,
                  originalSize:
                    decryptedAttachmentData.originalSize ||
                    decryptedAttachmentData.fileSize,
                  originalName:
                    decryptedAttachmentData.originalName ||
                    decryptedAttachmentData.fileName,
                  isEncrypted: true,
                  // Include the encryption key directly to bypass CORS issues with fetch in the component
                  encryptionKey: encryptionKey,
                };

                // Keep the original data too
                message.attachmentData = {
                  ...message.attachmentData,
                  decryptedData: decryptedAttachmentData,
                };
              }
            } catch (decryptError) {
              console.error("Error decrypting attachment data:", decryptError);
            }
          }

          messages.push(message);
        });

        // Sort messages by createdAt timestamp client-side
        messages.sort((a, b) => {
          // Handle missing createdAt fields
          if (!a.createdAt) return -1;
          if (!b.createdAt) return 1;

          // Convert timestamps to dates for comparison
          const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
          const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);

          // Sort ascending (oldest first)
          return dateA - dateB;
        });

        // Mark messages as read in a separate operation
        const unreadMessages = messages.filter(
          (message) => !message.read && message.senderId !== userId
        );

        if (unreadMessages.length > 0) {
          unreadMessages.forEach(async (message) => {
            const messageRef = doc(db, "messages", message.id);
            await updateDoc(messageRef, { read: true });
          });
        }

        callback(messages);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error subscribing to messages:", error);
      throw error;
    }
  }

  /**
   * Search for users to start a conversation with
   * @param {string} searchTerm - Search term
   * @param {string} currentUserId - Current user's ID
   * @returns {Promise<Array>} - Array of user objects
   */
  async searchUsers(searchTerm, currentUserId) {
    try {
      const usersRef = collection(db, "users");

      // Get all users (we'll filter client-side since Firestore doesn't support
      // case-insensitive search well)
      const querySnapshot = await getDocs(usersRef);

      const users = [];

      querySnapshot.forEach((doc) => {
        // Skip the current user
        if (doc.id === currentUserId) return;

        const userData = doc.data();

        // Check if the user matches the search term (case-insensitive)
        const displayName = userData.displayName || "";
        const email = userData.email || "";

        if (
          displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          email.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          users.push({
            id: doc.id,
            ...userData,
          });
        }
      });

      return users;
    } catch (error) {
      console.error("Error searching users:", error);
      throw error;
    }
  }

  /**
   * Get the number of unread messages across all conversations
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of unread messages
   */
  async getUnreadMessagesCount(userId) {
    try {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("read", "==", false),
        where("senderId", "!=", userId)
      );

      const querySnapshot = await getDocs(q);

      // Filter to only include messages from conversations where the user is a participant
      const unreadMessages = [];

      for (const messageDoc of querySnapshot.docs) {
        const message = messageDoc.data();

        // Get the conversation
        const conversationDoc = await getDoc(
          doc(db, "conversations", message.conversationId)
        );

        if (
          conversationDoc.exists() &&
          conversationDoc.data().participants.includes(userId)
        ) {
          unreadMessages.push(message);
        }
      }

      return unreadMessages.length;
    } catch (error) {
      console.error("Error getting unread messages count:", error);
      return 0;
    }
  }

  /**
   * Delete a message and its attachment if it has one
   * @param {string} messageId - Message ID to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMessage(messageId) {
    try {
      const messageRef = doc(db, "messages", messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data();

      // If there's a file attachment, delete it from storage first
      if (
        messageData.hasAttachment &&
        messageData.attachmentData?.storagePath
      ) {
        const fileRef = ref(storage, messageData.attachmentData.storagePath);
        await deleteObject(fileRef);
      }

      // Now delete the message document
      await deleteDoc(messageRef);

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Delete a conversation and all its messages
   * @param {string} conversationId - ID of the conversation to delete
   * @param {string} userId - Current user's ID (for verification)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteConversation(conversationId, userId) {
    try {
      // 1. Verify the user is a participant in this conversation
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      const conversationData = conversationDoc.data();
      if (!conversationData.participants.includes(userId)) {
        throw new Error("Not authorized to delete this conversation");
      }

      // 2. Get all messages in the conversation
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId)
      );
      const messageSnapshot = await getDocs(q);

      // 3. Delete all message attachments from storage
      const deleteAttachmentPromises = [];
      messageSnapshot.forEach((messageDoc) => {
        const messageData = messageDoc.data();
        if (
          messageData.hasAttachment &&
          messageData.attachmentData?.storagePath
        ) {
          const fileRef = ref(storage, messageData.attachmentData.storagePath);
          deleteAttachmentPromises.push(deleteObject(fileRef));
        }
      });

      // Wait for all attachment deletions to complete
      await Promise.all(deleteAttachmentPromises);

      // 4. Delete all messages using a batch
      const batch = writeBatch(db);
      messageSnapshot.forEach((messageDoc) => {
        batch.delete(messageDoc.ref);
      });

      // 5. Delete the conversation document
      batch.delete(conversationRef);

      // Commit all deletions
      await batch.commit();

      return true;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  }

  /**
   * Edit a message's content
   * @param {string} messageId - ID of the message to edit
   * @param {string} userId - Current user's ID (must be the sender)
   * @param {string} newContent - New message content
   * @param {string} otherUserId - ID of the other participant (needed for encryption)
   * @returns {Promise<Object>} - Updated message object
   */
  async editMessage(messageId, userId, newContent, otherUserId) {
    try {
      // 1. Verify the message exists and user is the sender
      const messageRef = doc(db, "messages", messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data();

      // Verify the user is the sender of this message
      if (messageData.senderId !== userId) {
        throw new Error("Not authorized to edit this message");
      }

      // 2. Get the conversation to verify participants
      const conversationRef = doc(
        db,
        "conversations",
        messageData.conversationId
      );
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Associated conversation not found");
      }

      const conversationData = conversationDoc.data();

      // Verify both users are participants in the conversation
      if (
        !conversationData.participants.includes(userId) ||
        !conversationData.participants.includes(otherUserId)
      ) {
        throw new Error("Invalid conversation participants");
      }

      // 3. Generate encryption key for this conversation
      const encryptionKey = encryptionService.generateConversationKey(
        userId,
        otherUserId
      );

      // 4. Encrypt the new content
      const encryptedContent = encryptionService.encryptMessage(
        newContent,
        encryptionKey
      );

      if (!encryptedContent && newContent.trim()) {
        throw new Error("Failed to encrypt message");
      }

      // 5. Update the message
      const updates = {
        encryptedContent,
        edited: true,
        editedAt: serverTimestamp(),
      };

      await updateDoc(messageRef, updates);

      // 6. Return updated message with decrypted content
      const updatedMessage = {
        id: messageId,
        ...messageData,
        ...updates,
        decryptedContent: newContent,
      };

      return updatedMessage;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  /**
   * Get file type category from MIME type
   * @param {string} mimeType - MIME type of the file
   * @returns {string} - File type category (image, video, audio, document, other)
   */
  getFileTypeCategory(mimeType) {
    if (!mimeType) return "other";

    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (
      mimeType.includes("pdf") ||
      mimeType.includes("document") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("presentation")
    )
      return "document";

    return "other";
  }
}

export default new MessagingService();
