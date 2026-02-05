"""Seed the database with sample data.

NOTE: Users are now managed by the auth-service. The backend only seeds
product/category data. User records are created automatically via
find-or-create when an authenticated user first interacts with the backend.
"""
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, init_db
from app.models.product import Product, Category


def seed_database():
    """Populate database with sample data."""
    db = SessionLocal()
    
    try:
        # Check if already seeded (use categories as indicator)
        if db.query(Category).first():
            print("Database already seeded.")
            return
        
        # Create categories
        categories = [
            Category(name="Electronics", description="Electronic devices and gadgets"),
            Category(name="Clothing", description="Apparel and accessories"),
            Category(name="Books", description="Books and literature"),
            Category(name="Home & Garden", description="Home improvement and garden supplies"),
        ]
        for cat in categories:
            db.add(cat)
        
        db.flush()
        
        # Create products
        products = [
            # Electronics
            Product(name="Wireless Headphones", description="High-quality bluetooth headphones with noise cancellation", price=99.99, stock=50, category_id=1),
            Product(name="Smart Watch", description="Fitness tracker with heart rate monitor", price=199.99, stock=30, category_id=1),
            Product(name="USB-C Hub", description="7-in-1 USB-C adapter for laptops", price=49.99, stock=100, category_id=1),
            Product(name="Portable Charger", description="20000mAh power bank with fast charging", price=39.99, stock=75, category_id=1),
            
            # Clothing
            Product(name="Classic T-Shirt", description="100% cotton comfortable fit t-shirt", price=19.99, stock=200, category_id=2),
            Product(name="Denim Jeans", description="Slim fit blue denim jeans", price=59.99, stock=80, category_id=2),
            Product(name="Running Shoes", description="Lightweight breathable running shoes", price=89.99, stock=60, category_id=2),
            Product(name="Winter Jacket", description="Warm waterproof winter jacket", price=149.99, stock=40, category_id=2),
            
            # Books
            Product(name="Python Programming", description="Learn Python from scratch", price=34.99, stock=150, category_id=3),
            Product(name="Web Development Guide", description="Complete guide to modern web development", price=44.99, stock=100, category_id=3),
            Product(name="Science Fiction Collection", description="Best sci-fi stories of the decade", price=24.99, stock=80, category_id=3),
            
            # Home & Garden
            Product(name="Indoor Plant Set", description="Set of 3 low-maintenance indoor plants", price=29.99, stock=45, category_id=4),
            Product(name="LED Desk Lamp", description="Adjustable brightness desk lamp", price=34.99, stock=90, category_id=4),
            Product(name="Garden Tool Set", description="5-piece essential garden tools", price=49.99, stock=55, category_id=4),
        ]
        
        for product in products:
            db.add(product)
        
        db.commit()
        print("Database seeded successfully!")
        print(f"- {len(categories)} categories created")
        print(f"- {len(products)} products created")
        print("Note: Users are now managed by auth-service.")
        print("Register via auth-service at /auth/register")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("Seeding database...")
    seed_database()
