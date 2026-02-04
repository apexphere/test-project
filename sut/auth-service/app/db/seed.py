"""Seed the Auth Service database with sample users."""
from app.db.database import SessionLocal, init_db
from app.models.user import User
from app.core.security import hash_password


def seed_database():
    """Populate database with sample users."""
    db = SessionLocal()
    
    try:
        # Check if already seeded
        if db.query(User).first():
            print("Auth database already seeded.")
            return
        
        # Create admin user
        admin = User(
            email="admin@example.com",
            hashed_password=hash_password("admin123"),
            full_name="Admin User",
            is_admin=True,
        )
        db.add(admin)
        
        # Create test user
        user = User(
            email="user@example.com",
            hashed_password=hash_password("user123"),
            full_name="Test User",
        )
        db.add(user)
        
        db.commit()
        print("Auth database seeded successfully!")
        print("- Admin: admin@example.com / admin123")
        print("- User: user@example.com / user123")
        
    except Exception as e:
        print(f"Error seeding auth database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Initializing Auth database...")
    init_db()
    print("Seeding Auth database...")
    seed_database()
