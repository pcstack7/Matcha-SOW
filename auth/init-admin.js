import bcrypt from 'bcryptjs';
import { userOps } from '../database.js';

// Create default admin user if no users exist
export async function initializeDefaultAdmin() {
  try {
    const users = userOps.getAll();

    if (users.length === 0) {
      console.log('No users found. Creating default admin user...');

      const defaultAdmin = {
        username: 'admin',
        email: 'admin@matchasow.local',
        password_hash: await bcrypt.hash('Admin@123', 10),
        role: 'admin',
        auth_provider: 'local',
        display_name: 'Administrator',
        is_active: 1
      };

      const id = userOps.create(defaultAdmin);
      console.log(`✓ Default admin user created (ID: ${id})`);
      console.log('  Username: admin');
      console.log('  Password: Admin@123');
      console.log('  ⚠️  IMPORTANT: Change this password after first login!');
    }
  } catch (err) {
    console.error('Error creating default admin:', err);
  }
}
