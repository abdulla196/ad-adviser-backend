/**
 * apiClient.js
 * Drop this file into your React project: src/lib/apiClient.js
 *
 * Usage:
 *   import api from './lib/apiClient';
 *
 *   const { data, summary } = await api.unified.getCampaigns();
 *   const campaigns         = await api.meta.getCampaigns();
 *   await api.meta.pauseCampaign('123');
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_KEY  = process.env.REACT_APP_API_KEY  || '';

const request = async (method, path, body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    API_KEY,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
};

const get    = (path)         => request('GET',   path);
const post   = (path, body)   => request('POST',  path, body);
const patch  = (path, body)   => request('PATCH', path, body);

// ── Unified ───────────────────────────────────────────
const unified = {
  getCampaigns: (platforms) => {
    const qs = platforms ? `?platforms=${platforms.join(',')}` : '';
    return get(`/api/unified/campaigns${qs}`);
  },
};

// ── Meta ──────────────────────────────────────────────
const meta = {
  getCampaigns:      (params = {}) => get(`/api/meta/campaigns?status=${params.status || 'ACTIVE'}`),
  getCampaign:       (id)          => get(`/api/meta/campaigns/${id}`),
  getAdSets:         (id)          => get(`/api/meta/campaigns/${id}/adsets`),
  createCampaign:    (data)        => post('/api/meta/campaigns', data),
  updateCampaign:    (id, data)    => patch(`/api/meta/campaigns/${id}`, data),
  pauseCampaign:     (id)          => patch(`/api/meta/campaigns/${id}/status`, { status: 'PAUSED' }),
  activateCampaign:  (id)          => patch(`/api/meta/campaigns/${id}/status`, { status: 'ACTIVE' }),
};

// ── TikTok ────────────────────────────────────────────
const tiktok = {
  getCampaigns:     (params = {}) => get(`/api/tiktok/campaigns?page=${params.page || 1}`),
  createCampaign:   (data)        => post('/api/tiktok/campaigns', data),
  updateCampaign:   (id, data)    => patch(`/api/tiktok/campaigns/${id}`, data),
  pauseCampaign:    (id)          => patch(`/api/tiktok/campaigns/${id}/status`, { status: 'DISABLE' }),
  activateCampaign: (id)          => patch(`/api/tiktok/campaigns/${id}/status`, { status: 'ENABLE' }),
};

// ── Snapchat ──────────────────────────────────────────
const snapchat = {
  getCampaigns:     ()           => get('/api/snapchat/campaigns'),
  createCampaign:   (data)       => post('/api/snapchat/campaigns', data),
  updateCampaign:   (id, data)   => patch(`/api/snapchat/campaigns/${id}`, data),
  pauseCampaign:    (id)         => patch(`/api/snapchat/campaigns/${id}/status`, { status: 'PAUSED' }),
  activateCampaign: (id)         => patch(`/api/snapchat/campaigns/${id}/status`, { status: 'ACTIVE' }),
};

// ── Google ────────────────────────────────────────────
const google = {
  getCampaigns:     (params = {}) => get(`/api/google/campaigns?startDate=${params.startDate || ''}&endDate=${params.endDate || ''}`),
  createCampaign:   (data)        => post('/api/google/campaigns', data),
  updateCampaign:   (id, data)    => patch(`/api/google/campaigns/${id}`, data),
  pauseCampaign:    (id)          => patch(`/api/google/campaigns/${id}/status`, { status: 'PAUSED' }),
  activateCampaign: (id)          => patch(`/api/google/campaigns/${id}/status`, { status: 'ENABLED' }),
};

// ── Auth ──────────────────────────────────────────────
const auth = {
  getStatus:          ()           => get('/api/auth/status'),
  connectMeta:        ()           => { window.location.href = `${BASE_URL}/api/auth/meta/connect`; },
  connectTikTok:      ()           => { window.location.href = `${BASE_URL}/api/auth/tiktok/connect`; },
  connectSnapchat:    ()           => { window.location.href = `${BASE_URL}/api/auth/snapchat/connect`; },
  connectGoogle:      ()           => { window.location.href = `${BASE_URL}/api/auth/google/connect`; },
};

const api = { unified, meta, tiktok, snapchat, google, auth };
export default api;
