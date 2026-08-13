const db = require('../config/db');

// Get all settings as an object
const getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT `key`, value FROM settings');
    
    // Convert array of [{key: 'k', value: 'v'}] to a dictionary {k: 'v'}
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });

    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get Settings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memuat pengaturan.'
    });
  }
};

// Update settings (Admin only)
const updateSettings = async (req, res) => {
  const { 
    price_per_hour, 
    operational_hours_start, 
    operational_hours_end, 
    bank_name, 
    bank_account, 
    bank_recipient, 
    gor_name, 
    whatsapp_number 
  } = req.body;

  // Basic validation
  if (!price_per_hour || !operational_hours_start || !operational_hours_end || !bank_name || !bank_account || !bank_recipient || !gor_name || !whatsapp_number) {
    return res.status(400).json({
      success: false,
      message: 'Semua field pengaturan wajib diisi.'
    });
  }

  const parsedPrice = parseInt(price_per_hour, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Harga per jam harus berupa angka positif.'
    });
  }

  try {
    const updates = {
      price_per_hour: parsedPrice.toString(),
      operational_hours_start,
      operational_hours_end,
      bank_name,
      bank_account,
      bank_recipient,
      gor_name,
      whatsapp_number
    };

    // Update settings in database
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, value]
      );
    }

    return res.json({
      success: true,
      message: 'Pengaturan berhasil diperbarui.'
    });
  } catch (error) {
    console.error('Update Settings Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat menyimpan pengaturan.'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
