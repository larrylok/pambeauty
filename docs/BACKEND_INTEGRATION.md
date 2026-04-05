# Backend Integration Guide

## Overview
This guide explains how to replace the localStorage-based storage with a real backend API for the Luxe Looks e-commerce platform.

## Current Architecture

### Frontend
- React 19 with React Router
- localStorage for data persistence
- Axios for API calls
- All storage operations centralized in `/app/frontend/src/utils/storage.js`

### Backend (Already Implemented)
- FastAPI (Python)
- MongoDB with Motor (async driver)
- Complete REST API endpoints
- Admin authentication with session management

---

## Backend API Endpoints

The backend is already fully implemented at `/app/backend/server.py`. Here are all available endpoints:

### Products
```
GET    /api/products          - List products (with pagination, search, filter, sort)
GET    /api/products/:id      - Get single product
POST   /api/products          - Create product (admin)
PUT    /api/products/:id      - Update product (admin)
DELETE /api/products/:id      - Delete product (admin)
```

### Orders
```
GET    /api/orders            - List orders (paginated)
GET    /api/orders/:id        - Get single order
POST   /api/orders            - Create order
PUT    /api/orders/:id        - Update order status/details
```

### Reviews
```
GET    /api/reviews           - List reviews (filter by product, status)
POST   /api/reviews           - Create review
PUT    /api/reviews/:id       - Update review (approve/reject/respond)
```

### Collections
```
GET    /api/collections       - List all collections
POST   /api/collections       - Create collection
PUT    /api/collections/:id   - Update collection
```

### Settings
```
GET    /api/settings          - Get settings
PUT    /api/settings          - Update settings
```

### Admin Auth
```
POST   /api/admin/login       - Admin login
POST   /api/admin/logout      - Admin logout
GET    /api/admin/verify      - Verify session
```

### Analytics
```
POST   /api/analytics/track   - Track event
```

### Reports
```
GET    /api/reports/bestsellers - Get bestselling products
GET    /api/reports/revenue     - Get revenue report
```

---

## Step 1: Update Storage Service

The current storage service is at `/app/frontend/src/utils/storage.js`. This is where you'll integrate with the backend.

### Current Implementation (localStorage)
```javascript
const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  
  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  },
  
  async delete(key) {
    localStorage.removeItem(key);
    return true;
  }
};
```

### Backend-Integrated Implementation

Create `/app/frontend/src/utils/backendStorage.js`:

```javascript
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const backendStorage = {
  // Cart operations
  async getCart() {
    // Option 1: Store cart in backend user session
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      // Guest user - use localStorage
      const cart = localStorage.getItem('cart');
      return cart ? JSON.parse(cart) : { items: [], total: 0 };
    }
    
    // Option 2: Fetch from backend
    const response = await axios.get(`${API}/users/${userId}/cart`);
    return response.data;
  },
  
  async setCart(cart) {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      localStorage.setItem('cart', JSON.stringify(cart));
      return true;
    }
    
    await axios.put(`${API}/users/${userId}/cart`, cart);
    return true;
  },
  
  // Wishlist operations
  async getWishlist() {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      const wishlist = localStorage.getItem('wishlist');
      return wishlist ? JSON.parse(wishlist) : [];
    }
    
    const response = await axios.get(`${API}/users/${userId}/wishlist`);
    return response.data;
  },
  
  async setWishlist(wishlist) {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      localStorage.setItem('wishlist', JSON.stringify(wishlist));
      return true;
    }
    
    await axios.put(`${API}/users/${userId}/wishlist`, wishlist);
    return true;
  },
  
  // Generic get/set for other data
  async get(key) {
    // For now, use localStorage for generic keys
    // Migrate specific keys to backend as needed
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  
  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  },
};

export default backendStorage;
```

---

## Step 2: Add User Authentication

Currently, the app supports guest checkout. To fully integrate with backend, add user authentication:

### Backend User Endpoints

Add to `/app/backend/server.py`:

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    password_hash: str
    name: str
    phone: str
    addresses: List[Dict[str, Any]] = []
    cart: Dict[str, Any] = {"items": [], "total": 0}
    wishlist: List[str] = []
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@api_router.post("/auth/register")
async def register_user(email: str, password: str, name: str, phone: str):
    # Check if user exists
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = pwd_context.hash(password)
    
    # Create user
    user = User(
        email=email,
        password_hash=password_hash,
        name=name,
        phone=phone
    )
    
    await db.users.insert_one(user.dict())
    
    # Create session
    session_token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "token": session_token,
        "userId": user.id,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    return {"token": session_token, "user": user}

@api_router.post("/auth/login")
async def login_user(email: str, password: str):
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not pwd_context.verify(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "token": session_token,
        "userId": user["id"],
        "expiresAt": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    return {"token": session_token, "user": user}

@api_router.get("/users/{user_id}/cart")
async def get_user_cart(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.get("cart", {"items": [], "total": 0})

@api_router.put("/users/{user_id}/cart")
async def update_user_cart(user_id: str, cart: Dict[str, Any]):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"cart": cart}}
    )
    return {"message": "Cart updated"}
```

### Install Password Hashing
```bash
cd /app/backend
pip install passlib[bcrypt]
pip freeze > requirements.txt
```

---

## Step 3: Frontend Auth Context

Create `/app/frontend/src/contexts/AuthContext.js`:

```javascript
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    if (token) {
      loadUser(token);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async (token) => {
    try {
      // Verify token and get user
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('auth_token');
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('auth_token', response.data.token);
    localStorage.setItem('user_id', response.data.user.id);
    setUser(response.data.user);
    return response.data;
  };

  const register = async (email, password, name, phone) => {
    const response = await axios.post(`${API}/auth/register`, { 
      email, password, name, phone 
    });
    localStorage.setItem('auth_token', response.data.token);
    localStorage.setItem('user_id', response.data.user.id);
    setUser(response.data.user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## Step 4: Migration Strategy

### Gradual Migration Approach

1. **Phase 1: Orders** (Critical)
   - Orders must be stored in backend immediately
   - Already using backend API for orders
   - ✔️ Complete

2. **Phase 2: User Accounts** (High Priority)
   - Add user registration/login
   - Migrate cart and wishlist to user accounts
   - Keep localStorage fallback for guests

3. **Phase 3: Products** (Low Priority)
   - Already using backend for products
   - ✔️ Complete

4. **Phase 4: Reviews** (Medium Priority)
   - Already using backend for reviews
   - ✔️ Complete

5. **Phase 5: Analytics** (Low Priority)
   - Send analytics events to backend
   - Store in database for reporting

---

## Step 5: Testing

### Unit Tests
Test each API endpoint:
```python
import pytest
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_create_product():
    response = client.post("/api/products", json={...})
    assert response.status_code == 200
```

### Integration Tests
Test frontend-backend communication:
```javascript
import { render, waitFor } from '@testing-library/react';
import axios from 'axios';

test('loads products from backend', async () => {
  const { getByText } = render(<ProductCatalog />);
  await waitFor(() => {
    expect(getByText('Art Deco Diamond Pendant')).toBeInTheDocument();
  });
});
```

---

## Step 6: Deployment

### Backend Deployment
1. Set up MongoDB Atlas or self-hosted MongoDB
2. Configure environment variables
3. Deploy FastAPI backend (Heroku, AWS, DigitalOcean, etc.)
4. Update `REACT_APP_BACKEND_URL` in frontend

### Database Backup
Implement automated backups:
```bash
# MongoDB backup
mongodump --uri="mongodb://localhost:27017/luxelooks" --out=/backups/$(date +%Y%m%d)
```

---

## Monitoring & Performance

### Key Metrics
- API response time
- Error rates
- Database query performance
- User session duration

### Recommended Tools
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **MongoDB Atlas**: Database monitoring
- **Prometheus + Grafana**: Metrics visualization

---

## Security Checklist

- [ ] Enable HTTPS
- [ ] Implement rate limiting
- [ ] Add CORS properly configured
- [ ] Hash all passwords
- [ ] Validate all inputs
- [ ] Sanitize user data
- [ ] Use parameterized queries
- [ ] Implement session expiry
- [ ] Add request logging
- [ ] Regular security audits

---

## Questions?

Refer to:
- FastAPI documentation: https://fastapi.tiangolo.com/
- MongoDB documentation: https://docs.mongodb.com/
- React documentation: https://react.dev/

---

**Next Steps**: Start with user authentication, then gradually migrate cart and wishlist to backend storage.
