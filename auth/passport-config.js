import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { userOps } from '../database.js';

// Configure local authentication strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      // Find user by username
      const user = userOps.getByUsername(username);

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Check if user is active
      if (!user.is_active) {
        return done(null, false, { message: 'Account is inactive. Please contact administrator.' });
      }

      // Only check password for local auth users
      if (user.auth_provider === 'local') {
        if (!user.password_hash) {
          return done(null, false, { message: 'Invalid authentication method' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid username or password' });
        }
      } else {
        return done(null, false, { message: 'Please use your organization login' });
      }

      // Update last login
      userOps.updateLastLogin(user.id);

      // Remove password hash from user object
      delete user.password_hash;

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  try {
    const user = userOps.getById(id);
    if (!user) {
      return done(null, false);
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;
