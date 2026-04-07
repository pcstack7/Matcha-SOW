import dotenv from 'dotenv';
dotenv.config(); // Must run before azureConfigured is evaluated — dotenv imports are hoisted in ESM

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { userOps } from '../database.js';

// ── Local Strategy (username/password) — unchanged ────────────────────────────
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = userOps.getByUsername(username);

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      if (!user.is_active) {
        return done(null, false, { message: 'Account is inactive. Please contact administrator.' });
      }

      if (user.auth_provider === 'local') {
        if (!user.password_hash) {
          return done(null, false, { message: 'Invalid authentication method' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid username or password' });
        }
      } else {
        return done(null, false, { message: 'Please use your organization login (SSO)' });
      }

      userOps.updateLastLogin(user.id);
      delete user.password_hash;

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// ── Azure AD OIDCStrategy ──────────────────────────────────────────────────────
// Only registered when all four Azure env vars are present.
// This allows local-only environments to start without Azure configuration.
export const azureConfigured =
  !!(process.env.AZURE_CLIENT_ID &&
     process.env.AZURE_CLIENT_SECRET &&
     process.env.AZURE_TENANT_ID &&
     process.env.AZURE_REDIRECT_URI);

if (azureConfigured) {
  // passport-azure-ad is a CommonJS package — import dynamically to avoid ESM issues
  const { OIDCStrategy } = await import('passport-azure-ad');

  passport.use(
    new OIDCStrategy(
      {
        identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
        clientID: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        responseType: 'code',
        responseMode: 'query',
        redirectUrl: process.env.AZURE_REDIRECT_URI,
        allowHttpForRedirectUrl: !process.env.AZURE_REDIRECT_URI?.startsWith('https://'),
        scope: ['openid', 'profile', 'email'],
        passReqToCallback: false,
        loggingLevel: 'info',
        validateIssuer: true,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
      },
      async (iss, sub, profile, accessToken, refreshToken, done) => {
        try {
          // profile.oid is the Azure AD object ID — the stable unique identifier
          const azureId = profile.oid;
          const email =
            profile.upn ||
            profile._json?.preferred_username ||
            profile._json?.email ||
            (profile.emails && profile.emails[0]?.value) ||
            null;
          const displayName =
            profile.displayName ||
            profile._json?.name ||
            email ||
            'Azure User';

          // ── Role mapping ────────────────────────────────────────────────────
          // Azure app roles arrive as an array in profile._json.roles.
          // app_admin role → 'admin'; everything else → 'user'.
          const azureRoles = profile._json?.roles || [];
          const role = azureRoles.includes('app_admin') ? 'admin' : 'user';

          // ── Find or create user ─────────────────────────────────────────────
          let user = userOps.getByAzureId(azureId);

          if (user) {
            // Existing SSO user — check active status
            if (!user.is_active) {
              return done(null, false, { message: 'Account is inactive. Please contact administrator.' });
            }
            // Sync role from Azure token on every login
            if (user.role !== role) {
              userOps.updateRole(user.id, role);
            }
            userOps.updateLastLogin(user.id);
            // Re-fetch so the updated role is reflected in the session
            user = userOps.getById(user.id);
          } else {
            // First-time SSO login — auto-provision the user
            if (!email) {
              return done(null, false, {
                message: 'Your Microsoft account has no email address. Please contact your administrator.',
              });
            }

            // Derive a unique username from the email prefix
            let username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
            const existingByUsername = userOps.getByUsername(username);
            if (existingByUsername) {
              // Append last 4 chars of azureId to avoid collision with local users
              username = `${username}_${azureId.slice(-4)}`;
            }

            const id = userOps.create({
              username,
              email,
              password_hash: null,
              role,
              auth_provider: 'azure',
              azure_id: azureId,
              display_name: displayName,
              is_active: 1,
            });

            userOps.updateLastLogin(id);
            user = userOps.getById(id);
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

// ── Serialize / Deserialize — shared by both strategies ───────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id);
});

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
