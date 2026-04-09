# Ad Adviser — Backend API

Node.js + Express backend that connects to Meta, TikTok, Snapchat, and Google Ads.

This backend also includes MySQL-backed authentication with:
- Email/password registration and login
- Google registration and login

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Then fill in your API keys in .env

# 2.1 Create the MySQL database first
# Example:
# CREATE DATABASE ad_adviser CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. Run in development
npm run dev

# 4. Run in production
npm start
```

Server runs on http://localhost:5000

## API Endpoints

Ad platform routes require header: `x-api-key: <your API_KEY from .env>`.
Authentication routes under `/api/auth/register/*` and `/api/auth/login/*` do not require the API key.

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Server status |

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register/basic | Register with email, password, first/last name, phone |
| POST | /api/auth/login/basic | Login with email and password |
| POST | /api/auth/register/google | Register with Google `idToken` |
| POST | /api/auth/login/google | Login with Google `idToken` |

### Unified (all platforms)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/unified/campaigns | All campaigns from all platforms |
| GET | /api/unified/campaigns?platforms=meta,tiktok | Specific platforms only |

### Meta
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/meta/campaigns | List campaigns |
| GET | /api/meta/campaigns/:id | Get single campaign |
| GET | /api/meta/campaigns/:id/adsets | Get ad sets |
| POST | /api/meta/campaigns | Create campaign |
| PATCH | /api/meta/campaigns/:id | Update campaign |
| PATCH | /api/meta/campaigns/:id/status | Pause / activate |

### TikTok
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/tiktok/campaigns | List campaigns + metrics |
| POST | /api/tiktok/campaigns | Create campaign |
| PATCH | /api/tiktok/campaigns/:id | Update campaign |
| PATCH | /api/tiktok/campaigns/:id/status | Enable / disable |

### Snapchat
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/snapchat/campaigns | List campaigns + stats |
| POST | /api/snapchat/campaigns | Create campaign |
| PATCH | /api/snapchat/campaigns/:id | Update campaign |
| PATCH | /api/snapchat/campaigns/:id/status | Pause / activate |

### Google Ads
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/google/campaigns | List campaigns |
| POST | /api/google/campaigns | Create campaign |
| PATCH | /api/google/campaigns/:id | Update campaign |
| PATCH | /api/google/campaigns/:id/status | Enable / pause |

## Unified Data Model

All platforms return the same shape:

```json
{
  "platform": "meta",
  "id": "123456",
  "name": "Summer Campaign",
  "status": "ACTIVE",
  "objective": "CONVERSIONS",
  "budget": 50.00,
  "startDate": "2025-01-01",
  "endDate": null,
  "impressions": 120000,
  "clicks": 3400,
  "spend": 820.50,
  "ctr": 2.83,
  "cpc": 0.2413,
  "conversions": 145,
  "roas": 3.2
}
```

## Calling from React

```js
// In your React app
const res = await fetch('http://localhost:5000/api/unified/campaigns', {
  headers: { 'x-api-key': process.env.REACT_APP_API_KEY }
});
const { data, summary } = await res.json();
```

## Auth Request Payloads

### Basic registration

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123",
  "firstName": "Abdulla",
  "lastName": "Ahmed",
  "phoneCountryCode": "+20",
  "phoneNumber": "1012345678"
}
```

### Basic login

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

### Google login/register

```json
{
  "idToken": "google-id-token-from-frontend"
}
```

For Google user login/register, the backend verifies the ID token against `GOOGLE_AUTH_CLIENT_ID` when set, otherwise it falls back to `GOOGLE_CLIENT_ID`.

If Google shows `Error 401: invalid_client` or `no registered origin`, the frontend Google Sign-In client is misconfigured in Google Cloud Console. Create or update a `Web application` OAuth client and add these Authorized JavaScript origins:

- `http://localhost:3000`
- your production frontend origin

Then set:

```env
GOOGLE_AUTH_CLIENT_ID=your_google_web_client_id
```

All auth endpoints return:

```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "Abdulla",
    "lastName": "Ahmed",
    "phoneCountryCode": "+20",
    "phoneNumber": "1012345678",
    "provider": "basic",
    "emailVerified": false,
    "createdAt": "2026-04-06T12:00:00.000Z",
    "lastLoginAt": "2026-04-06T12:00:00.000Z"
  }
}
```

Google is the only supported social auth provider for user registration and login.
