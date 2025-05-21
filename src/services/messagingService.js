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
      // Check if either user has blocked the other
      const user1Doc = await getDoc(doc(db, "users", user1Id));
      const user2Doc = await getDoc(doc(db, "users", user2Id));

      if (!user1Doc.exists() || !user2Doc.exists()) {
        throw new Error("One or both users not found");
      }

      const user1Data = user1Doc.data();
      const user2Data = user2Doc.data();

      // Check if user1 is blocked by user2
      const user2BlockedUsers = user2Data.blockedUsers || [];
      const user1IsBlockedByUser2 = user2BlockedUsers.some(
        (block) => block.userId === user1Id
      );

      // Check if user2 is blocked by user1
      const user1BlockedUsers = user1Data.blockedUsers || [];
      const user2IsBlockedByUser1 = user1BlockedUsers.some(
        (block) => block.userId === user2Id
      );

      if (user1IsBlockedByUser2 || user2IsBlockedByUser1) {
        throw new Error(
          "Unable to create conversation: one of the users has blocked the other"
        );
      }

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
   * @param {File} [attachment] - Optional file attachment
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
      // Check if either user has blocked the other before sending a message
      const senderDoc = await getDoc(doc(db, "users", senderId));
      const recipientDoc = await getDoc(doc(db, "users", recipientId));

      if (!senderDoc.exists() || !recipientDoc.exists()) {
        throw new Error("One or both users not found");
      }

      const senderData = senderDoc.data();
      const recipientData = recipientDoc.data();

      // Check if sender is blocked by recipient
      const recipientBlockedUsers = recipientData.blockedUsers || [];
      const senderIsBlockedByRecipient = recipientBlockedUsers.some(
        (block) => block.userId === senderId
      );

      // Check if recipient is blocked by sender
      const senderBlockedUsers = senderData.blockedUsers || [];
      const recipientIsBlockedBySender = senderBlockedUsers.some(
        (block) => block.userId === recipientId
      );

      if (senderIsBlockedByRecipient || recipientIsBlockedBySender) {
        throw new Error(
          "Unable to send message: one of the users has blocked the other"
        );
      }

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

        // Encrypt the file before upload
        const { encryptedFile, metadata } = await encryptionService.encryptFile(
          attachment,
          encryptionKey
        );

        if (!encryptedFile) {
          throw new Error("Failed to encrypt file attachment");
        }

        // Upload encrypted file to storage
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, encryptedFile);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Create attachment data including encryption metadata
        attachmentData = {
          fileName: attachment.name,
          fileType: attachment.type,
          fileSize: attachment.size,
          storagePath: storagePath,
          downloadURL: downloadURL,
          encryptionMetadata: metadata,
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
            previewText = "📷 Encrypted Image";
            break;
          case "video":
            previewText = "🎥 Encrypted Video";
            break;
          case "audio":
            previewText = "🎵 Encrypted Audio";
            break;
          default:
            previewText = "📎 Encrypted File attachment";
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
   * Edit a message
   * @param {string} messageId - Message ID to edit
   * @param {string} newContent - New message content
   * @param {string} senderId - ID of the sender (to verify permissions)
   * @param {string} recipientId - ID of the recipient (for encryption)
   * @returns {Promise<Object>} - Updated message object
   */
  async editMessage(messageId, newContent, senderId, recipientId) {
    try {
      const messageRef = doc(db, "messages", messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data();

      // Verify the user is the sender
      if (messageData.senderId !== senderId) {
        throw new Error("You can only edit your own messages");
      }

      // Generate encryption key for this conversation
      const encryptionKey = encryptionService.generateConversationKey(
        senderId,
        recipientId
      );

      // Encrypt the new content
      const encryptedContent = encryptionService.encryptMessage(
        newContent,
        encryptionKey
      );

      if (!encryptedContent) {
        throw new Error("Failed to encrypt message");
      }

      // Update the message with the new encrypted content and add edited flag
      await updateDoc(messageRef, {
        encryptedContent,
        edited: true,
        editedAt: serverTimestamp(),
      });

      // Get the updated message
      const updatedMessageDoc = await getDoc(messageRef);
      const updatedMessage = {
        id: updatedMessageDoc.id,
        ...updatedMessageDoc.data(),
      };

      // Add decrypted content
      updatedMessage.decryptedContent = encryptionService.decryptMessage(
        updatedMessage.encryptedContent,
        encryptionKey
      );

      return updatedMessage;
    } catch (error) {
      console.error("Error editing message:", error);
      throw error;
    }
  }

  /**
   * Delete a message and its attachment if it has one
   * @param {string} messageId - Message ID to delete
   * @param {string} userId - ID of the user attempting to delete (for permission check)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMessage(messageId, userId) {
    try {
      const messageRef = doc(db, "messages", messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error("Message not found");
      }

      const messageData = messageDoc.data();

      // Verify the user is the sender
      if (messageData.senderId !== userId) {
        throw new Error("You can only delete your own messages");
      }

      // If there's a file attachment, delete it from storage first
      if (
        messageData.hasAttachment &&
        messageData.attachmentData?.storagePath
      ) {
        const fileRef = ref(storage, messageData.attachmentData.storagePath);
        try {
          await deleteObject(fileRef);
        } catch (storageError) {
          console.error("Error deleting file from storage:", storageError);
          // Continue with message deletion even if file deletion fails
        }
      }

      // Now delete the message document
      await deleteDoc(messageRef);

      // Update the conversation's lastMessage if this was the last message
      const conversationRef = doc(
        db,
        "conversations",
        messageData.conversationId
      );
      const conversationDoc = await getDoc(conversationRef);

      if (conversationDoc.exists()) {
        const conversationData = conversationDoc.data();

        // Get all messages in the conversation
        const messagesQuery = query(
          collection(db, "messages"),
          where("conversationId", "==", messageData.conversationId),
          orderBy("createdAt", "desc")
        );

        const messagesSnapshot = await getDocs(messagesQuery);

        if (messagesSnapshot.empty) {
          // If no messages left, update lastMessage to null
          await updateDoc(conversationRef, {
            lastMessage: null,
            updatedAt: serverTimestamp(),
          });
        } else if (messagesSnapshot.docs[0].id === messageId) {
          // If the deleted message was the last one, update with the new last message
          const newLastMessage = messagesSnapshot.docs[1]?.data();

          if (newLastMessage) {
            await updateDoc(conversationRef, {
              lastMessage: {
                senderId: newLastMessage.senderId,
                preview: newLastMessage.hasAttachment
                  ? "Attachment"
                  : "Encrypted message",
                timestamp: newLastMessage.createdAt,
              },
              updatedAt: newLastMessage.createdAt,
            });
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }

  /**
   * Delete an entire conversation and all its messages
   * @param {string} conversationId - Conversation ID to delete
   * @param {string} userId - ID of the user attempting to delete (for permission check)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteConversation(conversationId, userId) {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationDoc = await getDoc(conversationRef);

      if (!conversationDoc.exists()) {
        throw new Error("Conversation not found");
      }

      const conversationData = conversationDoc.data();

      // Verify the user is a participant
      if (!conversationData.participants.includes(userId)) {
        throw new Error("You can only delete conversations you're a part of");
      }

      // Get all messages in the conversation
      const messagesQuery = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId)
      );

      const messagesSnapshot = await getDocs(messagesQuery);

      // Delete all message attachments from storage
      const fileDeletePromises = [];
      messagesSnapshot.forEach((messageDoc) => {
        const messageData = messageDoc.data();
        if (
          messageData.hasAttachment &&
          messageData.attachmentData?.storagePath
        ) {
          const fileRef = ref(storage, messageData.attachmentData.storagePath);
          fileDeletePromises.push(
            deleteObject(fileRef).catch((err) =>
              console.error(
                `Error deleting file ${messageData.attachmentData.storagePath}:`,
                err
              )
            )
          );
        }
      });

      // Wait for all files to be deleted
      await Promise.all(fileDeletePromises);

      // Use a batch to delete all messages
      const batch = writeBatch(db);
      messagesSnapshot.forEach((messageDoc) => {
        batch.delete(messageDoc.ref);
      });

      // Delete the conversation document
      batch.delete(conversationRef);

      // Commit the batch
      await batch.commit();

      return true;
    } catch (error) {
      console.error("Error deleting conversation:", error);
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
      // Modified query to avoid index requirement - we'll sort client-side
      const q = query(
        messagesRef,
        where("conversationId", "==", conversationId)
        // orderBy("createdAt", "asc") - removed to avoid needing composite index
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

                // Replace the attachmentData with the decrypted version for easier access in UI
                message.fileData = {
                  name: decryptedAttachmentData.fileName,
                  type: decryptedAttachmentData.fileType,
                  size: decryptedAttachmentData.fileSize,
                  url: decryptedAttachmentData.downloadURL,
                  path: decryptedAttachmentData.storagePath,
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
