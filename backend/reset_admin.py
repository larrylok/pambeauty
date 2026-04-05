from motor.motor_asyncio import AsyncIOMotorClient
import hashlib
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

password = "test1234"
hash_value = hashlib.sha256(password.encode()).hexdigest()

async def main():
    await db.admin.update_one(
        {"key": "password"},
        {"$set": {"key": "password", "value": hash_value}},
        upsert=True
    )
    print("Admin password reset to:", password)

import asyncio
asyncio.run(main())
