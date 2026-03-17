from pymongo import MongoClient

uri = "mongodb+srv://venniscc04_db_user:hKQo6mUQ5pek91DD@vennisvhack.vqlrwwh.mongodb.net/?retryWrites=true&w=majority&appName=VennisVHack"

client = MongoClient(uri)

db = client["fraud_system"]
collection = db["transactions"]

test_data = {
    "transaction_id": "TX1001",
    "amount": 500,
    "currency": "USD"
}

collection.insert_one(test_data)

print("Data inserted successfully")