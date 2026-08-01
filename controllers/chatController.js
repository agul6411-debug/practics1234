const pool = require('../db');

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

// Helper to resolve user ID to customer/vendor ID
async function getCustomerOrVendorId(userId, role) {
  if (role === 'customer') {
    const [rows] = await pool.execute('SELECT id FROM customers WHERE user_id = ?', [userId]);
    return rows[0] ? rows[0].id : null;
  } else if (role === 'vendor') {
    const [rows] = await pool.execute('SELECT id FROM vendors WHERE user_id = ?', [userId]);
    return rows[0] ? rows[0].id : null;
  }
  return null;
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

    const customerId = await getCustomerOrVendorId(userId, role);
    if (!customerId) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    // Find the part and its vendor
    const [partRows] = await pool.execute('SELECT vendor_id FROM parts WHERE id = ?', [part_id]);
    const part = partRows[0];
    if (!part) {
      return res.status(404).json({
        success: false,
        message: 'Part listing not found'
      });
    }
    const vendorId = part.vendor_id;

    // Check if room already exists
    const [existingRoomRows] = await pool.execute(
      'SELECT * FROM chat_rooms WHERE customer_id = ? AND vendor_id = ? AND part_id = ?',
      [customerId, vendorId, part_id]
    );

    let room = existingRoomRows[0] || null;

    if (!room) {
      // Create new chat room
      const [insertResult] = await pool.execute(
        'INSERT INTO chat_rooms (customer_id, vendor_id, part_id) VALUES (?, ?, ?)',
        [customerId, vendorId, part_id]
      );
      const roomId = insertResult.insertId;

      const [newRoomRows] = await pool.execute('SELECT * FROM chat_rooms WHERE id = ?', [roomId]);
      room = newRoomRows[0];
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
      // Admin sees ALL rooms in the system (ordered by created_at DESC)
      const [rooms] = await pool.execute(`
        SELECT 
          cr.*,
          p.model_name,
          p.barcode_number,
          u_cust.name as customer_name,
          v.shop_name as vendor_shop_name,
          b.name as brand_name
        FROM chat_rooms cr
        JOIN customers c ON cr.customer_id = c.id
        JOIN users u_cust ON c.user_id = u_cust.id
        JOIN vendors v ON cr.vendor_id = v.id
        JOIN parts p ON cr.part_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        ORDER BY cr.created_at DESC
      `);
      return res.json({ success: true, data: rooms });
    }

    const participantId = await getCustomerOrVendorId(userId, role);
    if (!participantId) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    let query = '';
    if (role === 'customer') {
      query = `
        SELECT 
          cr.*,
          p.model_name,
          p.image_url,
          v.shop_name as other_name,
          v.city as other_city,
          b.name as brand_name
        FROM chat_rooms cr
        JOIN vendors v ON cr.vendor_id = v.id
        JOIN parts p ON cr.part_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE cr.customer_id = ?
        ORDER BY cr.created_at DESC
      `;
    } else if (role === 'vendor') {
      query = `
        SELECT 
          cr.*,
          p.model_name,
          p.image_url,
          u.name as other_name,
          c.city as other_city,
          b.name as brand_name
        FROM chat_rooms cr
        JOIN customers c ON cr.customer_id = c.id
        JOIN users u ON c.user_id = u.id
        JOIN parts p ON cr.part_id = p.id
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE cr.vendor_id = ?
        ORDER BY cr.created_at DESC
      `;
    }

    const [rooms] = await pool.execute(query, [participantId]);
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
    const [roomRows] = await pool.execute('SELECT * FROM chat_rooms WHERE id = ?', [roomId]);
    const room = roomRows[0];
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify access permissions (Participants or System Admin only)
    if (role !== 'admin') {
      const participantId = await getCustomerOrVendorId(userId, role);
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

    // Fetch messages
    const [messages] = await pool.execute(`
      SELECT 
        cm.*,
        u.name as sender_name,
        u.role as sender_role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.room_id = ?
      ORDER BY cm.created_at ASC
    `, [roomId]);

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
    const [roomRows] = await pool.execute('SELECT * FROM chat_rooms WHERE id = ?', [roomId]);
    const room = roomRows[0];
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Chat room not found'
      });
    }

    // Verify user belongs to this room
    const participantId = await getCustomerOrVendorId(userId, role);
    const isAllowed = 
      (role === 'customer' && room.customer_id === participantId) ||
      (role === 'vendor' && room.vendor_id === participantId);

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied. You are not a participant in this conversation.'
      });
    }

    // Insert message
    const [insertResult] = await pool.execute(
      'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
      [roomId, userId, cleanMessage]
    );
    const messageId = insertResult.insertId;

    // Return the created message details
    const [newMessageRows] = await pool.execute(`
      SELECT 
        cm.*,
        u.name as sender_name,
        u.role as sender_role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [messageId]);

    res.status(201).json({
      success: true,
      data: newMessageRows[0]
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
