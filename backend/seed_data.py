import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Sample products data
sample_products = [
    {
        "id": "prod_001",
        "name": "Art Deco Diamond Pendant",
        "slug": "art-deco-diamond-pendant",
        "shortDescription": "Stunning geometric diamond pendant inspired by 1920s Parisian elegance",
        "longDescription": "This exquisite Art Deco diamond pendant features a geometric design that captures the essence of 1920s luxury. Handcrafted with precision, each diamond is carefully set to create a symmetrical masterpiece that reflects light beautifully.",
        "basePrice": 125000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Necklaces",
        "collections": ["featured", "new-arrivals"],
        "tags": ["diamond", "art-deco", "pendant", "luxury"],
        "images": [
            "https://images.unsplash.com/photo-1736436789706-005f2218a96d?w=800",
            "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800"
        ],
        "variants": [
            {"id": "var_001_1", "size": None, "color": "White Gold", "material": "18K White Gold", "stock": 3, "sku": "ADDP-WG-001", "priceAdjustment": 0},
            {"id": "var_001_2", "size": None, "color": "Yellow Gold", "material": "18K Yellow Gold", "stock": 2, "sku": "ADDP-YG-001", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": True,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "18K Gold, Diamonds",
        "weight": "8.5g",
        "dimensions": "25mm x 15mm",
        "careInstructions": "Clean with soft cloth. Avoid chemicals.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_002", "prod_003"],
        "bundleProductIds": [],
        "averageRating": 4.8,
        "reviewCount": 12,
        "viewCount": 245,
        "addToCartCount": 34,
        "totalPurchases": 18,
        "createdAt": "2026-01-01T10:00:00Z",
        "updatedAt": "2026-01-15T14:30:00Z"
    },
    {
        "id": "prod_002",
        "name": "Gatsby Pearl Drop Earrings",
        "slug": "gatsby-pearl-drop-earrings",
        "shortDescription": "Elegant pearl drop earrings with Art Deco geometric detailing",
        "longDescription": "These stunning pearl drop earrings embody the glamour of the Gatsby era. Featuring lustrous freshwater pearls suspended from intricate geometric gold settings, they add instant sophistication to any outfit.",
        "basePrice": 45000,
        "salePrice": 38000,
        "discountPercentage": 15.6,
        "category": "Earrings",
        "collections": ["featured"],
        "tags": ["pearl", "earrings", "gatsby", "elegant"],
        "images": [
            "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800",
            "https://images.unsplash.com/photo-1596944924591-4324bda675f5?w=800"
        ],
        "variants": [
            {"id": "var_002_1", "size": None, "color": "Gold", "material": "14K Gold", "stock": 8, "sku": "GPDE-G-002", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K Gold, Freshwater Pearls",
        "weight": "5.2g",
        "dimensions": "40mm drop",
        "careInstructions": "Store in soft pouch. Avoid water and perfume.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_001", "prod_005"],
        "bundleProductIds": [],
        "averageRating": 4.9,
        "reviewCount": 28,
        "viewCount": 412,
        "addToCartCount": 67,
        "totalPurchases": 42,
        "createdAt": "2026-01-02T11:00:00Z",
        "updatedAt": "2026-01-15T16:20:00Z"
    },
    {
        "id": "prod_003",
        "name": "Emerald Charm Tennis Bracelet",
        "slug": "emerald-charm-tennis-bracelet",
        "shortDescription": "Luxurious tennis bracelet featuring emerald charms and diamond accents",
        "longDescription": "This exceptional tennis bracelet combines classic elegance with Art Deco flair. Featuring alternating emerald charms and brilliant diamonds set in premium gold, it's a statement piece for special occasions.",
        "basePrice": 185000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Bracelets",
        "collections": ["luxury-collection"],
        "tags": ["emerald", "tennis-bracelet", "charms", "diamonds"],
        "images": [
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800",
            "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800"
        ],
        "variants": [
            {"id": "var_003_1", "size": "7 inches", "color": "Gold", "material": "18K Gold", "stock": 2, "sku": "ECTB-7-003", "priceAdjustment": 0},
            {"id": "var_003_2", "size": "7.5 inches", "color": "Gold", "material": "18K Gold", "stock": 1, "sku": "ECTB-7.5-003", "priceAdjustment": 2000}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": True,
        "isNewArrival": False,
        "allowPreorder": True,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "18K Gold, Emeralds, Diamonds",
        "weight": "12.8g",
        "dimensions": "7-7.5 inches length",
        "careInstructions": "Professional cleaning recommended. Avoid harsh chemicals.",
        "sizeGuideId": "bracelet_guide_001",
        "relatedProductIds": ["prod_001", "prod_007"],
        "bundleProductIds": [],
        "averageRating": 5.0,
        "reviewCount": 8,
        "viewCount": 189,
        "addToCartCount": 15,
        "totalPurchases": 9,
        "createdAt": "2026-01-03T09:30:00Z",
        "updatedAt": "2026-01-14T11:00:00Z"
    },
    {
        "id": "prod_004",
        "name": "Sapphire Stud Earrings",
        "slug": "sapphire-stud-earrings",
        "shortDescription": "Classic sapphire studs with brilliant cut diamonds",
        "longDescription": "Timeless elegance meets Art Deco sophistication in these sapphire stud earrings. Each deep blue sapphire is surrounded by a halo of brilliant cut diamonds, creating a stunning contrast.",
        "basePrice": 68000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Earrings",
        "collections": ["classic-collection"],
        "tags": ["sapphire", "studs", "diamonds", "classic"],
        "images": [
            "https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=800"
        ],
        "variants": [
            {"id": "var_004_1", "size": None, "color": "White Gold", "material": "14K White Gold", "stock": 6, "sku": "SSE-WG-004", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": True,
        "isNewArrival": False,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K White Gold, Sapphires, Diamonds",
        "weight": "3.8g",
        "dimensions": "6mm diameter",
        "careInstructions": "Clean with jewelry solution monthly.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_002", "prod_008"],
        "bundleProductIds": [],
        "averageRating": 4.7,
        "reviewCount": 22,
        "viewCount": 328,
        "addToCartCount": 54,
        "totalPurchases": 38,
        "createdAt": "2026-01-04T14:20:00Z",
        "updatedAt": "2026-01-15T09:45:00Z"
    },
    {
        "id": "prod_005",
        "name": "Rose Gold Chain Necklace",
        "slug": "rose-gold-chain-necklace",
        "shortDescription": "Delicate rose gold chain with Art Deco inspired links",
        "longDescription": "This beautiful rose gold chain features unique Art Deco inspired link design. Perfect for layering or wearing alone, it adds a touch of vintage glamour to any ensemble.",
        "basePrice": 32000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Necklaces",
        "collections": ["everyday-luxury"],
        "tags": ["rose-gold", "chain", "delicate", "layering"],
        "images": [
            "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800"
        ],
        "variants": [
            {"id": "var_005_1", "size": "16 inches", "color": "Rose Gold", "material": "14K Rose Gold", "stock": 12, "sku": "RGCN-16-005", "priceAdjustment": 0},
            {"id": "var_005_2", "size": "18 inches", "color": "Rose Gold", "material": "14K Rose Gold", "stock": 10, "sku": "RGCN-18-005", "priceAdjustment": 1500}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K Rose Gold",
        "weight": "4.5g",
        "dimensions": "16-18 inches",
        "careInstructions": "Wipe clean after wearing. Store separately.",
        "sizeGuideId": "necklace_guide_001",
        "relatedProductIds": ["prod_001", "prod_002"],
        "bundleProductIds": [],
        "averageRating": 4.6,
        "reviewCount": 15,
        "viewCount": 267,
        "addToCartCount": 42,
        "totalPurchases": 29,
        "createdAt": "2026-01-05T10:15:00Z",
        "updatedAt": "2026-01-14T15:30:00Z"
    },
    {
        "id": "prod_006",
        "name": "Ruby Heart Charm Bracelet",
        "slug": "ruby-heart-charm-bracelet",
        "shortDescription": "Romantic charm bracelet with ruby heart charms",
        "longDescription": "Express your love with this enchanting charm bracelet featuring ruby-adorned heart charms. Each charm is meticulously crafted with geometric Art Deco detailing and natural rubies.",
        "basePrice": 92000,
        "salePrice": 78000,
        "discountPercentage": 15.2,
        "category": "Bracelets",
        "collections": ["romantic-collection"],
        "tags": ["ruby", "heart", "charm-bracelet", "romantic"],
        "images": [
            "https://images.unsplash.com/photo-1588444650515-88018ca1e4b9?w=800"
        ],
        "variants": [
            {"id": "var_006_1", "size": "7 inches", "color": "Gold", "material": "18K Gold", "stock": 4, "sku": "RHCB-7-006", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "18K Gold, Rubies",
        "weight": "9.2g",
        "dimensions": "7 inches",
        "careInstructions": "Avoid contact with cosmetics. Clean gently.",
        "sizeGuideId": "bracelet_guide_001",
        "relatedProductIds": ["prod_003", "prod_010"],
        "bundleProductIds": [],
        "averageRating": 4.8,
        "reviewCount": 11,
        "viewCount": 198,
        "addToCartCount": 28,
        "totalPurchases": 16,
        "createdAt": "2026-01-06T12:00:00Z",
        "updatedAt": "2026-01-15T10:20:00Z"
    },
    {
        "id": "prod_007",
        "name": "Moonstone Drop Necklace",
        "slug": "moonstone-drop-necklace",
        "shortDescription": "Ethereal moonstone pendant on delicate gold chain",
        "longDescription": "This mystical moonstone drop necklace captures the magic of Art Deco design. The iridescent moonstone is set in an intricate geometric frame that showcases its natural beauty.",
        "basePrice": 56000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Necklaces",
        "collections": ["mystical-collection"],
        "tags": ["moonstone", "pendant", "drop", "mystical"],
        "images": [
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800"
        ],
        "variants": [
            {"id": "var_007_1", "size": None, "color": "Silver", "material": "Sterling Silver", "stock": 7, "sku": "MDN-S-007", "priceAdjustment": 0},
            {"id": "var_007_2", "size": None, "color": "Gold", "material": "14K Gold", "stock": 3, "sku": "MDN-G-007", "priceAdjustment": 15000}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "Sterling Silver / 14K Gold, Moonstone",
        "weight": "6.3g",
        "dimensions": "30mm drop",
        "careInstructions": "Keep away from moisture. Clean with soft cloth.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_001", "prod_005"],
        "bundleProductIds": [],
        "averageRating": 4.9,
        "reviewCount": 19,
        "viewCount": 312,
        "addToCartCount": 47,
        "totalPurchases": 31,
        "createdAt": "2026-01-07T09:45:00Z",
        "updatedAt": "2026-01-15T12:10:00Z"
    },
    {
        "id": "prod_008",
        "name": "Crystal Chandelier Earrings",
        "slug": "crystal-chandelier-earrings",
        "shortDescription": "Dramatic crystal chandelier earrings for special occasions",
        "longDescription": "Make a statement with these show-stopping crystal chandelier earrings. Featuring multiple tiers of geometric crystal arrangements, they capture the opulence of Art Deco ballrooms.",
        "basePrice": 74000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Earrings",
        "collections": ["statement-collection"],
        "tags": ["crystal", "chandelier", "statement", "dramatic"],
        "images": [
            "https://images.unsplash.com/photo-1630019852942-f89202989a59?w=800"
        ],
        "variants": [
            {"id": "var_008_1", "size": None, "color": "Silver", "material": "Rhodium Plated", "stock": 5, "sku": "CCE-RP-008", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": False,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "Rhodium Plated Metal, Crystals",
        "weight": "8.1g",
        "dimensions": "65mm drop",
        "careInstructions": "Store flat. Avoid bending.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_002", "prod_004"],
        "bundleProductIds": [],
        "averageRating": 4.5,
        "reviewCount": 7,
        "viewCount": 154,
        "addToCartCount": 19,
        "totalPurchases": 11,
        "createdAt": "2026-01-08T11:30:00Z",
        "updatedAt": "2026-01-14T16:45:00Z"
    },
    {
        "id": "prod_009",
        "name": "Topaz Geometric Bracelet",
        "slug": "topaz-geometric-bracelet",
        "shortDescription": "Modern geometric bracelet with blue topaz stones",
        "longDescription": "This contemporary Art Deco bracelet features stunning blue topaz stones set in bold geometric frames. The clean lines and symmetrical design make it a versatile piece for any wardrobe.",
        "basePrice": 118000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Bracelets",
        "collections": ["modern-deco"],
        "tags": ["topaz", "geometric", "modern", "blue"],
        "images": [
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800"
        ],
        "variants": [
            {"id": "var_009_1", "size": "7 inches", "color": "White Gold", "material": "14K White Gold", "stock": 3, "sku": "TGB-7-009", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": False,
        "allowPreorder": True,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K White Gold, Blue Topaz",
        "weight": "11.5g",
        "dimensions": "7 inches",
        "careInstructions": "Professional cleaning recommended annually.",
        "sizeGuideId": "bracelet_guide_001",
        "relatedProductIds": ["prod_003", "prod_006"],
        "bundleProductIds": [],
        "averageRating": 4.7,
        "reviewCount": 6,
        "viewCount": 142,
        "addToCartCount": 11,
        "totalPurchases": 7,
        "createdAt": "2026-01-09T14:00:00Z",
        "updatedAt": "2026-01-15T11:30:00Z"
    },
    {
        "id": "prod_010",
        "name": "Vintage Gold Locket",
        "slug": "vintage-gold-locket",
        "shortDescription": "Timeless gold locket with Art Deco engraving",
        "longDescription": "This exquisite vintage-inspired locket features intricate Art Deco engraving on both sides. Perfect for holding cherished photos, it comes on a matching gold chain.",
        "basePrice": 48000,
        "salePrice": 42000,
        "discountPercentage": 12.5,
        "category": "Necklaces",
        "collections": ["vintage-collection"],
        "tags": ["locket", "vintage", "engraved", "sentimental"],
        "images": [
            "https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800"
        ],
        "variants": [
            {"id": "var_010_1", "size": None, "color": "Gold", "material": "14K Gold", "stock": 9, "sku": "VGL-G-010", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": True,
        "isNewArrival": False,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K Gold",
        "weight": "7.8g",
        "dimensions": "25mm diameter",
        "careInstructions": "Polish gently with gold cloth.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_005", "prod_007"],
        "bundleProductIds": [],
        "averageRating": 4.9,
        "reviewCount": 24,
        "viewCount": 389,
        "addToCartCount": 61,
        "totalPurchases": 44,
        "createdAt": "2026-01-10T10:20:00Z",
        "updatedAt": "2026-01-15T13:45:00Z"
    },
    {
        "id": "prod_011",
        "name": "Amethyst Teardrop Earrings",
        "slug": "amethyst-teardrop-earrings",
        "shortDescription": "Elegant amethyst teardrop earrings in silver",
        "longDescription": "These graceful teardrop earrings feature deep purple amethyst stones in geometric Art Deco settings. The sterling silver framework enhances the natural beauty of the gemstones.",
        "basePrice": 38000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Earrings",
        "collections": ["gemstone-collection"],
        "tags": ["amethyst", "teardrop", "purple", "elegant"],
        "images": [
            "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800"
        ],
        "variants": [
            {"id": "var_011_1", "size": None, "color": "Silver", "material": "Sterling Silver", "stock": 11, "sku": "ATE-S-011", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "Sterling Silver, Amethyst",
        "weight": "4.2g",
        "dimensions": "35mm drop",
        "careInstructions": "Avoid harsh chemicals. Clean with silver polish.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_002", "prod_008"],
        "bundleProductIds": [],
        "averageRating": 4.6,
        "reviewCount": 13,
        "viewCount": 221,
        "addToCartCount": 35,
        "totalPurchases": 23,
        "createdAt": "2026-01-11T09:00:00Z",
        "updatedAt": "2026-01-14T14:15:00Z"
    },
    {
        "id": "prod_012",
        "name": "Diamond Infinity Bracelet",
        "slug": "diamond-infinity-bracelet",
        "shortDescription": "Delicate diamond infinity charm bracelet",
        "longDescription": "Symbolizing eternal love, this elegant bracelet features diamond-studded infinity charms linked together in Art Deco style. A meaningful gift for someone special.",
        "basePrice": 142000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Bracelets",
        "collections": ["romantic-collection", "luxury-collection"],
        "tags": ["diamond", "infinity", "romantic", "charms"],
        "images": [
            "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=800"
        ],
        "variants": [
            {"id": "var_012_1", "size": "7 inches", "color": "White Gold", "material": "18K White Gold", "stock": 2, "sku": "DIB-7-012", "priceAdjustment": 0},
            {"id": "var_012_2", "size": "7.5 inches", "color": "White Gold", "material": "18K White Gold", "stock": 1, "sku": "DIB-7.5-012", "priceAdjustment": 2500}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": True,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "18K White Gold, Diamonds",
        "weight": "10.2g",
        "dimensions": "7-7.5 inches",
        "careInstructions": "Professional cleaning twice yearly.",
        "sizeGuideId": "bracelet_guide_001",
        "relatedProductIds": ["prod_003", "prod_006"],
        "bundleProductIds": [],
        "averageRating": 5.0,
        "reviewCount": 5,
        "viewCount": 167,
        "addToCartCount": 14,
        "totalPurchases": 8,
        "createdAt": "2026-01-12T13:30:00Z",
        "updatedAt": "2026-01-15T15:00:00Z"
    },
    {
        "id": "prod_013",
        "name": "Citrine Statement Necklace",
        "slug": "citrine-statement-necklace",
        "shortDescription": "Bold citrine statement necklace with geometric design",
        "longDescription": "Make an entrance with this stunning citrine statement necklace. Multiple golden-yellow citrine stones are arranged in a bold geometric pattern that captures the Art Deco spirit.",
        "basePrice": 156000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Necklaces",
        "collections": ["statement-collection", "luxury-collection"],
        "tags": ["citrine", "statement", "bold", "yellow"],
        "images": [
            "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800"
        ],
        "variants": [
            {"id": "var_013_1", "size": None, "color": "Gold", "material": "18K Gold", "stock": 1, "sku": "CSN-G-013", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": True,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "18K Gold, Citrine",
        "weight": "24.6g",
        "dimensions": "18 inches",
        "careInstructions": "Store in protective case. Professional cleaning only.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_001", "prod_007"],
        "bundleProductIds": [],
        "averageRating": 4.8,
        "reviewCount": 4,
        "viewCount": 98,
        "addToCartCount": 7,
        "totalPurchases": 3,
        "createdAt": "2026-01-13T11:00:00Z",
        "updatedAt": "2026-01-15T09:20:00Z"
    },
    {
        "id": "prod_014",
        "name": "Pearl Hoop Earrings",
        "slug": "pearl-hoop-earrings",
        "shortDescription": "Classic pearl hoop earrings with Art Deco twist",
        "longDescription": "These sophisticated pearl hoop earrings combine classic elegance with Art Deco geometry. Freshwater pearls are set at intervals along gold hoops with geometric detailing.",
        "basePrice": 52000,
        "salePrice": 46000,
        "discountPercentage": 11.5,
        "category": "Earrings",
        "collections": ["classic-collection"],
        "tags": ["pearl", "hoops", "classic", "versatile"],
        "images": [
            "https://images.unsplash.com/photo-1596944924591-4324bda675f5?w=800"
        ],
        "variants": [
            {"id": "var_014_1", "size": "Small", "color": "Gold", "material": "14K Gold", "stock": 8, "sku": "PHE-S-014", "priceAdjustment": 0},
            {"id": "var_014_2", "size": "Medium", "color": "Gold", "material": "14K Gold", "stock": 6, "sku": "PHE-M-014", "priceAdjustment": 3000}
        ],
        "status": "active",
        "isFeatured": False,
        "isBestseller": True,
        "isNewArrival": False,
        "allowPreorder": False,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "14K Gold, Freshwater Pearls",
        "weight": "5.9g",
        "dimensions": "25mm / 35mm diameter",
        "careInstructions": "Wipe pearls after each wear. Avoid cosmetics.",
        "sizeGuideId": None,
        "relatedProductIds": ["prod_002", "prod_004"],
        "bundleProductIds": [],
        "averageRating": 4.7,
        "reviewCount": 17,
        "viewCount": 294,
        "addToCartCount": 48,
        "totalPurchases": 34,
        "createdAt": "2026-01-14T10:45:00Z",
        "updatedAt": "2026-01-15T14:00:00Z"
    },
    {
        "id": "prod_015",
        "name": "Onyx Art Deco Bracelet",
        "slug": "onyx-art-deco-bracelet",
        "shortDescription": "Striking onyx and diamond Art Deco bracelet",
        "longDescription": "This dramatic bracelet features alternating black onyx and diamond sections in true Art Deco style. The bold contrast creates a striking visual impact perfect for evening wear.",
        "basePrice": 198000,
        "salePrice": None,
        "discountPercentage": None,
        "category": "Bracelets",
        "collections": ["luxury-collection", "statement-collection"],
        "tags": ["onyx", "diamond", "art-deco", "dramatic"],
        "images": [
            "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800"
        ],
        "variants": [
            {"id": "var_015_1", "size": "7 inches", "color": "Platinum", "material": "Platinum", "stock": 1, "sku": "OADB-7-015", "priceAdjustment": 0}
        ],
        "status": "active",
        "isFeatured": True,
        "isBestseller": False,
        "isNewArrival": True,
        "allowPreorder": True,
        "giftWrapAvailable": True,
        "giftWrapCost": 500,
        "materials": "Platinum, Onyx, Diamonds",
        "weight": "18.4g",
        "dimensions": "7 inches",
        "careInstructions": "Professional cleaning only. Store in velvet pouch.",
        "sizeGuideId": "bracelet_guide_001",
        "relatedProductIds": ["prod_003", "prod_012"],
        "bundleProductIds": [],
        "averageRating": 5.0,
        "reviewCount": 3,
        "viewCount": 134,
        "addToCartCount": 9,
        "totalPurchases": 4,
        "createdAt": "2026-01-15T12:00:00Z",
        "updatedAt": "2026-01-15T16:30:00Z"
    }
]

# Sample collections
sample_collections = [
    {
        "id": "col_001",
        "name": "Featured Collection",
        "slug": "featured",
        "description": "Our handpicked selection of the finest Art Deco jewelry pieces",
        "featured": True,
        "heroImage": "https://images.unsplash.com/photo-1768528426138-eeeaa7f74414?w=1200",
        "displayOrder": 1,
        "productIds": ["prod_001", "prod_002", "prod_003", "prod_012", "prod_013", "prod_015"]
    },
    {
        "id": "col_002",
        "name": "New Arrivals",
        "slug": "new-arrivals",
        "description": "Latest additions to our luxury jewelry collection",
        "featured": True,
        "heroImage": "https://images.unsplash.com/photo-1736436789706-005f2218a96d?w=1200",
        "displayOrder": 2,
        "productIds": ["prod_001", "prod_002", "prod_005", "prod_006", "prod_007", "prod_011", "prod_012", "prod_013", "prod_015"]
    },
    {
        "id": "col_003",
        "name": "Luxury Collection",
        "slug": "luxury-collection",
        "description": "Premium pieces for the discerning collector",
        "featured": True,
        "heroImage": "https://images.unsplash.com/photo-1749318104909-ee768bac4d7e?w=1200",
        "displayOrder": 3,
        "productIds": ["prod_003", "prod_012", "prod_013", "prod_015"]
    }
]

# Sample settings
sample_settings = {
    "currencyRates": {
        "KES": 1.0,
        "USD": 0.0077,
        "EUR": 0.0071,
        "GBP": 0.0061
    },
    "currencyRatesUpdated": "2026-01-15T10:00:00Z",
    "shippingMethods": [
        {
            "id": "standard",
            "name": "Standard Delivery",
            "description": "3-5 business days",
            "cost": 500,
            "estimatedDays": "3-5"
        },
        {
            "id": "express",
            "name": "Express Delivery",
            "description": "1-2 business days",
            "cost": 1500,
            "estimatedDays": "1-2"
        },
        {
            "id": "overnight",
            "name": "Overnight Delivery",
            "description": "Next business day",
            "cost": 3000,
            "estimatedDays": "1"
        }
    ],
    "businessInfo": {
        "name": "Luxe Looks",
        "email": "info@luxelooks.ke",
        "phone": "+254 700 123 456",
        "address": "Westlands, Nairobi, Kenya",
        "supportEmail": "support@luxelooks.ke",
        "returnsPolicy": "30-day return policy on all items",
        "shippingPolicy": "Free shipping on orders over KES 100,000"
    },
    "inventoryThreshold": 5,
    "allowPreorders": True
}

async def seed_database():
    print("Starting database seed...")
    
    # Clear existing data
    await db.products.delete_many({})
    await db.collections.delete_many({})
    await db.settings.delete_many({})
    
    # Insert products
    await db.products.insert_many(sample_products)
    print(f"Inserted {len(sample_products)} products")
    
    # Insert collections
    await db.collections.insert_many(sample_collections)
    print(f"Inserted {len(sample_collections)} collections")
    
    # Insert settings
    await db.settings.insert_one(sample_settings)
    print("Inserted settings")
    
    print("Database seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_database())
    client.close()
