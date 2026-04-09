const { getPool } = require('../config/database');

const mapIntegration = (row) => ({
  id: row.id,
  userId: row.user_id,
  metaUserId: row.meta_user_id,
  metaUserName: row.meta_user_name,
  metaUserPictureUrl: row.meta_user_picture_url,
  accessToken: row.access_token,
  tokenType: row.token_type,
  expiresIn: row.expires_in,
  selectedPageId: row.selected_page_id,
  selectedPageName: row.selected_page_name,
  selectedPagePictureUrl: row.selected_page_picture_url,
  selectedPageCategory: row.selected_page_category,
  selectedAdAccountId: row.selected_ad_account_id,
  selectedAdAccountName: row.selected_ad_account_name,
  selectedAdAccountCurrency: row.selected_ad_account_currency,
  isActive: Boolean(row.is_active),
  connectedAt: row.connected_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getIntegrationById = async (userId, integrationId) => {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM meta_integrations WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, integrationId]
  );
  return rows[0] ? mapIntegration(rows[0]) : null;
};

const listIntegrations = async (userId) => {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM meta_integrations WHERE user_id = ? ORDER BY is_active DESC, connected_at DESC, id DESC',
    [userId]
  );
  return rows.map(mapIntegration);
};

const getActiveIntegration = async (userId) => {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM meta_integrations WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC, id DESC LIMIT 1',
    [userId]
  );
  return rows[0] ? mapIntegration(rows[0]) : null;
};

const setActiveIntegration = async (userId, integrationId) => {
  const db = getPool();
  await db.execute('UPDATE meta_integrations SET is_active = 0 WHERE user_id = ?', [userId]);
  await db.execute('UPDATE meta_integrations SET is_active = 1 WHERE user_id = ? AND id = ?', [userId, integrationId]);
  return getIntegrationById(userId, integrationId);
};

const createIntegration = async (userId, payload) => {
  const db = getPool();
  await db.execute('UPDATE meta_integrations SET is_active = 0 WHERE user_id = ?', [userId]);
  const [result] = await db.execute(
    `INSERT INTO meta_integrations
      (user_id, meta_user_id, meta_user_name, meta_user_picture_url, access_token, token_type, expires_in, is_active, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
    [
      userId,
      payload.metaUserId || null,
      payload.metaUserName || null,
      payload.metaUserPictureUrl || null,
      payload.accessToken,
      payload.tokenType || null,
      payload.expiresIn || null,
    ]
  );
  return getIntegrationById(userId, result.insertId);
};

const updateSelectedPage = async (userId, integrationId, page) => {
  const db = getPool();
  await db.execute(
    `UPDATE meta_integrations
        SET selected_page_id = ?,
            selected_page_name = ?,
            selected_page_picture_url = ?,
            selected_page_category = ?
      WHERE user_id = ? AND id = ?`,
    [page.id, page.name || null, page.pictureUrl || null, page.category || null, userId, integrationId]
  );
  return getIntegrationById(userId, integrationId);
};

const updateSelectedAdAccount = async (userId, integrationId, account) => {
  const db = getPool();
  await db.execute(
    `UPDATE meta_integrations
        SET selected_ad_account_id = ?,
            selected_ad_account_name = ?,
            selected_ad_account_currency = ?
      WHERE user_id = ? AND id = ?`,
    [account.id, account.name || null, account.currency || null, userId, integrationId]
  );
  return getIntegrationById(userId, integrationId);
};

const removeIntegration = async (userId, integrationId) => {
  const db = getPool();
  const existing = await getIntegrationById(userId, integrationId);
  if (!existing) return null;

  await db.execute('DELETE FROM meta_integrations WHERE user_id = ? AND id = ?', [userId, integrationId]);

  if (existing.isActive) {
    const [rows] = await db.execute(
      'SELECT id FROM meta_integrations WHERE user_id = ? ORDER BY connected_at DESC, id DESC LIMIT 1',
      [userId]
    );

    if (rows[0]?.id) {
      await setActiveIntegration(userId, rows[0].id);
    }
  }

  return existing;
};

const buildMetaStatus = async (userId) => {
  const active = await getActiveIntegration(userId);
  const integrations = await listIntegrations(userId);

  return {
    connected: integrations.length > 0,
    connectedAt: active?.connectedAt || integrations[0]?.connectedAt || null,
    selectedPageId: active?.selectedPageId || null,
    selectedPageName: active?.selectedPageName || null,
    selectedAdAccountId: active?.selectedAdAccountId || null,
    selectedAdAccountName: active?.selectedAdAccountName || null,
    activeIntegrationId: active?.id || null,
    integrations,
  };
};

module.exports = {
  listIntegrations,
  getActiveIntegration,
  setActiveIntegration,
  createIntegration,
  updateSelectedPage,
  updateSelectedAdAccount,
  removeIntegration,
  buildMetaStatus,
};