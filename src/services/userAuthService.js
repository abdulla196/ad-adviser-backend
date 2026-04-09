const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const { getPool } = require('../config/database');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CODE_REGEX = /^\+[1-9]\d{0,4}$/;
const PHONE_NUMBER_REGEX = /^\d{6,20}$/;
const MAX_PROFILE_IMAGE_URL_LENGTH = 3 * 1024 * 1024;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const cleanText = (value) => String(value || '').trim();
const getGoogleAuthClientId = () => process.env.GOOGLE_AUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

const validateEmail = (email) => EMAIL_REGEX.test(normalizeEmail(email));
const validatePassword = (password) => String(password || '').length >= 8;
const validateName = (value) => {
  const text = cleanText(value);
  return text.length > 0 && text.length <= 100;
};
const validatePhone = (countryCode, phoneNumber) => {
  if (!countryCode && !phoneNumber) return true;
  return PHONE_CODE_REGEX.test(cleanText(countryCode)) && PHONE_NUMBER_REGEX.test(cleanText(phoneNumber));
};

const normalizeProfileImage = (value) => {
  if (value === undefined) return { hasValue: false, value: undefined };

  const text = cleanText(value);
  if (!text) return { hasValue: true, value: null };

  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(text)) {
    return { error: 'Profile image must be a valid image file' };
  }

  if (text.length > MAX_PROFILE_IMAGE_URL_LENGTH) {
    return { error: 'Profile image is too large' };
  }

  return { hasValue: true, value: text };
};

const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  profileImageUrl: row.profile_image_url,
  phoneCountryCode: row.phone_country_code,
  phoneNumber: row.phone_number,
  provider: row.provider,
  hasPassword: Boolean(row.password_hash),
  emailVerified: Boolean(row.is_email_verified),
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

const issueAuthToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { sub: user.id, email: user.email, provider: user.provider },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const getUserByEmail = async (email) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizeEmail(email)]);
  return rows[0] || null;
};

const getCurrentUserFromToken = async (token) => {
  if (!token) {
    throw new Error('Authorization token is required');
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (!payload?.sub) {
    throw new Error('Invalid authorization token');
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

const getCurrentUser = async (userId) => {
  const user = await getUserById(userId);
  if (!user) return null;
  return sanitizeUser(user);
};

const getUserByProviderId = async (provider, providerId) => {
  const db = getPool();
  if (provider !== 'google') {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const [rows] = await db.execute('SELECT * FROM users WHERE google_id = ? LIMIT 1', [providerId]);
  return rows[0] || null;
};

const getUserById = async (id) => {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

const touchLastLogin = async (id) => {
  const db = getPool();
  await db.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
};

const createUser = async ({
  email,
  passwordHash = null,
  firstName,
  lastName,
  phoneCountryCode = null,
  phoneNumber = null,
  provider = 'basic',
  googleId = null,
  isEmailVerified = false,
}) => {
  const db = getPool();
  const [result] = await db.execute(
    `INSERT INTO users
      (email, password_hash, first_name, last_name, phone_country_code, phone_number, provider, google_id, is_email_verified, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      normalizeEmail(email),
      passwordHash,
      cleanText(firstName),
      cleanText(lastName),
      cleanText(phoneCountryCode) || null,
      cleanText(phoneNumber) || null,
      provider,
      googleId,
      isEmailVerified ? 1 : 0,
    ]
  );

  return getUserById(result.insertId);
};

const updateSocialLink = async (userId, provider, providerId, profile) => {
  const db = getPool();
  if (provider !== 'google') {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  await db.execute(
    `UPDATE users
        SET google_id = ?,
            provider = ?,
            first_name = COALESCE(NULLIF(?, ''), first_name),
            last_name = COALESCE(NULLIF(?, ''), last_name),
            is_email_verified = 1,
            last_login_at = NOW()
      WHERE id = ?`,
    [providerId, provider, cleanText(profile.firstName), cleanText(profile.lastName), userId]
  );

  return getUserById(userId);
};

const buildAuthResponse = async (user) => {
  const freshUser = user.id ? await getUserById(user.id) : user;
  const safeUser = sanitizeUser(freshUser);
  return {
    token: issueAuthToken(safeUser),
    user: safeUser,
  };
};

const verifyGoogleToken = async (idToken) => {
  const googleAuthClientId = getGoogleAuthClientId();
  if (!idToken) {
    throw new Error('Google idToken is required');
  }
  if (!googleAuthClientId) {
    throw new Error('GOOGLE_AUTH_CLIENT_ID or GOOGLE_CLIENT_ID is not configured');
  }

  const ticket = await new OAuth2Client(googleAuthClientId).verifyIdToken({
    idToken,
    audience: googleAuthClientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new Error('Google account did not return an email address');
  }

  return {
    providerId: payload.sub,
    email: normalizeEmail(payload.email),
    firstName: cleanText(payload.given_name),
    lastName: cleanText(payload.family_name),
    emailVerified: Boolean(payload.email_verified),
  };
};

const registerBasic = async ({ email, password, firstName, lastName, phoneCountryCode, phoneNumber }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!validateEmail(normalizedEmail)) return { status: 400, error: 'A valid email is required' };
  if (!validatePassword(password)) return { status: 400, error: 'Password must be at least 8 characters long' };
  if (!cleanText(firstName) || !cleanText(lastName)) return { status: 400, error: 'First name and last name are required' };
  if (!validatePhone(phoneCountryCode, phoneNumber)) return { status: 400, error: 'Phone number must include a valid country code and digits only' };

  const existingUser = await getUserByEmail(normalizedEmail);
  if (existingUser) return { status: 409, error: 'An account with this email already exists' };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    phoneCountryCode,
    phoneNumber,
    provider: 'basic',
    isEmailVerified: false,
  });

  return { status: 201, ...(await buildAuthResponse(user)) };
};

const loginBasic = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!validateEmail(normalizedEmail)) return { status: 400, error: 'A valid email is required' };
  if (!password) return { status: 400, error: 'Password is required' };

  const user = await getUserByEmail(normalizedEmail);
  if (!user) return { status: 401, error: 'Invalid email or password' };
  if (!user.password_hash) {
    return { status: 400, error: 'This account uses social login. Sign in with Google.' };
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return { status: 401, error: 'Invalid email or password' };

  await touchLastLogin(user.id);
  return { status: 200, ...(await buildAuthResponse(user)) };
};

const registerSocial = async (provider, profile) => {
  const byProvider = await getUserByProviderId(provider, profile.providerId);
  if (byProvider) {
    return { status: 409, error: `This ${provider} account is already registered. Login instead.` };
  }

  const byEmail = await getUserByEmail(profile.email);
  if (byEmail) {
    const linkedUser = await updateSocialLink(byEmail.id, provider, profile.providerId, profile);
    return { status: 201, ...(await buildAuthResponse(linkedUser)) };
  }

  const user = await createUser({
    email: profile.email,
    firstName: profile.firstName || provider,
    lastName: profile.lastName || 'User',
    provider,
    googleId: provider === 'google' ? profile.providerId : null,
    isEmailVerified: Boolean(profile.emailVerified),
  });

  return { status: 201, ...(await buildAuthResponse(user)) };
};

const loginSocial = async (provider, profile) => {
  let user = await getUserByProviderId(provider, profile.providerId);
  if (!user) user = await getUserByEmail(profile.email);
  if (!user) return { status: 404, error: `No account found for this ${provider} login. Register first.` };

  if (provider === 'google' && !user.google_id) {
    user = await updateSocialLink(user.id, 'google', profile.providerId, profile);
  } else {
    await touchLastLogin(user.id);
  }

  return { status: 200, ...(await buildAuthResponse(user)) };
};

const updateCurrentUser = async (userId, { firstName, lastName, profileImageUrl, currentPassword, newPassword, confirmNewPassword }) => {
  const user = await getUserById(userId);
  if (!user) return { status: 404, error: 'User not found' };

  const nextFirstName = firstName === undefined ? user.first_name : cleanText(firstName);
  const nextLastName = lastName === undefined ? user.last_name : cleanText(lastName);

  if (!validateName(nextFirstName) || !validateName(nextLastName)) {
    return { status: 400, error: 'First name and last name are required' };
  }

  const normalizedProfileImage = normalizeProfileImage(profileImageUrl);
  if (normalizedProfileImage.error) {
    return { status: 400, error: normalizedProfileImage.error };
  }

  const nextProfileImageUrl = normalizedProfileImage.hasValue ? normalizedProfileImage.value : user.profile_image_url;
  const wantsPasswordChange = [currentPassword, newPassword, confirmNewPassword].some((value) => cleanText(value).length > 0);
  const db = getPool();

  if (wantsPasswordChange) {
    if (!newPassword) {
      return { status: 400, error: 'New password is required' };
    }

    if (!validatePassword(newPassword)) {
      return { status: 400, error: 'Password must be at least 8 characters long' };
    }

    if (String(newPassword) !== String(confirmNewPassword || '')) {
      return { status: 400, error: 'New password and confirm password must match' };
    }

    if (user.password_hash) {
      if (!currentPassword) {
        return { status: 400, error: 'Current password is required' };
      }

      const matches = await bcrypt.compare(String(currentPassword), user.password_hash);
      if (!matches) {
        return { status: 401, error: 'Current password is incorrect' };
      }
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    await db.execute(
      `UPDATE users
          SET first_name = ?,
              last_name = ?,
              profile_image_url = ?,
              password_hash = ?
        WHERE id = ?`,
      [nextFirstName, nextLastName, nextProfileImageUrl, passwordHash, userId]
    );
  } else {
    await db.execute(
      `UPDATE users
          SET first_name = ?,
              last_name = ?,
              profile_image_url = ?
        WHERE id = ?`,
      [nextFirstName, nextLastName, nextProfileImageUrl, userId]
    );
  }

  return { status: 200, user: sanitizeUser(await getUserById(userId)) };
};

module.exports = {
  getCurrentUserFromToken,
  getCurrentUser,
  verifyGoogleToken,
  registerBasic,
  loginBasic,
  registerSocial,
  loginSocial,
  updateCurrentUser,
};