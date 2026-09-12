const pool = require('../db');

class ChatModel {
  static async getCustomerOrVendorId(userId, role) {
    if (role === 'customer') {
      const [rows] = await pool.execute('SELECT id FROM customers WHERE user_id = ?', [userId]);
      return rows[0] ? rows[0].id : null;
    } else if (role === 'vendor') {
      const [rows] = await pool.execute('SELECT id FROM vendors WHERE user_id = ?', [userId]);
      return rows[0] ? rows[0].id : null;
    }
    return null;
  }

  static async findRoom(customerId, vendorId, partId) {
    const getFullRoomQuery = `
      SELECT 
        cr.*,
        p.model_name,
        p.image_url,
        v.shop_name as vendor_shop_name,
        v.shop_name as other_name,
        v.city as other_city,
        b.name as brand_name
      FROM chat_rooms cr
      JOIN vendors v ON cr.vendor_id = v.id
      JOIN parts p ON cr.part_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE cr.customer_id = ? AND cr.vendor_id = ? AND cr.part_id = ?
    `;
    const [rows] = await pool.execute(getFullRoomQuery, [customerId, vendorId, partId]);
    return rows[0] || null;
  }

  static async findRoomById(roomId) {
    const [rows] = await pool.execute('SELECT * FROM chat_rooms WHERE id = ?', [roomId]);
    return rows[0] || null;
  }

  static async findRoomDetailsById(roomId) {
    const [rows] = await pool.execute(
      `SELECT 
        cr.*,
        p.model_name,
        p.image_url,
        v.shop_name as vendor_shop_name,
        v.shop_name as other_name,
        v.city as other_city,
        b.name as brand_name
      FROM chat_rooms cr
      JOIN vendors v ON cr.vendor_id = v.id
      JOIN parts p ON cr.part_id = p.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE cr.id = ?`,
      [roomId]
    );
    return rows[0] || null;
  }

  static async createRoom(customerId, vendorId, partId) {
    const [insertResult] = await pool.execute(
      'INSERT INTO chat_rooms (customer_id, vendor_id, part_id) VALUES (?, ?, ?)',
      [customerId, vendorId, partId]
    );
    return this.findRoomDetailsById(insertResult.insertId);
  }

  static async getAllRoomsAdmin() {
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
    return rooms;
  }

  static async getRoomsForParticipant(role, participantId) {
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

    const [rows] = await pool.execute(query, [participantId]);
    return rows;
  }

  static async getRoomMessages(roomId) {
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
    return messages;
  }

  static async createMessage(roomId, senderId, message) {
    const [insertResult] = await pool.execute(
      'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)',
      [roomId, senderId, message]
    );
    const messageId = insertResult.insertId;

    const [rows] = await pool.execute(`
      SELECT 
        cm.*,
        u.name as sender_name,
        u.role as sender_role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [messageId]);
    return rows[0] || null;
  }
}

module.exports = ChatModel;
