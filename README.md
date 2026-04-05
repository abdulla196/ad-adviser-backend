# Ad Adviser — Backend API

Node.js + Express backend that connects to Meta, TikTok, Snapchat, and Google Ads.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Then fill in your API keys in .env

# 3. Run in development
npm run dev

# 4. Run in production
npm start
```

Server runs on http://localhost:5000

## API Endpoints

All routes require header: `x-api-key: <your API_KEY from .env>`

### Health
| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Server status |

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
