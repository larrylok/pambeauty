from fastapi import (
    FastAPI,
    APIRouter,
    HTTPException,
    Query,
    Header,
    Depends,
    Request,
    UploadFile,
    File,
)
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from cloudinary.utils import cloudinary_url
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
import logging
import cloudinary
import cloudinary.uploader
import uuid
import hashlib
import re
import base64
import requests


# ==================== PATHS / ENV ====================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)


def _safe_filename(name: str) -> str:
    name = (name or "image").strip().replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    return name[:120] if name else "image"


def _slugify_text(value: str) -> str:
    value = str(value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"(^-|-$)", "", value)


# ==================== SECURITY HELPERS ====================

def _hash_pw(pw: str) -> str:
    return hashlib.sha256((pw or "").encode("utf-8")).hexdigest()


def _is_strong_password(pw: str) -> bool:
    return isinstance(pw, str) and len(pw.strip()) >= 10


def _phone_key(p: str) -> str:
    digits = re.sub(r"\D", "", str(p or ""))
    return digits[-9:] if len(digits) >= 9 else digits


def _public_order_view(order: Dict[str, Any]) -> Dict[str, Any]:
    if not order:
        return {}

    o = dict(order)
    o.pop("_id", None)
    o.pop("adminNotes", None)

    delivery = dict(o.get("delivery") or {})
    delivery.pop("address", None)
    o["delivery"] = delivery

    payment = dict(o.get("payment") or {})
    payment.pop("mpesaTransactionId", None)
    o["payment"] = payment

    raw_hist = o.get("statusHistory") or []
    safe_hist: List[Dict[str, Any]] = []
    if isinstance(raw_hist, list):
        for h in raw_hist:
            if not isinstance(h, dict):
                continue
            safe_hist.append(
                {
                    "status": h.get("status"),
                    "note": h.get("note"),
                    "at": h.get("at") or h.get("timestamp") or h.get("time") or h.get("createdAt"),
                }
            )
    o["statusHistory"] = safe_hist

    return o


def _normalize_image_roles(images: List[str], primary_image: Optional[str], model_image: Optional[str]) -> Dict[str, Optional[str]]:
    safe_images = images or []
    primary = (primary_image or "").strip()
    model = (model_image or "").strip()

    if primary and primary not in safe_images:
        primary = ""
    if model and model not in safe_images:
        model = ""

    if not primary and safe_images:
        primary = safe_images[0]

    return {
        "primaryImage": primary or None,
        "modelImage": model or None,
    }


async def _get_active_category_by_slug(slug: str) -> Optional[Dict[str, Any]]:
    if not slug:
        return None
    return await db.categories.find_one(
        {"slug": slug, "active": True},
        {"_id": 0},
    )


async def _resolve_page_products(page_doc: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
    if not page_doc:
        return []

    page_type = str(page_doc.get("type") or "manual").strip().lower()

    if page_type == "manual":
        product_ids = [str(x).strip() for x in (page_doc.get("productIds") or []) if str(x).strip()]
        if not product_ids:
            return []

        products = await db.products.find(
            {"id": {"$in": product_ids}, "status": "active"},
            {"_id": 0},
        ).to_list(limit)

        order_map = {pid: i for i, pid in enumerate(product_ids)}
        products.sort(key=lambda p: order_map.get(p.get("id"), 10**9))
        return products

    if page_type == "category":
        category_slug = str(page_doc.get("categorySlug") or "").strip()
        if not category_slug:
            return []

        category_doc = await _get_active_category_by_slug(category_slug)

        if category_doc:
            category_name = str(category_doc.get("name") or "").strip()
            return await db.products.find(
                {"category": category_name, "status": "active"},
                {"_id": 0},
            ).sort("createdAt", -1).to_list(limit)

        all_products = await db.products.find(
            {"status": "active"},
            {"_id": 0},
        ).to_list(1000)

        matched = []
        for product in all_products:
            product_category = str(product.get("category") or "").strip()
            if not product_category:
                continue
            if _slugify_text(product_category) == category_slug:
                matched.append(product)

        matched.sort(key=lambda p: str(p.get("createdAt") or ""), reverse=True)
        return matched[:limit]

    if page_type == "featured":
        return await db.products.find(
            {"isFeatured": True, "status": "active"},
            {"_id": 0},
        ).sort("createdAt", -1).to_list(limit)

    if page_type == "new_arrivals":
        return await db.products.find(
            {"isNewArrival": True, "status": "active"},
            {"_id": 0},
        ).sort("createdAt", -1).to_list(limit)

    if page_type == "bestsellers":
        return await db.products.find(
            {"isBestseller": True, "status": "active"},
            {"_id": 0},
        ).sort("totalPurchases", -1).to_list(limit)

    if page_type == "discounted":
        return await db.products.find(
            {"salePrice": {"$ne": None}, "status": "active"},
            {"_id": 0},
        ).sort("createdAt", -1).to_list(limit)

    return []


# ==================== DB ====================

mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")

if not mongo_url:
    raise RuntimeError("Missing MONGO_URL in backend/.env")
if not db_name:
    raise RuntimeError("Missing DB_NAME in backend/.env")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]


# ==================== APP ====================

app = FastAPI()
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
api_router = APIRouter(prefix="/api")


# ==================== CATEGORY HELPERS ====================

def _serialize_category(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}

    return {
        "id": str(doc.get("id") or ""),
        "name": str(doc.get("name") or "").strip(),
        "slug": str(doc.get("slug") or "").strip(),
        "description": str(doc.get("description") or "").strip(),
        "heroImage": doc.get("heroImage"),
        "active": bool(doc.get("active", True)),
        "showInMenu": bool(doc.get("showInMenu", True)),
        "featured": bool(doc.get("featured", False)),
        "displayOrder": int(doc.get("displayOrder") or 0),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


# ==================== AUTH HELPERS ====================

def _get_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts[0].strip(), parts[1].strip()
    if scheme.lower() != "bearer" or not token:
        return None
    return token


async def require_admin(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    token = _get_bearer_token(authorization)

    if not token:
        token = request.query_params.get("token")
        if token:
            token = token.strip()

    if not token:
        raise HTTPException(status_code=401, detail="Missing admin token")

    doc = await db.admin.find_one({"key": "session"}, {"_id": 0})
    if not doc or "value" not in doc:
        raise HTTPException(status_code=401, detail="No active admin session")

    sess = doc["value"]
    if sess.get("token") != token:
        raise HTTPException(status_code=401, detail="Invalid admin session")

    expires_raw = sess.get("expiresAt")
    if not expires_raw:
        raise HTTPException(status_code=401, detail="Invalid admin session expiry")

    try:
        expires_at = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid admin session expiry format")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=401, detail="Admin session expired")

    return sess


async def optional_admin(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Optional[Dict[str, Any]]:
    try:
        return await require_admin(request=request, authorization=authorization)
    except HTTPException:
        return None


# ==================== MODELS ====================

class ProductVariant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    size: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    stock: int = 0
    sku: str
    priceAdjustment: float = 0.0


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    shortDescription: str
    longDescription: str
    basePrice: float
    salePrice: Optional[float] = None
    discountPercentage: Optional[float] = None
    category: str
    collections: List[str] = []
    tags: List[str] = []
    images: List[str] = []
    primaryImage: Optional[str] = None
    modelImage: Optional[str] = None
    variants: List[ProductVariant] = []
    status: str = "active"
    isFeatured: bool = False
    isBestseller: bool = False
    isNewArrival: bool = False
    allowPreorder: bool = False
    giftWrapAvailable: bool = True
    giftWrapCost: float = 500.0
    materials: Optional[str] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    careInstructions: Optional[str] = None
    sizeGuideId: Optional[str] = None
    relatedProductIds: List[str] = []
    bundleProductIds: List[str] = []
    averageRating: float = 0.0
    reviewCount: int = 0
    viewCount: int = 0
    addToCartCount: int = 0
    totalPurchases: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CartItem(BaseModel):
    productId: str
    variantId: str
    quantity: int
    giftWrap: bool = False
    giftMessage: Optional[str] = None
    giftReceipt: bool = False
    isPreorder: bool = False


class Cart(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[CartItem] = []
    subtotal: float = 0.0
    giftWrapTotal: float = 0.0
    discount: float = 0.0
    shippingCost: float = 0.0
    total: float = 0.0


class CustomerInfo(BaseModel):
    name: str
    email: str
    phone: str
    isGuest: bool = False


class DeliveryInfo(BaseModel):
    address: str
    city: str
    county: str
    method: str
    cost: float
    trackingNumber: Optional[str] = None


class PaymentInfo(BaseModel):
    method: str = "M-Pesa"
    status: str = "pending"
    mpesaTransactionId: Optional[str] = None
    confirmedAt: Optional[str] = None


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    orderNumber: str
    customer: CustomerInfo
    delivery: DeliveryInfo
    items: List[CartItem]
    subtotal: float
    giftWrapTotal: float
    discount: float
    shippingCost: float
    total: float
    payment: PaymentInfo
    status: str = "pending"
    statusHistory: List[Dict[str, Any]] = []
    adminNotes: Optional[str] = None
    courier: Optional[str] = None
    trackingUrl: Optional[str] = None
    packageWeight: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    productId: str
    orderId: str
    customerId: str
    customerName: str
    rating: int
    title: str
    comment: str
    status: str = "pending"
    adminResponse: Optional[str] = None
    verifiedPurchase: bool = True
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Collection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: str
    featured: bool = False
    heroImage: Optional[str] = None
    displayOrder: int = 0
    productIds: List[str] = []


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: Optional[str] = ""
    heroImage: Optional[str] = None
    active: bool = True
    showInMenu: bool = True
    featured: bool = False
    displayOrder: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StorefrontPage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    description: Optional[str] = ""
    heroImage: Optional[str] = None
    type: str = "manual"  # manual | category | featured | new_arrivals | bestsellers | discounted
    categorySlug: Optional[str] = None
    productIds: List[str] = []
    active: bool = True
    showInHeader: bool = False
    showInFooter: bool = True
    featured: bool = False
    displayOrder: int = 0
    seoTitle: Optional[str] = None
    seoDescription: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Settings(BaseModel):
    currencyRates: Dict[str, float] = {"KES": 1.0, "USD": 0.0077, "EUR": 0.0071}
    currencyRatesUpdated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    shippingMethods: List[Dict[str, Any]] = []
    businessInfo: Dict[str, Any] = {}
    inventoryThreshold: int = 5
    allowPreorders: bool = True

    hero: Dict[str, Any] = {
        "announcement": "New arrivals now live • Premium wigs, hair care, and beauty essentials",
        "eyebrow": "PAM Beauty",
        "titleLine1": "Luxury Hair.",
        "titleLine2": "Soft Confidence.",
        "description": "Discover premium wigs, beauty accessories, and everyday essentials designed to bring elegance, polish, and effortless confidence to your routine.",
        "primaryCta": "Shop Collection",
        "secondaryCta": "Shop Wigs",
        "desktopImage": "",
        "mobileImage": "",
        "desktopImagePosition": "center top",
        "mobileImagePosition": "center top",
    }


class AdminLogin(BaseModel):
    password: str


class AdminSession(BaseModel):
    token: str
    expiresAt: str


class AdminChangePassword(BaseModel):
    currentPassword: str
    newPassword: str
    confirmPassword: str


class AdminRecoveryReset(BaseModel):
    recoveryKey: str
    newPassword: str
    confirmPassword: str


# ==================== ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "PAM Beauty API", "status": "active"}
 
# ==================== MPESA ====================

CONSUMER_KEY = (os.getenv("MPESA_CONSUMER_KEY") or "").strip()
CONSUMER_SECRET = (os.getenv("MPESA_CONSUMER_SECRET") or "").strip()
MPESA_SHORTCODE = (os.getenv("MPESA_SHORTCODE", "174379") or "").strip()
MPESA_PASSKEY = (os.getenv("MPESA_PASSKEY", "") or "").strip()
MPESA_CALLBACK_URL = (os.getenv("MPESA_CALLBACK_URL", "https://example.com/callback") or "").strip()

if not CONSUMER_KEY or not CONSUMER_SECRET:
    raise RuntimeError("Missing M-Pesa credentials.")

if not MPESA_SHORTCODE or not MPESA_PASSKEY:
    raise RuntimeError("Missing M-Pesa shortcode or passkey.")


class STKPushRequest(BaseModel):
    phone: str
    amount: int
    accountReference: Optional[str] = "PAM Beauty"
    transactionDesc: Optional[str] = "Payment"


def _format_mpesa_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", str(phone or ""))

    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]

    if digits.startswith("254") and len(digits) == 12:
        return digits

    if digits.startswith("7") and len(digits) == 9:
        return "254" + digits

    raise HTTPException(status_code=400, detail="Invalid phone number format")


def _get_mpesa_access_token() -> str:
    url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"

    credentials = f"{CONSUMER_KEY}:{CONSUMER_SECRET}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()

    headers = {
        "Authorization": f"Basic {encoded_credentials}"
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to M-Pesa token endpoint: {str(e)}"
        )

    try:
        data = response.json()
    except Exception:
        data = {"raw": response.text}

    if response.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to get M-Pesa token",
                "status_code": response.status_code,
                "safaricom_response": data,
            },
        )

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "M-Pesa token missing in response",
                "safaricom_response": data,
            },
        )

    return access_token


def _extract_callback_metadata(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    result = {}
    for item in items or []:
        if not isinstance(item, dict):
            continue
        name = item.get("Name")
        value = item.get("Value")
        if name:
            result[name] = value
    return result


@api_router.get("/mpesa/token")
def get_access_token():
    return {"access_token": _get_mpesa_access_token()}


@api_router.post("/mpesa/stkpush")
def stk_push(payload: STKPushRequest):
    access_token = _get_mpesa_access_token()
    phone = _format_mpesa_phone(payload.phone)

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(
        f"{MPESA_SHORTCODE}{MPESA_PASSKEY}{timestamp}".encode()
    ).decode()

    url = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

    request_payload = {
        "BusinessShortCode": MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(payload.amount),
        "PartyA": phone,
        "PartyB": MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": MPESA_CALLBACK_URL,
        "AccountReference": payload.accountReference or "PAM Beauty",
        "TransactionDesc": payload.transactionDesc or "Payment",
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            url,
            json=request_payload,
            headers=headers,
            timeout=30,
        )
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"STK push request failed: {str(e)}")

    try:
        data = response.json()
    except Exception:
        data = {"raw": response.text}

    return {
        "status_code": response.status_code,
        "safaricom_response": data,
        "debug": {
            "shortcode": MPESA_SHORTCODE,
            "phone": phone,
            "timestamp": timestamp,
            "callback": MPESA_CALLBACK_URL,
            "accountReference": payload.accountReference or "PAM Beauty",
            "transactionDesc": payload.transactionDesc or "Payment",
        },
    }


@api_router.post("/mpesa/callback")
async def mpesa_callback(payload: Dict[str, Any]):
    now_iso = datetime.now(timezone.utc).isoformat()

    body = ((payload or {}).get("Body") or {})
    stk_callback = body.get("stkCallback") or {}

    merchant_request_id = stk_callback.get("MerchantRequestID")
    checkout_request_id = stk_callback.get("CheckoutRequestID")
    result_code = stk_callback.get("ResultCode")
    result_desc = stk_callback.get("ResultDesc")

    callback_items = (((stk_callback.get("CallbackMetadata") or {}).get("Item")) or [])
    metadata = _extract_callback_metadata(callback_items)

    mpesa_receipt = metadata.get("MpesaReceiptNumber")
    amount = metadata.get("Amount")
    phone_number = metadata.get("PhoneNumber")
    transaction_date = metadata.get("TransactionDate")

    order = await db.orders.find_one(
        {"payment.checkoutRequestID": checkout_request_id}
    )

    if not order:
        return {
            "ok": True,
            "message": "Callback received but no matching order found",
            "checkoutRequestID": checkout_request_id,
        }

    payment = dict(order.get("payment") or {})
    status_history = order.get("statusHistory") or []
    if not isinstance(status_history, list):
        status_history = []

    is_success = str(result_code) == "0"

    payment["method"] = "M-Pesa"
    payment["checkoutRequestID"] = checkout_request_id
    payment["merchantRequestID"] = merchant_request_id
    payment["status"] = "confirmed" if is_success else "failed"
    payment["confirmedAt"] = now_iso if is_success else payment.get("confirmedAt")
    payment["mpesaTransactionId"] = mpesa_receipt if is_success else payment.get("mpesaTransactionId")
    payment["resultCode"] = result_code
    payment["resultDesc"] = result_desc
    payment["phone"] = str(phone_number) if phone_number is not None else payment.get("phone")
    payment["amount"] = amount if amount is not None else payment.get("amount")
    payment["transactionDate"] = str(transaction_date) if transaction_date is not None else payment.get("transactionDate")
    payment["callbackRaw"] = payload

    new_order_status = "processing" if is_success else "payment_failed"

    status_history.append(
        {
            "status": new_order_status,
            "at": now_iso,
            "timestamp": now_iso,
            "note": result_desc or ("Payment confirmed" if is_success else "Payment failed"),
        }
    )

    await db.orders.update_one(
        {"_id": order["_id"]},
        {
            "$set": {
                "payment": payment,
                "status": new_order_status,
                "updatedAt": now_iso,
                "statusHistory": status_history,
            }
        },
    )

    return {
        "ok": True,
        "message": "Callback processed",
        "checkoutRequestID": checkout_request_id,
        "resultCode": result_code,
        "resultDesc": result_desc,
    }

# ==================== PRODUCTS ====================

@api_router.get("/products")
async def get_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    collection: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = None,
    status: str = "active",
):
    query: Dict[str, Any] = {"status": status}

    if category:
        query["category"] = category

    if collection:
        query["collections"] = collection

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"shortDescription": {"$regex": search, "$options": "i"}},
            {"longDescription": {"$regex": search, "$options": "i"}},
            {"tags": {"$elemMatch": {"$regex": search, "$options": "i"}}},
        ]

    skip = (page - 1) * limit
    total = await db.products.count_documents(query)

    sort_field = "createdAt"
    sort_order = -1

    if sort == "price_asc":
        sort_field = "basePrice"
        sort_order = 1
    elif sort == "price_desc":
        sort_field = "basePrice"
        sort_order = -1
    elif sort == "name":
        sort_field = "name"
        sort_order = 1

    products = (
        await db.products.find(query, {"_id": 0})
        .sort(sort_field, sort_order)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    return {
        "products": products,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.products.update_one({"id": product_id}, {"$inc": {"viewCount": 1}})
    product["viewCount"] = product.get("viewCount", 0) + 1
    return product


@api_router.post("/products")
async def create_product(
    product: Product,
    session: Dict[str, Any] = Depends(require_admin),
):
    product_dict = product.dict()
    now_iso = datetime.now(timezone.utc).isoformat()

    product_dict["images"] = product_dict.get("images") or []
    product_dict["tags"] = product_dict.get("tags") or []
    product_dict["collections"] = product_dict.get("collections") or []
    product_dict["relatedProductIds"] = product_dict.get("relatedProductIds") or []
    product_dict["bundleProductIds"] = product_dict.get("bundleProductIds") or []

    image_roles = _normalize_image_roles(
        images=product_dict["images"],
        primary_image=product_dict.get("primaryImage"),
        model_image=product_dict.get("modelImage"),
    )
    product_dict["primaryImage"] = image_roles["primaryImage"]
    product_dict["modelImage"] = image_roles["modelImage"]

    clean_variants = []
    for v in (product_dict.get("variants") or []):
        sku = str(v.get("sku") or "").strip()
        if not sku:
            raise HTTPException(status_code=400, detail="Each variant must have an SKU")

        variant_id = str(v.get("id") or "").strip() or str(uuid.uuid4())

        clean_variants.append({
            "id": variant_id,
            "size": (v.get("size") or None),
            "color": (v.get("color") or None),
            "material": (v.get("material") or None),
            "stock": int(v.get("stock") or 0),
            "sku": sku,
            "priceAdjustment": float(v.get("priceAdjustment") or 0.0),
        })

    product_dict["variants"] = clean_variants
    product_dict["createdAt"] = product_dict.get("createdAt") or now_iso
    product_dict["updatedAt"] = now_iso

    result = await db.products.insert_one(product_dict)

    created_product = await db.products.find_one(
        {"_id": result.inserted_id},
        {"_id": 0},
    )

    if not created_product:
        raise HTTPException(status_code=500, detail="Product created but could not be retrieved")

    return created_product


@api_router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    product: Product,
    session: Dict[str, Any] = Depends(require_admin),
):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    product_dict = product.dict()
    product_dict["id"] = product_id

    product_dict["images"] = product_dict.get("images") or []
    product_dict["tags"] = product_dict.get("tags") or []
    product_dict["collections"] = product_dict.get("collections") or []
    product_dict["relatedProductIds"] = product_dict.get("relatedProductIds") or []
    product_dict["bundleProductIds"] = product_dict.get("bundleProductIds") or []

    image_roles = _normalize_image_roles(
        images=product_dict["images"],
        primary_image=product_dict.get("primaryImage"),
        model_image=product_dict.get("modelImage"),
    )
    product_dict["primaryImage"] = image_roles["primaryImage"]
    product_dict["modelImage"] = image_roles["modelImage"]

    clean_variants = []
    for v in (product_dict.get("variants") or []):
        sku = str(v.get("sku") or "").strip()
        if not sku:
            raise HTTPException(status_code=400, detail="Each variant must have an SKU")

        variant_id = str(v.get("id") or "").strip() or str(uuid.uuid4())

        clean_variants.append({
            "id": variant_id,
            "size": (v.get("size") or None),
            "color": (v.get("color") or None),
            "material": (v.get("material") or None),
            "stock": int(v.get("stock") or 0),
            "sku": sku,
            "priceAdjustment": float(v.get("priceAdjustment") or 0.0),
        })

    product_dict["variants"] = clean_variants
    product_dict["createdAt"] = existing.get("createdAt") or product_dict.get("createdAt")
    product_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    await db.products.update_one({"id": product_id}, {"$set": product_dict})
    return product_dict


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, session: Dict[str, Any] = Depends(require_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}


# ============================ ORDERS ============================

@api_router.post("/orders")
async def create_order(order: Order):
    order_dict = order.dict()

    if not order_dict.get("items"):
        raise HTTPException(status_code=400, detail="Order must contain items")

    now_iso = datetime.now(timezone.utc).isoformat()
    order_dict["createdAt"] = order_dict.get("createdAt") or now_iso
    order_dict["updatedAt"] = now_iso

    if not isinstance(order_dict.get("statusHistory"), list):
        order_dict["statusHistory"] = []

    result = await db.orders.insert_one(order_dict)
    order_dict["_id"] = str(result.inserted_id)
    return order_dict


# ==================== PUBLIC ORDER TRACKING (NO LOGIN) ====================

@api_router.get("/orders/track/{order_number}")
async def track_order_public(order_number: str):
    order_number = (order_number or "").strip()
    if not order_number:
        raise HTTPException(status_code=400, detail="Missing order number")

    order = await db.orders.find_one({"orderNumber": order_number}, {"_id": 0})

    if not order:
        order = await db.orders.find_one(
            {"orderNumber": {"$regex": f"^{re.escape(order_number)}$", "$options": "i"}},
            {"_id": 0},
        )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return _public_order_view(order)


# ==================== ADMIN ORDER MANAGEMENT ====================

@api_router.get("/orders")
async def get_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    includeArchived: bool = Query(False),
    session: Dict[str, Any] = Depends(require_admin),
):
    skip = (page - 1) * limit

    query: Dict[str, Any] = {}
    if not includeArchived:
        query["$or"] = [{"archived": {"$exists": False}}, {"archived": False}]

    total = await db.orders.count_documents(query)
    orders = (
        await db.orders.find(query)
        .sort("createdAt", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    for o in orders:
        o["_id"] = str(o["_id"])
        if "archived" not in o:
            o["archived"] = False

    return {
        "orders": orders,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


def _order_lookup_filter(order_id: str) -> Dict[str, Any]:
    filt: Dict[str, Any] = {"id": order_id}
    try:
        filt = {"$or": [{"_id": ObjectId(order_id)}, {"id": order_id}]}
    except Exception:
        filt = {"id": order_id}
    return filt


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, session: Dict[str, Any] = Depends(require_admin)):
    order = await db.orders.find_one(_order_lookup_filter(order_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order["_id"] = str(order["_id"])
    if "archived" not in order:
        order["archived"] = False
    return order


@api_router.put("/orders/{order_id}")
async def update_order(
    order_id: str,
    updates: Dict[str, Any],
    session: Dict[str, Any] = Depends(require_admin),
):
    allowed = {
        "status",
        "adminNotes",
        "courier",
        "trackingUrl",
        "delivery",
        "payment",
        "statusHistory",
        "packageWeight",
        "archived",
    }

    updates = updates or {}
    safe_updates = {k: v for k, v in updates.items() if k in allowed}

    current = await db.orders.find_one(_order_lookup_filter(order_id))
    if not current:
        raise HTTPException(status_code=404, detail="Order not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    safe_updates["updatedAt"] = now_iso

    new_status = safe_updates.get("status")
    old_status = current.get("status")

    if new_status and new_status != old_status:
        if "statusHistory" not in safe_updates:
            history = current.get("statusHistory") or []
            if not isinstance(history, list):
                history = []
            history.append({"status": new_status, "at": now_iso, "note": None})
            safe_updates["statusHistory"] = history

    result = await db.orders.update_one(_order_lookup_filter(order_id), {"$set": safe_updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    return {"message": "Order updated"}


@api_router.patch("/orders/{order_id}/archive")
async def archive_order(order_id: str, session: Dict[str, Any] = Depends(require_admin)):
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.orders.update_one(
        _order_lookup_filter(order_id),
        {"$set": {"archived": True, "updatedAt": now_iso}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


@api_router.patch("/orders/{order_id}/unarchive")
async def unarchive_order(order_id: str, session: Dict[str, Any] = Depends(require_admin)):
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.orders.update_one(
        _order_lookup_filter(order_id),
        {"$set": {"archived": False, "updatedAt": now_iso}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}


# ============================ REVIEWS ============================

@api_router.post("/reviews")
async def create_review(review: Review):
    review_dict = review.dict()
    review_dict["status"] = "pending"
    review_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    review_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    await db.reviews.insert_one(review_dict)
    return review_dict


@api_router.get("/reviews")
async def get_reviews(
    productId: Optional[str] = None,
    status: Optional[str] = None,
    session: Optional[Dict[str, Any]] = Depends(optional_admin),
):
    query: Dict[str, Any] = {}
    if productId:
        query["productId"] = productId

    is_admin = bool(session)

    if is_admin:
        if status:
            query["status"] = status
    else:
        query["status"] = "approved"

    reviews = await db.reviews.find(query, {"_id": 0}).sort("createdAt", -1).to_list(1000)
    return reviews


@api_router.put("/reviews/{review_id}")
async def update_review(review_id: str, updates: Dict[str, Any], session: Dict[str, Any] = Depends(require_admin)):
    updates = updates or {}
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = await db.reviews.update_one({"id": review_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")

    if updates.get("status") == "approved":
        review = await db.reviews.find_one({"id": review_id}, {"_id": 0})
        if review:
            approved_reviews = await db.reviews.find(
                {"productId": review["productId"], "status": "approved"},
                {"_id": 0},
            ).to_list(1000)

            if approved_reviews:
                avg_rating = sum(r.get("rating", 0) for r in approved_reviews) / len(approved_reviews)
                await db.products.update_one(
                    {"id": review["productId"]},
                    {"$set": {"averageRating": round(avg_rating, 1), "reviewCount": len(approved_reviews)}},
                )

    return {"message": "Review updated"}


# ============================ CATEGORIES ============================

@api_router.get("/categories")
async def list_categories(session: Dict[str, Any] = Depends(require_admin)):
    categories = await db.categories.find({}, {"_id": 0}).sort("displayOrder", 1).to_list(500)
    return [_serialize_category(c) for c in categories]


@api_router.post("/categories")
async def create_category(category: Category, session: Dict[str, Any] = Depends(require_admin)):
    category_dict = category.dict()

    category_dict["id"] = str(category_dict.get("id") or str(uuid.uuid4()))
    category_dict["name"] = str(category_dict.get("name") or "").strip()
    category_dict["slug"] = _slugify_text(category_dict.get("slug") or category_dict["name"])
    category_dict["description"] = str(category_dict.get("description") or "").strip()
    category_dict["heroImage"] = category_dict.get("heroImage") or None
    category_dict["active"] = bool(category_dict.get("active", True))
    category_dict["showInMenu"] = bool(category_dict.get("showInMenu", True))
    category_dict["featured"] = bool(category_dict.get("featured", False))
    category_dict["displayOrder"] = int(category_dict.get("displayOrder") or 0)
    category_dict["createdAt"] = category_dict.get("createdAt") or datetime.now(timezone.utc).isoformat()
    category_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    if not category_dict["name"]:
        raise HTTPException(status_code=400, detail="Category name is required")
    if not category_dict["slug"]:
        raise HTTPException(status_code=400, detail="Category slug is required")

    existing = await db.categories.find_one({"slug": category_dict["slug"]}, {"_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Category slug already exists")

    await db.categories.insert_one(category_dict)
    return _serialize_category(category_dict)


@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, category: Category, session: Dict[str, Any] = Depends(require_admin)):
    existing = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    category_dict = category.dict()

    category_dict["id"] = category_id
    category_dict["name"] = str(category_dict.get("name") or "").strip()
    category_dict["slug"] = _slugify_text(category_dict.get("slug") or category_dict["name"])
    category_dict["description"] = str(category_dict.get("description") or "").strip()
    category_dict["heroImage"] = category_dict.get("heroImage") or None
    category_dict["active"] = bool(category_dict.get("active", True))
    category_dict["showInMenu"] = bool(category_dict.get("showInMenu", True))
    category_dict["featured"] = bool(category_dict.get("featured", False))
    category_dict["displayOrder"] = int(category_dict.get("displayOrder") or 0)
    category_dict["createdAt"] = existing.get("createdAt") or datetime.now(timezone.utc).isoformat()
    category_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    if not category_dict["name"]:
        raise HTTPException(status_code=400, detail="Category name is required")
    if not category_dict["slug"]:
        raise HTTPException(status_code=400, detail="Category slug is required")

    dup = await db.categories.find_one(
        {"slug": category_dict["slug"], "id": {"$ne": category_id}},
        {"_id": 1},
    )
    if dup:
        raise HTTPException(status_code=400, detail="Category slug already exists")

    await db.categories.update_one({"id": category_id}, {"$set": category_dict})
    return _serialize_category(category_dict)


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, session: Dict[str, Any] = Depends(require_admin)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


@api_router.post("/categories/sync-from-products")
async def sync_categories_from_products(session: Dict[str, Any] = Depends(require_admin)):
    raw_categories = await db.products.distinct("category", {"status": "active"})

    created = 0
    updated = 0
    results = []

    for name in raw_categories:
        clean_name = str(name or "").strip()
        if not clean_name:
            continue

        slug = _slugify_text(clean_name)
        if not slug:
            continue

        existing = await db.categories.find_one({"slug": slug}, {"_id": 0})

        payload = {
            "name": clean_name,
            "slug": slug,
            "description": existing.get("description", "") if existing else "",
            "heroImage": existing.get("heroImage") if existing else None,
            "active": existing.get("active", True) if existing else True,
            "showInMenu": existing.get("showInMenu", True) if existing else True,
            "featured": existing.get("featured", False) if existing else False,
            "displayOrder": existing.get("displayOrder", 0) if existing else 0,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }

        if existing:
            await db.categories.update_one(
                {"slug": slug},
                {"$set": payload},
            )
            updated += 1
        else:
            payload["id"] = str(uuid.uuid4())
            payload["createdAt"] = datetime.now(timezone.utc).isoformat()
            await db.categories.insert_one(payload)
            created += 1

        results.append({
            "name": clean_name,
            "slug": slug,
        })

    return {
        "message": "Categories synced from products",
        "created": created,
        "updated": updated,
        "categories": results,
    }


# ============================ STOREFRONT PAGES ============================

@api_router.get("/pages")
async def list_storefront_pages(session: Dict[str, Any] = Depends(require_admin)):
    pages = await db.pages.find({}, {"_id": 0}).sort("displayOrder", 1).to_list(500)
    return pages


@api_router.post("/pages")
async def create_storefront_page(page: StorefrontPage, session: Dict[str, Any] = Depends(require_admin)):
    page_dict = page.dict()
    page_dict["name"] = str(page_dict.get("name") or "").strip()
    page_dict["slug"] = _slugify_text(page_dict.get("slug") or page_dict["name"])
    page_dict["type"] = str(page_dict.get("type") or "manual").strip().lower()
    page_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    if not page_dict["name"]:
        raise HTTPException(status_code=400, detail="Page name is required")
    if not page_dict["slug"]:
        raise HTTPException(status_code=400, detail="Page slug is required")

    existing = await db.pages.find_one({"slug": page_dict["slug"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Page slug already exists")

    if page_dict["type"] == "category":
        page_dict["categorySlug"] = str(page_dict.get("categorySlug") or "").strip()
        page_dict["productIds"] = []
        if not page_dict["categorySlug"]:
            raise HTTPException(status_code=400, detail="Category page must have categorySlug")
    elif page_dict["type"] == "manual":
        page_dict["productIds"] = [str(x).strip() for x in (page_dict.get("productIds") or []) if str(x).strip()]
        page_dict["categorySlug"] = None
    else:
        page_dict["productIds"] = []
        page_dict["categorySlug"] = None

    await db.pages.insert_one(page_dict)
    return page_dict


@api_router.put("/pages/{page_id}")
async def update_storefront_page(page_id: str, page: StorefrontPage, session: Dict[str, Any] = Depends(require_admin)):
    existing = await db.pages.find_one({"id": page_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Page not found")

    page_dict = page.dict()
    page_dict["id"] = page_id
    page_dict["name"] = str(page_dict.get("name") or "").strip()
    page_dict["slug"] = _slugify_text(page_dict.get("slug") or page_dict["name"])
    page_dict["type"] = str(page_dict.get("type") or "manual").strip().lower()
    page_dict["createdAt"] = existing.get("createdAt") or page_dict.get("createdAt")
    page_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    if not page_dict["name"]:
        raise HTTPException(status_code=400, detail="Page name is required")
    if not page_dict["slug"]:
        raise HTTPException(status_code=400, detail="Page slug is required")

    dup = await db.pages.find_one(
        {"slug": page_dict["slug"], "id": {"$ne": page_id}},
        {"_id": 0},
    )
    if dup:
        raise HTTPException(status_code=400, detail="Page slug already exists")

    if page_dict["type"] == "category":
        page_dict["categorySlug"] = str(page_dict.get("categorySlug") or "").strip()
        page_dict["productIds"] = []
        if not page_dict["categorySlug"]:
            raise HTTPException(status_code=400, detail="Category page must have categorySlug")
    elif page_dict["type"] == "manual":
        page_dict["productIds"] = [str(x).strip() for x in (page_dict.get("productIds") or []) if str(x).strip()]
        page_dict["categorySlug"] = None
    else:
        page_dict["productIds"] = []
        page_dict["categorySlug"] = None

    await db.pages.update_one({"id": page_id}, {"$set": page_dict})
    return page_dict


@api_router.delete("/pages/{page_id}")
async def delete_storefront_page(page_id: str, session: Dict[str, Any] = Depends(require_admin)):
    result = await db.pages.delete_one({"id": page_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"message": "Page deleted"}


# ============================ STOREFRONT PUBLIC ============================

@api_router.get("/storefront/navigation")
async def get_storefront_navigation():
    categories = await db.categories.find(
        {"active": True},
        {"_id": 0},
    ).sort("displayOrder", 1).to_list(500)

    category_items = []

    if categories:
        for c in categories:
            name = str(c.get("name") or "").strip()
            slug = str(c.get("slug") or "").strip()
            if not name or not slug:
                continue

            product_count = await db.products.count_documents({
                "status": "active",
                "category": name,
            })

            category_items.append({
                "id": c.get("id"),
                "name": name,
                "slug": slug,
                "description": c.get("description") or "",
                "heroImage": c.get("heroImage"),
                "showInMenu": bool(c.get("showInMenu", True)),
                "featured": bool(c.get("featured", False)),
                "displayOrder": int(c.get("displayOrder") or 0),
                "productCount": product_count,
                "path": f"/categories/{slug}",
            })
    else:
        raw_categories = await db.products.distinct("category", {"status": "active"})
        fallback_categories = []

        for name in raw_categories:
            clean_name = str(name or "").strip()
            if not clean_name:
                continue

            slug = _slugify_text(clean_name)
            if not slug:
                continue

            product_count = await db.products.count_documents({
                "status": "active",
                "category": clean_name,
            })

            fallback_categories.append({
                "id": f"fallback-{slug}",
                "name": clean_name,
                "slug": slug,
                "description": "",
                "heroImage": None,
                "showInMenu": True,
                "featured": False,
                "displayOrder": 999,
                "productCount": product_count,
                "path": f"/categories/{slug}",
            })

        category_items = sorted(fallback_categories, key=lambda x: x["name"].lower())

    pages = await db.pages.find(
        {"active": True},
        {"_id": 0},
    ).sort("displayOrder", 1).to_list(500)

    page_items = []
    for p in pages:
        name = str(p.get("name") or "").strip()
        slug = str(p.get("slug") or "").strip()
        if not name or not slug:
            continue

        page_products = await _resolve_page_products(p, limit=1000)

        page_items.append({
            "id": p.get("id"),
            "name": name,
            "slug": slug,
            "description": p.get("description") or "",
            "heroImage": p.get("heroImage"),
            "type": p.get("type") or "manual",
            "featured": bool(p.get("featured", False)),
            "showInHeader": bool(p.get("showInHeader", False)),
            "showInFooter": bool(p.get("showInFooter", True)),
            "displayOrder": int(p.get("displayOrder") or 0),
            "productCount": len(page_products),
            "path": f"/pages/{slug}",
        })

    legacy_collections = (
        await db.collections.find({}, {"_id": 0})
        .sort("displayOrder", 1)
        .to_list(100)
    )

    collections = []
    for c in legacy_collections:
        slug = str(c.get("slug") or "").strip()
        name = str(c.get("name") or "").strip()

        if not slug or not name:
            continue

        product_count = await db.products.count_documents({
            "status": "active",
            "collections": slug,
        })

        collections.append({
            "id": c.get("id"),
            "name": name,
            "slug": slug,
            "description": c.get("description") or "",
            "heroImage": c.get("heroImage"),
            "featured": bool(c.get("featured")),
            "displayOrder": int(c.get("displayOrder") or 0),
            "productCount": product_count,
            "path": f"/?collection={slug}",
        })

    return {
        "categories": category_items,
        "pages": page_items,
        "collections": collections,
    }


@api_router.get("/storefront/categories")
async def get_storefront_categories():
    categories = await db.categories.find(
        {"active": True},
        {"_id": 0},
    ).sort("displayOrder", 1).to_list(500)

    result = []
    for c in categories:
        name = str(c.get("name") or "").strip()
        slug = str(c.get("slug") or "").strip()
        if not name or not slug:
            continue

        product_count = await db.products.count_documents({
            "status": "active",
            "category": name,
        })

        result.append({
            **c,
            "productCount": product_count,
            "path": f"/categories/{slug}",
        })

    return result


@api_router.get("/storefront/categories/{slug}")
async def get_storefront_category_by_slug(slug: str):
    category = await db.categories.find_one(
        {"slug": slug, "active": True},
        {"_id": 0},
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category_name = str(category.get("name") or "").strip()

    products = await db.products.find(
        {"category": category_name, "status": "active"},
        {"_id": 0},
    ).sort("createdAt", -1).to_list(200)

    return {
        "category": {
            **category,
            "path": f"/categories/{slug}",
        },
        "products": products,
    }


@api_router.get("/storefront/pages")
async def get_storefront_pages():
    pages = await db.pages.find(
        {"active": True},
        {"_id": 0},
    ).sort("displayOrder", 1).to_list(500)

    result = []
    for p in pages:
        resolved = await _resolve_page_products(p, limit=1000)
        result.append({
            **p,
            "productCount": len(resolved),
            "path": f"/pages/{p.get('slug')}",
        })

    return result


@api_router.get("/storefront/pages/{slug}")
async def get_storefront_page_by_slug(slug: str):
    page = await db.pages.find_one(
        {"slug": slug, "active": True},
        {"_id": 0},
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    products = await _resolve_page_products(page, limit=200)

    return {
        "page": {
            **page,
            "path": f"/pages/{slug}",
        },
        "products": products,
    }


# ============================ COLLECTIONS (LEGACY / COMPATIBILITY) ============================

@api_router.get("/collections")
async def list_collections(session: Dict[str, Any] = Depends(require_admin)):
    collections = await db.collections.find({}, {"_id": 0}).sort("displayOrder", 1).to_list(100)
    return collections


@api_router.post("/collections")
async def create_collection(collection: Collection, session: Dict[str, Any] = Depends(require_admin)):
    collection_dict = collection.dict()
    await db.collections.insert_one(collection_dict)
    return collection_dict


@api_router.put("/collections/{collection_id}")
async def update_collection(collection_id: str, collection: Collection, session: Dict[str, Any] = Depends(require_admin)):
    collection_dict = collection.dict()
    result = await db.collections.update_one({"id": collection_id}, {"$set": collection_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection_dict


# ============================ SETTINGS ============================

@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({}, {"_id": 0})

    default_settings = Settings().dict()

    if not settings:
        await db.settings.insert_one(default_settings)
        return default_settings

    for key, value in default_settings.items():
        if key not in settings:
            settings[key] = value

    if "hero" not in settings or not isinstance(settings["hero"], dict):
        settings["hero"] = default_settings["hero"]
    else:
        for key, value in default_settings["hero"].items():
            if key not in settings["hero"]:
                settings["hero"][key] = value

    await db.settings.update_one({}, {"$set": settings}, upsert=True)
    return settings


@api_router.put("/settings")
async def update_settings(settings: Settings, session: Dict[str, Any] = Depends(require_admin)):
    settings_dict = settings.dict()

    default_settings = Settings().dict()

    for key, value in default_settings.items():
        if key not in settings_dict:
            settings_dict[key] = value

    if "hero" not in settings_dict or not isinstance(settings_dict["hero"], dict):
        settings_dict["hero"] = default_settings["hero"]
    else:
        for key, value in default_settings["hero"].items():
            if key not in settings_dict["hero"]:
                settings_dict["hero"][key] = value

    await db.settings.update_one({}, {"$set": settings_dict}, upsert=True)
    return settings_dict


# ==================== ADMIN AUTH ====================

@api_router.post("/admin/change-password")
async def admin_change_password(payload: AdminChangePassword, session: Dict[str, Any] = Depends(require_admin)):
    stored = await db.admin.find_one({"key": "password"}, {"_id": 0})
    if not stored or "value" not in stored:
        raise HTTPException(status_code=500, detail="Admin password not initialized")

    cur = (payload.currentPassword or "").strip()
    new = (payload.newPassword or "").strip()
    conf = (payload.confirmPassword or "").strip()

    if not cur or not new or not conf:
        raise HTTPException(status_code=400, detail="All fields are required")

    if new != conf:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not _is_strong_password(new):
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters")

    current_hash = _hash_pw(cur)
    if current_hash != stored["value"]:
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    new_hash = _hash_pw(new)
    await db.admin.update_one(
        {"key": "password"},
        {"$set": {"key": "password", "value": new_hash}},
        upsert=True,
    )

    await db.admin.delete_one({"key": "session"})
    return {"message": "Password changed. Please login again."}


@api_router.post("/admin/recovery-reset-password")
async def admin_recovery_reset_password(payload: AdminRecoveryReset):
    expected = (os.environ.get("ADMIN_RECOVERY_KEY") or "").strip()
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_RECOVERY_KEY not configured on server")

    key = (payload.recoveryKey or "").strip()
    new = (payload.newPassword or "").strip()
    conf = (payload.confirmPassword or "").strip()

    if key != expected:
        raise HTTPException(status_code=401, detail="Invalid recovery key")

    if not new or not conf:
        raise HTTPException(status_code=400, detail="New password fields are required")

    if new != conf:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not _is_strong_password(new):
        raise HTTPException(status_code=400, detail="New password must be at least 10 characters")

    await db.admin.update_one(
        {"key": "password"},
        {"$set": {"key": "password", "value": _hash_pw(new)}},
        upsert=True,
    )

    await db.admin.delete_one({"key": "session"})
    return {"message": "Password reset successfully. Please login again."}


@api_router.post("/admin/login")
async def admin_login(login: AdminLogin):
    password_hash = _hash_pw(login.password)

    stored_hash = await db.admin.find_one({"key": "password"}, {"_id": 0})
    if not stored_hash or "value" not in stored_hash:
        raise HTTPException(
            status_code=500,
            detail="Admin password not initialized. Set it once in the database.",
        )

    if password_hash != stored_hash["value"]:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    session = {"token": token, "expiresAt": expires_at.isoformat()}

    await db.admin.update_one(
        {"key": "session"},
        {"$set": {"key": "session", "value": session}},
        upsert=True,
    )

    return session


@api_router.post("/admin/logout")
async def admin_logout(session: Dict[str, Any] = Depends(require_admin)):
    await db.admin.delete_one({"key": "session"})
    return {"message": "Logged out"}


@api_router.get("/admin/verify")
async def verify_admin(session: Dict[str, Any] = Depends(require_admin)):
    return {"valid": True}


# ============================ ANALYTICS ============================

@api_router.post("/analytics/track")
async def track_analytics(event: Dict[str, Any], session: Dict[str, Any] = Depends(require_admin)):
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Invalid event payload")
    event["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.analytics.insert_one(event)
    return {"message": "Event tracked"}


# ============================ REPORTS ============================

@api_router.get("/reports/bestsellers")
async def get_bestsellers(limit: int = 10):
    products = (
        await db.products.find({"status": "active"}, {"_id": 0})
        .sort("totalPurchases", -1)
        .limit(limit)
        .to_list(limit)
    )
    return products


@api_router.get("/reports/revenue")
async def get_revenue(start_date: Optional[str] = None, end_date: Optional[str] = None):
    query: Dict[str, Any] = {"payment.status": "confirmed"}
    if start_date:
        query["createdAt"] = {"$gte": start_date}
    if end_date:
        if "createdAt" in query:
            query["createdAt"]["$lte"] = end_date
        else:
            query["createdAt"] = {"$lte": end_date}

    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)

    total_revenue = sum(order.get("total", 0) for order in orders)
    total_orders = len(orders)

    return {
        "totalRevenue": total_revenue,
        "totalOrders": total_orders,
        "averageOrderValue": (total_revenue / total_orders) if total_orders > 0 else 0,
        "orders": orders,
    }


# ============================ UPLOADS ============================

@api_router.post("/admin/upload-image")
async def admin_upload_image(
    file: UploadFile = File(...),
    session: Dict[str, Any] = Depends(require_admin),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    original = _safe_filename(file.filename or "image")
    base = os.path.splitext(original)[0] or "image"

    try:
        upload_result = cloudinary.uploader.upload(
            data,
            folder="pambeauty",
            public_id=f"{base}_{uuid.uuid4().hex}",
            resource_type="image",
            overwrite=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {str(e)}")

    public_id = upload_result.get("public_id")
    secure_url = upload_result.get("secure_url")

    if not public_id or not secure_url:
        raise HTTPException(status_code=500, detail="Upload succeeded but no image URL was returned")

    thumb_url, _ = cloudinary_url(
        public_id,
        secure=True,
        transformation=[
            {"width": 400, "height": 400, "crop": "fill", "gravity": "auto"},
            {"fetch_format": "auto", "quality": "auto"},
        ],
    )

    medium_url, _ = cloudinary_url(
        public_id,
        secure=True,
        transformation=[
            {"width": 800, "height": 1000, "crop": "fill", "gravity": "auto"},
            {"fetch_format": "auto", "quality": "auto"},
        ],
    )

    large_url, _ = cloudinary_url(
        public_id,
        secure=True,
        transformation=[
            {"width": 1400, "height": 1400, "crop": "limit"},
            {"fetch_format": "auto", "quality": "auto"},
        ],
    )

    return {
        "url": secure_url,
        "thumbnailUrl": thumb_url,
        "mediumUrl": medium_url,
        "largeUrl": large_url,
        "publicId": public_id,
    }


# ==================== WIRE-UP / MIDDLEWARE ====================

app.include_router(api_router)


def _parse_cors_origins(raw: str) -> List[str]:
    raw = (raw or "").strip()
    if not raw:
        return ["http://localhost:3000"]
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins if origins else ["http://localhost:3000"]


cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
cors_origins = _parse_cors_origins(cors_raw)

allow_credentials = True
if len(cors_origins) == 1 and cors_origins[0] == "*":
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_credentials,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()