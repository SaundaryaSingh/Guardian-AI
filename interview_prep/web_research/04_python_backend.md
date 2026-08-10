# Python Backend System Design Interview Questions (2024-2025)

Research compiled for someone with FastAPI, async architecture, and multiple integrations experience.

---

## 1. Common Python Backend Architecture Questions

### Q: What is FastAPI and why is it popular?
**Answer:** FastAPI is a modern Python web framework for building APIs using standard Python type hints. It handles request validation, response serialization, and automatic documentation generation.

**Key points:**
- Speed: One of the fastest Python frameworks, comparable to Node.js and Go
- Type hints: Python annotations become validation, docs, and IDE autocomplete
- Async support: Built-in async/await support
- Auto-generated API docs at `/docs` (Swagger) and `/redoc`

### Q: What are the key architectural components of a Python backend system?
**Key components:**
- **Web Framework**: FastAPI, Flask, Django
- **ASGI Server**: Uvicorn, Hypercorn
- **Process Manager**: Gunicorn with Uvicorn workers
- **Database**: PostgreSQL, MongoDB
- **Cache**: Redis, Memcached
- **Task Queue**: Celery, RQ, Dramatiq
- **Message Broker**: RabbitMQ, Redis, Kafka
- **Reverse Proxy**: Nginx, Traefik

### Q: Explain the GIL (Global Interpreter Lock) and its impact on Python backend systems
**Answer:** The GIL is a mutex that protects access to Python objects, preventing multiple threads from executing Python bytecode simultaneously.

**Impact:**
- CPU-bound tasks: Cannot use multiple cores in a single process
- I/O-bound tasks: Can still benefit from async/threading
- Solution for CPU-bound: Use multiprocessing or separate processes

---

## 2. FastAPI vs Flask Interview Questions

### Q: What are the key differences between FastAPI and Flask?

| Feature | FastAPI | Flask |
|---------|---------|-------|
| Async Support | Native async/await | Requires extensions (Flask-Async) |
| Request Validation | Automatic via Pydantic | Manual validation |
| API Documentation | Auto-generated (Swagger/ReDoc) | Manual (Flask-RESTX) |
| Type Hints | Built-in support | Limited |
| Performance | Higher (async) | Lower (sync) |
| Learning Curve | Steeper | Easier |
| Ecosystem | Newer, growing | Mature, extensive |

### Q: When would you choose Flask over FastAPI?
- **Flask when:** Building server-rendered HTML apps, need mature ecosystem, simple APIs, team knows Flask well
- **FastAPI when:** Building REST APIs, need async support, want auto-generated docs, performance-critical applications

### Q: How does FastAPI handle dependency injection?
```python
from fastapi import Depends

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/users")
def read_users(db: Session = Depends(get_db)):
    return db.query(User).all()
```

Dependencies can chain together, allowing composable authentication and permission checks.

---

## 3. Async Python Questions (asyncio, async/await)

### Q: What is the difference between async and sync endpoints?
**Sync endpoint:** Runs in a threadpool, FastAPI handles the thread management
```python
@app.get("/sync")
def sync_endpoint():
    return {"type": "sync"}
```

**Async endpoint:** Runs directly on the event loop
```python
@app.get("/async")
async def async_endpoint():
    return {"type": "async"}
```

**Key insight:** Async isn't automatically faster. It's faster for I/O-bound work, slower for CPU-bound work.

### Q: What is the event loop?
The event loop is a single-threaded loop that runs coroutines one at a time. It picks up whichever coroutine is ready, executes it until the next `await`, and moves on.

```python
import asyncio

async def main():
    await asyncio.gather(
        fetch_data(),
        process_data(),
        send_notification()
    )
```

### Q: What does `await` actually do?
`await` pauses the current coroutine until the awaited object is ready and gives control back to the event loop.

**Critical point:** `await` only helps if the awaited thing is also async. Awaiting a blocking function (like `requests.get`) blocks the event loop.

### Q: What happens when you use blocking operations in async code?
```python
@app.get("/bad")
async def bad_endpoint():
    time.sleep(5)  # BLOCKS THE EVENT LOOP!
    return {"status": "done"}
```

While this sleeps, no other async endpoints can run. Use `asyncio.sleep()` or run in threadpool with `asyncio.to_thread()`.

### Q: Concurrency vs Parallelism?
- **Concurrency:** Dealing with many things at once (event loop switching between coroutines)
- **Parallelism:** Doing many things at once (multiple CPU cores)

FastAPI handles concurrency via async. For parallelism, you need multiple worker processes.

### Q: When does async improve performance?
- Database queries with async driver (asyncpg, async SQLAlchemy)
- HTTP calls to external APIs (httpx.AsyncClient)
- File I/O (aiofiles)
- Message queue operations

Does NOT help: CPU-heavy work like image processing, ML inference.

---

## 4. Python Design Patterns Asked in Interviews

### Q: What are the main categories of design patterns?
1. **Creational:** Singleton, Factory, Builder
2. **Structural:** Adapter, Decorator, Facade
3. **Behavioral:** Observer, Strategy, Command

### Q: Singleton Pattern
```python
class Logger:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

**Use cases:** Configuration managers, loggers, connection pools

### Q: Factory Pattern
```python
class PaymentFactory:
    @staticmethod
    def create(method: str):
        if method == "credit_card":
            return CreditCardPayment()
        elif method == "paypal":
            return PayPalPayment()
        raise ValueError(f"Unknown method: {method}")
```

### Q: Dependency Injection Pattern (used heavily in FastAPI)
```python
# Dependencies are injected automatically
def get_current_user(token: str = Depends(oauth2_scheme)):
    return decode_token(token)

@app.get("/users/me")
def read_users_me(user: User = Depends(get_current_user)):
    return user
```

### Q: Repository Pattern
```python
class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_id(self, user_id: int):
        return self.db.query(User).filter(User.id == user_id).first()
    
    def create(self, user_data: dict):
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        return user
```

### Q: Middleware Pattern
Used for cross-cutting concerns like logging, CORS, authentication:
```python
@app.middleware("http")
async def add_process_time_header(request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start)
    return response
```

---

## 5. API Design Questions (REST, GraphQL)

### Q: What REST principles does FastAPI encourage?
1. **Resource-based URLs:** `/users/{id}/orders` not `/getUserOrders?id=5`
2. **HTTP methods:** GET reads, POST creates, PUT updates, DELETE removes
3. **Statelessness:** Each request contains everything needed
4. **Consistent status codes:** 2xx success, 4xx client errors, 5xx server errors

### Q: Which HTTP status codes should you use?
- `200 OK`: Successful GET, PUT, PATCH
- `201 Created`: Successful POST that creates
- `204 No Content`: Successful DELETE with no body
- `400 Bad Request`: Malformed request
- `401 Unauthorized`: Invalid authentication
- `403 Forbidden`: Authenticated but not allowed
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Duplicate resource
- `422 Unprocessable Entity`: Validation failed (FastAPI default)
- `500 Internal Server Error`: Server-side error

### Q: How should you handle pagination?
**Offset-based:**
```python
@app.get("/items")
def read_items(skip: int = 0, limit: int = 20):
    return db.query(Item).offset(skip).limit(limit).all()
```

**Cursor-based:**
```python
@app.get("/items")
def read_items(cursor: str | None = None, limit: int = 20):
    return db.query_after(cursor, limit)
```

Use offset for admin dashboards, cursor for infinite scroll.

### Q: REST vs GraphQL - when to use which?

| Aspect | REST | GraphQL |
|--------|------|---------|
| Multiple endpoints | Yes | Single endpoint |
| Data fetching | Over/under-fetching | Exact data needed |
| Caching | HTTP caching built-in | Requires custom caching |
| Learning curve | Lower | Higher |
| File uploads | Native support | Requires workarounds |
| Real-time | WebSockets/SSE | Subscriptions |

### Q: API Versioning strategies
1. **URL versioning:** `/v1/users`, `/v2/users` (recommended, easiest)
2. **Header versioning:** `Accept-Version: v2`
3. **Query parameter:** `?version=2` (not recommended)

---

## 6. Database Design Questions (SQL, NoSQL)

### Q: When to use SQL vs NoSQL?

| Aspect | SQL | NoSQL |
|--------|-----|-------|
| Structure | Rigid schema | Flexible schema |
| Relationships | Strong support | Limited |
| Transactions | ACID compliant | Eventual consistency |
| Scaling | Vertical (bigger server) | Horizontal (more servers) |
| Examples | PostgreSQL, MySQL | MongoDB, Redis, DynamoDB |
| Use case | Complex queries, transactions | Large scale, flexible data |

### Q: Database connection pooling in FastAPI
```python
engine = create_engine(
    "postgresql://user:pass@localhost/db",
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
)
```

**Key parameters:**
- `pool_size`: Number of connections kept open
- `max_overflow`: Extra connections under burst load
- `pool_pre_ping`: Check if connection is alive

Total connections across all workers must stay under DB limit.

### Q: Database migrations with Alembic
```bash
alembic init alembic
alembic revision --autogenerate -m "add users table"
alembic upgrade head
```

**Interview tips:**
- Never edit applied migrations
- Always review auto-generated scripts
- Run migrations before starting the app, not at startup

### Q: N+1 query problem and solutions
```python
# Bad - N+1 queries
users = db.query(User).all()
for user in users:
    print(user.posts)  # Each access triggers a query

# Good - eager loading
users = db.query(User).options(joinedload(User.posts)).all()
```

### Q: Database indexing strategies
```sql
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

- Index frequently queried columns
- Composite indexes for multi-column queries
- Avoid over-indexing (slows writes)

---

## 7. Python Testing Questions

### Q: How do you structure FastAPI tests?
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_user():
    response = client.get("/users/1")
    assert response.status_code == 200
    assert response.json()["id"] == 1
```

### Q: Testing with dependencies
```python
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

def test_create_user():
    response = client.post("/users", json={"name": "Test"})
    assert response.status_code == 201
```

### Q: What makes a good test suite?
1. **Fast:** Tests run quickly
2. **Isolated:** Tests don't depend on each other
3. **Repeatable:** Same result every time
4. **Self-validating:** Clear pass/fail
5. **Timely:** Written alongside code

### Q: Test pyramid
- **Unit tests (70%):** Fast, test individual functions
- **Integration tests (20%):** Test component interactions
- **End-to-end tests (10%):** Test full user flows

### Q: Testing async endpoints
```python
import httpx
from httpx import ASGITransport

@pytest.mark.asyncio
async def test_async_endpoint():
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        response = await client.get("/async")
        assert response.status_code == 200
```

---

## 8. Python Performance Optimization Questions

### Q: What are common performance bottlenecks?
1. **Database queries:** N+1 queries, missing indexes, connection pool exhaustion
2. **Blocking I/O:** Using sync libraries in async endpoints
3. **Serialization:** Large Pydantic models, excessive fields
4. **Memory:** Large objects, memory leaks
5. **CPU-bound work:** In async context, image processing, ML inference

### Q: How do you optimize FastAPI performance?
1. **Use async for I/O:** Switch to async DB drivers and HTTP clients
2. **Reduce response models:** Keep them lean
3. **Cache expensive computations:** In-memory for hot data, Redis for shared
4. **Profile before optimizing:** Use `py-spy` or `austin`

### Q: Caching strategies
```python
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(param: str):
    # Expensive work here
    return result
```

**Caching layers:**
1. **In-process:** `functools.lru_cache` (fast, per-worker)
2. **Distributed:** Redis (shared across workers)
3. **HTTP:** Cache-Control headers (zero server cost)

### Q: Scaling a FastAPI application
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

**Scaling strategies:**
- **Vertical:** Bigger boxes with more CPU/RAM
- **Horizontal:** More instances behind load balancer
- **Worker count:** `2 * cpu_cores + 1`

**State moves to:**
- Sessions and rate limits → Redis
- Uploads → Object storage (S3)
- Background jobs → Celery/RQ

### Q: Performance monitoring
**Three types:**
1. **Logs:** Structured JSON with request ID, user ID, endpoint, status, latency
2. **Metrics:** Request rate, error rate, latency percentiles (p50, p95, p99)
3. **Traces:** Distributed tracing with OpenTelemetry

**Tools:** Prometheus, Grafana, ELK stack, Jaeger

---

## 9. Security Questions

### Q: How does OAuth2 work in FastAPI?
```python
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/me")
def read_me(token: str = Depends(oauth2_scheme)):
    return decode_token(token)
```

### Q: JWT Authentication
```python
import jwt

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=30)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

**Interview points:**
- JWTs are signed, not encrypted
- Keep expiry short (30 minutes)
- Don't store secrets in payload
- For revocation, use denylist in Redis

### Q: CORS Configuration
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

**Warning:** Never use `allow_origins=["*"]` with `allow_credentials=True`

---

## 10. Deployment Questions

### Q: What does a production FastAPI deployment look like?
```
DNS → Load Balancer → Containers (K8s/ECS)
                            ↓
                     Gunicorn + Uvicorn Workers
                            ↓
                     FastAPI App
                            ↓
              Database / Cache / External Services
```

### Q: How do you Dockerize FastAPI?
```dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker"]
```

### Q: Health check endpoints
```python
@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/ready")
def readiness_check():
    if db_connected() and cache_connected():
        return {"status": "ready"}
    return Response(status_code=503)
```

### Q: Graceful shutdown
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = load_model()
    yield
    app.state.model = None

app = FastAPI(lifespan=lifespan)
```

---

## 11. System Design Scenarios

### Q: Design a URL Shortener
**Components:**
- FastAPI endpoints for create/redirect
- Database for URL mappings
- Cache (Redis) for popular URLs
- Analytics for click tracking

**Key decisions:**
- Short URL generation: Base62 encoding of auto-increment ID
- Collision handling: Check uniqueness before saving
- Caching: Cache popular URLs, invalidate on write

### Q: Design a Rate Limiter
**Algorithms:**
1. **Token Bucket:** Allows bursts, refills at fixed rate
2. **Leaky Bucket:** Uniform rate, queues excess requests
3. **Fixed Window:** Limits per time interval
4. **Sliding Window:** More accurate, counts across windows

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/api")
@limiter.limit("100/minute")
def api_endpoint():
    return {"data": "value"}
```

### Q: Design a Background Task System
**Components:**
- FastAPI endpoints trigger tasks
- Celery with Redis/RabbitMQ as broker
- Workers process tasks
- Results stored in Redis/DB

```python
from celery import Celery

celery_app = Celery("tasks", broker="redis://localhost:6379")

@celery_app.task
def process_data(data_id):
    # Long-running task
    return result

@app.post("/process")
def trigger_process(data_id: int):
    task = process_data.delay(data_id)
    return {"task_id": task.id}
```

---

## 12. Quick Reference: Common Interview Answers

### "Tell me about your experience with FastAPI"
"I've built production APIs with FastAPI using async architecture. Key features I've leveraged include dependency injection for database sessions, Pydantic models for validation, and automatic OpenAPI documentation. I've integrated with multiple external services using async HTTP clients and implemented caching with Redis."

### "How do you handle errors in FastAPI?"
"I use HTTPException for expected errors in endpoints, and register custom exception handlers for application-wide error handling. I always return consistent error responses with appropriate status codes."

### "How do you test FastAPI applications?"
"I use pytest with TestClient for synchronous tests and httpx.AsyncClient for async tests. I override dependencies for test isolation and use fixtures for setup/teardown."

---

## Sources
- FastAPI Official Documentation (fastapi.tiangolo.com)
- DataCamp FastAPI Interview Questions
- Real Python FastAPI Tutorial
- Interview Kickstart System Design Questions
- Various technical interview preparation resources
