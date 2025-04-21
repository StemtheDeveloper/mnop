// filepath: c:\Users\GGPC\Desktop\mnop-app\src\services\messageService.js
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import cryptoService from "./cryptoService";
import notificationService from "./notificationService";

/**
 * Service for handling messaging functionality with end-to-end encryption
 */
class MessageService {
  constructor() {
    this.conversationsCache = new Map();
  }

  /**
   * Create a new conversation between two users
   * @param {string} senderId - Sender's user ID
   * @param {string} recipientId - Recipient's user ID
   * @param {string} initialMessage - First message content
   * @returns {Promise<string>} - New conversation ID
   */
  async createConversation(senderId, recipientId, initialMessage) {
    try {
      // Verify participants
      if (!senderId || !recipientId) {
        throw new Error("Missing sender or recipient ID");
      }

      // Check if users are same (can't message yourself)
      if (senderId === recipientId) {
        throw new Error("Cannot create conversation with yourself");
      }

      // First check if a conversation already exists between these users
      const existingConversation = await this.findExistingConversation(
        senderId,
        recipientId
      );
      if (existingConversation) {
        // Add a message to the existing conversation
        await this.sendMessage(
          existingConversation.id,
          senderId,
          initialMessage
        );
        return existingConversation.id;
      }

      // Get user info for participants
      const senderDoc = await getDoc(doc(db, "users", senderId));
      const recipientDoc = await getDoc(doc(db, "users", recipientId));

      if (!senderDoc.exists() || !recipientDoc.exists()) {
        throw new Error("One or more participants not found");
      }

      const senderData = senderDoc.data();
      const recipientData = recipientDoc.data();

      // Create new conversation
      const conversationData = {
        participants: [senderId, recipientId],
        participantInfo: {
          [senderId]: {
            displayName: senderData.displayName || "User",
            photoURL: senderData.photoURL || null,
            email: senderData.email || "",
          },
          [recipientId]: {
            displayName: recipientData.displayName || "User",
            photoURL: recipientData.photoURL || null,
            email: recipientData.email || "",
          },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessage: "New conversation started",
        encrypted: true, // E2E encryption enabled
        unreadCount: {
          [senderId]: 0,
          [recipientId]: 1, // Unread for recipient
        },
      };

      // Create new conversation in Firestore
      const conversationRef = await addDoc(
        collection(db, "conversations"),
        conversationData
      );
      const conversationId = conversationRef.id;

      // Add first message
      await this.sendMessage(conversationId, senderId, initialMessage);

      // Send notification to recipient
      await notificationService.sendMessageNotification(
        recipientId,
        senderData.displayName || "User",
        initialMessage,
        conversationId
      );

      return conversationId;
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} senderId - Sender's user ID
   * @param {string} message - Message content
   * @returns {Promise<string>} - New message ID
   */
  async sendMessage(conversationId, senderId, message) {
    try {
      // Get conversation to determine recipient
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      const conversation = conversationDoc.data();

      // Determine recipient (the other participant)
      const recipientId = conversation.participants.find(
        (id) => id !== senderId
      );

      if (!recipientId) {
        throw new Error("Recipient not found in conversation");
      }

      // Encrypt message
      let encryptedContent = message;
      let encrypted = false;

      try {
        // Try to encrypt the message for the recipient
        encryptedContent = await cryptoService.encryptMessage(
          message,
          recipientId
        );
        encrypted = true;
      } catch (error) {
        console.error(
          "Error encrypting message, sending in plain text:",
          error
        );
        // If encryption fails, send in plain text with a warning
        encryptedContent = message;
        encrypted = false;
      }

      // Create message with encryption status
      const messageData = {
        conversationId,
        senderId,
        content: encryptedContent,
        encrypted: encrypted,
        plainContent: encrypted ? "" : message, // Only store plaintext if not encrypted
        createdAt: serverTimestamp(),
        read: {
          [senderId]: true, // Read by sender
          [recipientId]: false, // Unread by recipient
        },
      };

      // Add message to Firestore
      const messageRef = await addDoc(collection(db, "messages"), messageData);

      // Update conversation with last message preview
      await updateDoc(conversationRef, {
        lastMessage:
          message.substring(0, 50) + (message.length > 50 ? "..." : ""),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${recipientId}`]:
          (conversation.unreadCount?.[recipientId] || 0) + 1,
      });

      // Send notification to recipient if they're not in the conversation
      await notificationService.sendMessageNotification(
        recipientId,
        conversation.participantInfo[senderId]?.displayName || "User",
        message.substring(0, 100),
        conversationId
      );

      return messageRef.id;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get a conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - Current user ID (for access control)
   * @returns {Promise<Object>} - Conversation data
   */
  async getConversation(conversationId, userId) {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      const conversation = { id: conversationId, ...conversationDoc.data() };

      // Ensure user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error(
          "Access denied: User is not a participant in this conversation"
        );
      }

      return conversation;
    } catch (error) {
      console.error("Error getting conversation:", error);
      throw error;
    }
  }

  /**
   * Subscribe to messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - Current user ID
   * @param {Function} callback - Callback function for messages
   * @returns {Function} - Unsubscribe function
   */
  subscribeToMessages(conversationId, userId, callback) {
    try {
      // Mark messages as read when subscribing to them
      this.markConversationAsRead(conversationId, userId).catch((error) => {
        console.error("Error marking conversation as read:", error);
      });

      // Query for messages in this conversation, ordered by creation time
      // This query should have a composite index in Firestore
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId),
        orderBy("createdAt", "asc")
      );

      // Subscribe to messages
      return onSnapshot(
        q,
        async (snapshot) => {
          try {
            const messages = [];

            // Process each message
            for (const doc of snapshot.docs) {
              const messageData = { id: doc.id, ...doc.data() };

              // If message is encrypted and user is the recipient, decrypt it
              if (messageData.encrypted && messageData.senderId !== userId) {
                try {
                  // Decrypt the message content
                  const decryptedContent = await cryptoService.decryptMessage(
                    messageData.content,
                    userId
                  );

                  // Add decrypted content to the message
                  messageData.decryptedContent = decryptedContent;
                } catch (error) {
                  console.error("Error decrypting message:", error);
                  messageData.decryptedContent = "[Decryption failed]";
                }
              } else if (!messageData.encrypted) {
                // Message is not encrypted, use plainContent
                messageData.decryptedContent =
                  messageData.plainContent || messageData.content;
              } else {
                // Message is encrypted but user is sender, so they can see plaintext preview
                messageData.decryptedContent =
                  messageData.senderId === userId
                    ? messageData.plainContent || messageData.content
                    : "[Encrypted Message]";
              }

              // Handle timestamps to be safe
              if (
                messageData.createdAt &&
                typeof messageData.createdAt.toDate === "function"
              ) {
                messageData.timestamp = messageData.createdAt.toDate();
              } else {
                messageData.timestamp = new Date();
              }

              messages.push(messageData);
            }

            // Call the callback with sorted messages
            callback(messages);
          } catch (decryptError) {
            console.error("Error processing messages:", decryptError);
            callback([]);
          }
        },
        (error) => {
          console.error("Error in message snapshot listener:", error);

          // If we have an index error, fall back to a simpler query without ordering
          if (error.code === "failed-precondition") {
            console.log("Falling back to unordered message query");

            const fallbackQuery = query(
              messagesRef,
              where("conversationId", "==", conversationId)
            );

            return onSnapshot(fallbackQuery, async (snapshot) => {
              try {
                const messages = [];

                for (const doc of snapshot.docs) {
                  const messageData = { id: doc.id, ...doc.data() };

                  // Same decryption logic as above...
                  if (
                    messageData.encrypted &&
                    messageData.senderId !== userId
                  ) {
                    try {
                      messageData.decryptedContent =
                        await cryptoService.decryptMessage(
                          messageData.content,
                          userId
                        );
                    } catch (error) {
                      messageData.decryptedContent = "[Decryption failed]";
                    }
                  } else if (!messageData.encrypted) {
                    messageData.decryptedContent =
                      messageData.plainContent || messageData.content;
                  } else {
                    messageData.decryptedContent =
                      messageData.senderId === userId
                        ? messageData.plainContent || messageData.content
                        : "[Encrypted Message]";
                  }

                  if (
                    messageData.createdAt &&
                    typeof messageData.createdAt.toDate === "function"
                  ) {
                    messageData.timestamp = messageData.createdAt.toDate();
                  } else {
                    messageData.timestamp = new Date();
                  }

                  messages.push(messageData);
                }

                // Manual sorting by timestamp since we're not using orderBy
                messages.sort((a, b) => {
                  const timeA = a.timestamp ? a.timestamp.getTime() : 0;
                  const timeB = b.timestamp ? b.timestamp.getTime() : 0;
                  return timeA - timeB; // Ascending order (oldest first)
                });

                callback(messages);
              } catch (error) {
                console.error("Error processing messages in fallback:", error);
                callback([]);
              }
            });
          } else {
            callback([]);
            return () => {};
          }
        }
      );
    } catch (error) {
      console.error("Error subscribing to messages:", error);
      callback([]);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Subscribe to all user conversations
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function for conversations
   * @returns {Function} - Unsubscribe function
   */
  subscribeToConversations(userId, callback) {
    try {
      // Query for conversations where user is a participant
      // Remove the orderBy to avoid index requirements
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );

      // Subscribe to conversations
      return onSnapshot(q, (snapshot) => {
        const conversations = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const otherParticipantId = data.participants.find(
            (id) => id !== userId
          );
          const otherUserInfo =
            data.participantInfo?.[otherParticipantId] || {};

          conversations.push({
            id: doc.id,
            otherUserId: otherParticipantId,
            otherUserName: otherUserInfo.displayName || "User",
            otherUserPhoto: otherUserInfo.photoURL || null,
            otherUserEmail: otherUserInfo.email || "",
            lastMessage: data.lastMessage || "",
            lastMessageAt: data.lastMessageAt,
            unreadCount: data.unreadCount?.[userId] || 0,
            encrypted: data.encrypted || false,
          });
        });

        // Sort conversations by lastMessageAt after retrieving them
        conversations.sort((a, b) => {
          const timeA = a.lastMessageAt?.toMillis
            ? a.lastMessageAt.toMillis()
            : 0;
          const timeB = b.lastMessageAt?.toMillis
            ? b.lastMessageAt.toMillis()
            : 0;
          return timeB - timeA; // Descending order (newest first)
        });

        callback(conversations);
      });
    } catch (error) {
      console.error("Error subscribing to conversations:", error);
      callback([]);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Mark a conversation as read for a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async markConversationAsRead(conversationId, userId) {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      // Update conversation's unread count for this user
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0,
      });

      // Query for unread messages
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId),
        where(`read.${userId}`, "==", false)
      );

      const unreadSnapshot = await getDocs(q);

      // Mark all unread messages as read
      const batch = unreadSnapshot.docs.map(async (messageDoc) => {
        const messageRef = doc(db, "messages", messageDoc.id);
        await updateDoc(messageRef, {
          [`read.${userId}`]: true,
        });
      });

      // Wait for all updates to complete
      await Promise.all(batch);
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      throw error;
    }
  }

  /**
   * Delete a message for a user
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteMessage(messageId, userId) {
    try {
      const messageRef = doc(db, "messages", messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data();

      // Check if user is a participant in the conversation
      const conversationRef = doc(
        db,
        "conversations",
        messageData.conversationId
      );
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      const conversation = conversationDoc.data();

      if (!conversation.participants.includes(userId)) {
        throw new Error("Access denied: User cannot delete this message");
      }

      // Mark as deleted for this user (soft delete)
      await updateDoc(messageRef, {
        [`deletedFor.${userId}`]: true,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Find an existing conversation between two users
   * @param {string} user1Id - First user ID
   * @param {string} user2Id - Second user ID
   * @returns {Promise<Object|null>} - Conversation or null if not found
   */
  async findExistingConversation(user1Id, user2Id) {
    try {
      // Query for conversations where both users are participants
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", user1Id)
      );

      const snapshot = await getDocs(q);

      // Check each conversation to see if user2 is a participant
      for (const doc of snapshot.docs) {
        const conversation = doc.data();
        if (conversation.participants.includes(user2Id)) {
          return { id: doc.id, ...conversation };
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding existing conversation:", error);
      return null;
    }
  }
}

const messageService = new MessageService();
export default messageService;
