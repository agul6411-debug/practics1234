const pool = require('../db');

class SystemSettingModel {
  static async getAll() {
    const [rows] = await pool.execute('SELECT * FROM system_settings');
    const settingsMap = {};
    rows.forEach((r) => {
      settingsMap[r.setting_key] = r.setting_value;
    });
    return settingsMap;
  }

  static async getPublicSettings() {
    const [rows] = await pool.execute('SELECT * FROM system_settings');
    const settingsMap = {
      security_deposit_amount: '500',
      security_deposit_phone: '03080780593',
      commission_rate_percent: '10'
    };
    rows.forEach((r) => {
      settingsMap[r.setting_key] = r.setting_value;
    });
    return settingsMap;
  }

  static async updateSetting(key, value) {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, String(value)]
    );
  }

  static async updateMultipleSettings({
    security_deposit_amount,
    security_deposit_phone,
    commission_rate_percent
  } = {}) {
    if (security_deposit_amount !== undefined) {
      await this.updateSetting('security_deposit_amount', security_deposit_amount);
    }
    if (security_deposit_phone !== undefined) {
      await this.updateSetting('security_deposit_phone', security_deposit_phone);
    }
    if (commission_rate_percent !== undefined) {
      await this.updateSetting('commission_rate_percent', commission_rate_percent);
    }
    return this.getAll();
  }

  static async getSettingValue(key, defaultValue = null) {
    try {
      const [rows] = await pool.execute(
        'SELECT setting_value FROM system_settings WHERE setting_key = ?',
        [key]
      );
      if (rows.length > 0 && rows[0].setting_value !== undefined && rows[0].setting_value !== null) {
        return rows[0].setting_value;
      }
      return defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }
}

module.exports = SystemSettingModel;
