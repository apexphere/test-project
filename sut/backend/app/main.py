from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.database import init_db
from app.api.routes import products, cart, orders

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup and fetch auth public key."""
    print("Initializing database...")
    init_db()
    print("Database initialized!")

    # Pre-fetch the JWT public key from the auth service so that the
    # first authenticated request doesn't pay the latency cost.
    try:
        from app.core.security import get_public_key
        get_public_key()
    except Exception as e:
        print(f"Warning: could not fetch JWT public key on startup: {e}")
        print("Will retry on first authenticated request.")

    yield


app = FastAPI(
    title=settings.app_name,
    description="A mini e-commerce API for testing automation",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "app": settings.app_name}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",  # TODO: actual check
        "redis": "connected",      # TODO: actual check
    }


# Include routers — auth is now handled by auth-service
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(cart.router, prefix="/api/cart", tags=["Cart"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders"])
