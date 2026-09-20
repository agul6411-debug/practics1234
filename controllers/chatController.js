const ChatModel = require('../models/ChatModel');
const PartModel = require('../models/PartModel');
const VendorModel = require('../models/VendorModel');
const CustomerModel = require('../models/CustomerModel');
const NotificationModel = require('../models/NotificationModel');

// Helper to escape HTML characters for basic input sanitization
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create or retrieve a chat room for customer-vendor-part combination
 */
async function createOrGetRoom(req, res, next) {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can initiate chat sessions.'
      });
    }

    const { part_id } = req.body;
    if (!part_id) {
      return res.status(400).json({
        success: false,
        message: 'Required field missing: part_id'
      });
    }

    const customerId = await ChatModel.getCustomerOrVendorId(userId, role);
    if (!customerId) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    // Find the part and its vendor
    const part = await PartModel.findById(part_id);
    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part listing not found'
      });
    }
    const vendorId = part.vendor_id;

    // Check if room already exists
    let room = await ChatModel.findRoom(customerId, vendorId, part_id);

    if (!room) {
      room = await ChatModel.createRoom(customerId, vendorId, part_id);
    }

    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get active chat rooms for the logged-in user
 */
async function getMyRooms(req, res, next) {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'admin') {
      const rooms = await ChatModel.getAllRoomsAdmin();
      return res.json({ success: true, data: rooms });
    }

    const participantId = await ChatModel.getCustomerOrVendorId(userId, role);
    if (!participantId) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    const rooms = await ChatModel.getRoomsForParticipant(role, participantId);
    res.json({
      success: true,
      data: rooms
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch messages inside a specific room (Authorized participants/admin only)
 */
async function getRoomMessages(req, res, next) {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const roomId = req.params.roomId;

    // Retrieve room
    const room = await ChatModel.findRoomById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify access permissions (Participants or System Admin only)
    if (role !== 'admin') {
      const participantId = await ChatModel.getCustomerOrVendorId(userId, role);
      const isAllowed = 
        (role === 'customer' && room.customer_id === participantId) ||
        (role === 'vendor' && room.vendor_id === participantId);

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied. You are not a participant in this conversation.'
        });
      }
    }

    const messages = await ChatModel.getRoomMessages(roomId);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message to a room (Participants only)
 */
async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const roomId = req.params.roomId;
    const { message } = req.body;

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot send messages. Access is read-only monitoring.'
      });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.'
      });
    }

    // Enforce 500 character limit
    const cleanMessage = escapeHtml(message.trim());
    if (cleanMessage.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Message exceeds the 500 character security limit.'
      });
    }

    // Retrieve room
    const room = await ChatModel.findRoomById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify user belongs to this room
    const participantId = await ChatModel.getCustomerOrVendorId(userId, role);
    const isAllowed = 
      (role === 'customer' && room.customer_id === participantId) ||
      (role === 'vendor' && room.vendor_id === participantId);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied. You are not a participant in this conversation.'
      });
    }

    const createdMessage = await ChatModel.createMessage(roomId, userId, cleanMessage);

    // Trigger notification to the other participant
    try {
      let recipientUserId = null;
      if (role === 'customer') {
        const vendor = await VendorModel.findById(room.vendor_id);
        if (vendor) recipientUserId = vendor.user_id;
      } else if (role === 'vendor') {
        const customer = await CustomerModel.findById(room.customer_id);
        if (customer) recipientUserId = customer.user_id;
      }

      if (recipientUserId) {
        const part = await PartModel.findById(room.part_id);
        const partTitle = part ? part.model_name : 'product listing';
        const senderLabel = role === 'customer' ? 'Customer' : 'Vendor';
        const preview = cleanMessage.length > 40 ? `${cleanMessage.substring(0, 40)}...` : cleanMessage;

        await NotificationModel.create({
          userId: recipientUserId,
          message: `💬 ${senderLabel} message regarding ${partTitle}: "${preview}"`,
          type: 'chat',
          isRead: 0
        });
      }
    } catch (notifErr) {
      console.error('Chat notification creation failed:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      data: createdMessage
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrGetRoom,
  getMyRooms,
  getRoomMessages,
  sendMessage
};
