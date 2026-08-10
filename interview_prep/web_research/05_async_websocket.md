# Async Architecture, WebSocket & Message Queue Interview Patterns

*Research compiled from 2024-2025 interview resources for candidates who built async message bus systems with multiple channel integrations.*

---

## Table of Contents

1. [Async vs Sync Architecture Trade-offs](#1-async-vs-sync-architecture-trade-offs)
2. [WebSocket Interview Questions](#2-websocket-interview-questions)
3. [Message Queue Patterns](#3-message-queue-patterns)
4. [Event-Driven Architecture Questions](#4-event-driven-architecture-questions)
5. [Real-Time Communication Patterns](#5-real-time-communication-patterns)
6. [Concurrency and Parallelism Questions](#6-concurrency-and-parallelism-questions)
7. [Python asyncio Patterns](#7-python-asyncio-patterns)
8. [Scalability Patterns for Async Systems](#8-scalability-patterns-for-async-systems)

---

## 1. Async vs Sync Architecture Trade-offs

### Core Questions

**Q: When should you use async vs sync architecture?**

| Factor | Sync | Async |
|--------|------|-------|
| **Latency** | Lower for single requests (no overhead) | Higher per-request but better throughput |
| **Throughput** | Limited by blocking operations | Higher - can handle many concurrent I/O ops |
| **Complexity** | Simpler to write and debug | More complex (callbacks, event loops, race conditions) |
| **Resource Usage** | One thread per request (thread exhaustion risk) | Single thread handles thousands of connections |
| **Error Handling** | Straightforward stack traces | Distributed tracing required, harder to debug |
| **Consistency** | Strong consistency easier | Eventual consistency is common |
| **Scaling** | Vertical scaling (more threads) | Horizontal scaling (more instances) |

**Q: What are the main benefits of async architecture?**

1. **Non-blocking I/O** - Thread doesn't wait for I/O operations
2. **Better resource utilization** - Single thread handles multiple connections
3. **Improved throughput** - Process more requests with fewer resources
4. **Responsiveness** - UI/server doesn't freeze during long operations
5. **Scalability** - Easier to scale horizontally

**Q: What are the downsides of async architecture?**

1. **Increased complexity** - Harder to reason about control flow
2. **Debugging difficulty** - Stack traces less meaningful, race conditions
3. **Callback hell** - Deeply nested callbacks (mitigated by async/await)
4. **Testing complexity** - Need specialized test frameworks
5. **Error propagation** - Errors harder to trace through async chains

**Q: Explain the blocking vs non-blocking I/O distinction.**

- **Blocking I/O**: Thread waits until operation completes (e.g., `socket.recv()`)
- **Non-blocking I/O**: Operation returns immediately, even if data isn't ready (returns EWOULDBLOCK)
- **Asynchronous I/O**: OS notifies program when operation completes (epoll, kqueue, io_uring)

---

## 2. WebSocket Interview Questions

### Core Concepts

**Q: What is WebSocket and how does it differ from HTTP?**

| Aspect | HTTP | WebSocket |
|--------|------|-----------|
| **Connection** | Request-response, stateless | Full-duplex, stateful |
| **Communication** | Unidirectional (client initiates) | Bidirectional (either side can send) |
| **Overhead** | Headers sent with every request | Minimal frames after handshake |
| **Use Case** | REST APIs, page loads | Real-time apps, streaming |
| **Protocol** | HTTP/1.1 or HTTP/2 | ws:// or wss:// (over TLS) |

**Q: How does the WebSocket handshake work?**

1. Client sends HTTP Upgrade request with `Upgrade: websocket` header
2. Server responds with `101 Switching Protocols`
3. Connection upgraded to WebSocket protocol
4. Bidirectional communication begins
5. Connection stays open until closed by either side

```
Client: GET /chat HTTP/1.1
        Host: server.example.com
        Upgrade: websocket
        Connection: Upgrade
        Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
        Sec-WebSocket-Protocol: chat, superchat

Server: HTTP/1.1 101 Switching Protocols
        Upgrade: websocket
        Connection: Upgrade
        Sec-WebSocket-Accept: HSmrc0sMlYUkAGmm5OPpG2HaGWk=
```

**Q: What are WebSocket frame types?**

- **Text frames** (0x01): UTF-8 text data
- **Binary frames** (0x02): Binary data
- **Ping/Pong** (0x09/0x0A): Keep-alive mechanism
- **Close** (0x08): Graceful connection termination

**Q: How do you handle WebSocket connection failures and reconnection?**

1. **Exponential backoff** - Wait 1s, 2s, 4s, 8s... between retries
2. **Jitter** - Add randomness to prevent thundering herd
3. **Heartbeat/Ping** - Detect dead connections
4. **Connection state tracking** - Store reconnect attempts
5. **Graceful degradation** - Fall back to polling if WebSocket fails

```python
async def connect_with_reconnect(url, max_retries=5):
    for attempt in range(max_retries):
        try:
            async with websockets.connect(url) as ws:
                yield ws
                return  # Connection succeeded
        except ConnectionClosed:
            wait_time = 2 ** attempt + random.uniform(0, 1)
            await asyncio.sleep(wait_time)
```

**Q: What security considerations exist for WebSockets?**

1. **Authentication** - Validate on connect and periodically
2. **Origin validation** - Check `Origin` header during handshake
3. **Rate limiting** - Prevent message flooding
4. **Input validation** - Sanitize all received messages
5. **Use WSS** - Always use TLS in production
6. **Cross-site WebSocket hijacking** - Validate origins

**Q: How do you scale WebSocket connections across multiple servers?**

- **Sticky sessions** - Route same client to same server
- **Pub/Sub middleware** - Redis Pub/Sub or NATS for cross-server messaging
- **Connection registry** - Store which server holds which connection
- **Load balancer** - Use L7 load balancer with WebSocket support

---

## 3. Message Queue Patterns

### 3.1 Core Patterns

**Q: What is the Producer-Consumer pattern?**

- **Producer**: Creates and sends messages to a queue
- **Queue**: Stores messages until consumed (FIFO buffer)
- **Consumer**: Retrieves and processes messages from queue
- **Benefits**: Decouples producers/consumers, handles load spikes

```python
# Producer-Consumer with asyncio.Queue
async def producer(queue):
    for i in range(10):
        await queue.put(f"message_{i}")
    await queue.put(None)  # Sentinel

async def consumer(queue):
    while True:
        msg = await queue.get()
        if msg is None:
            break
        await process(msg)
```

**Q: What is the Pub/Sub (Publish-Subscribe) pattern?**

- **Publisher**: Sends messages to topics/channels
- **Topics**: Named channels that categorize messages
- **Subscribers**: Subscribe to topics of interest
- **Broker**: Routes messages from publishers to subscribers
- **Key difference from queues**: Multiple subscribers receive each message

**Q: How does Competing Consumers pattern work?**

Multiple consumer instances read from a single queue. Each message is delivered to only ONE consumer:

- **RabbitMQ**: Uses prefetch count to limit unacknowledged messages
- **AWS SQS**: Uses visibility timeout - message hidden while being processed
- **Azure Service Bus**: Peek-lock mechanism locks message during processing

**Q: What is the Async Request-Response pattern?**

For request-response over message queues with multiple instances:

1. Requester generates unique **correlation ID**
2. Sends request message with correlation ID
3. Responder processes and sends response with same correlation ID
4. Requester uses correlation ID to match response to original request

**Why correlation ID instead of order ID?**
- Multiple requests possible for same order (retries, partial payments)
- Separates routing logic from business context
- Enables distributed tracing

### 3.2 Message Delivery Semantics

**Q: Explain at-most-once, at-least-once, and exactly-once delivery.**

| Semantic | Behavior | Use Case | Trade-off |
|----------|----------|----------|-----------|
| **At-most-once** | Message may be lost, never redelivered | Metrics, logging | Fastest, least reliable |
| **At-least-once** | Never lost, may be duplicated | Most applications | Consumer must be idempotent |
| **Exactly-once** | Processed exactly one time | Financial transactions | Most complex, requires transactions |

**Q: How do you implement idempotent consumers?**

```python
class IdempotentProcessor:
    def __init__(self):
        self.processed = set()  # Or use Redis/DB

    async def process(self, event_id, event_data):
        if event_id in self.processed:
            return  # Already processed
        # Process and record atomically
        await self.business_logic(event_data)
        self.processed.add(event_id)
```

**Key**: Check and record must be atomic (same transaction).

### 3.3 Dead Letter Queues

**Q: What is a Dead Letter Queue (DLQ) and when to use it?**

A DLQ stores messages that failed processing after max retries. Use when:

1. Message is malformed (poison pill)
2. Processing permanently fails
3. Message TTL expires
4. Max retry count exceeded

```python
async def process_with_dlq(message, max_retries=3):
    retry_count = message.get('retry_count', 0)
    try:
        await process(message)
        await acknowledge(message)
    except TransientError:
        if retry_count >= max_retries:
            await send_to_dlq(message)
        else:
            message['retry_count'] = retry_count + 1
            await requeue_with_delay(message, delay=2 ** retry_count)
    except PermanentError:
        await send_to_dlq(message)
```

### 3.4 Message Broker Comparison

**Q: Compare Kafka vs RabbitMQ.**

| Aspect | Kafka | RabbitMQ |
|--------|-------|----------|
| **Model** | Distributed log | Message queue |
| **Message retention** | Kept until TTL | Deleted after consumption |
| **Ordering** | Per partition | Per queue |
| **Throughput** | Very high (millions/sec) | High (thousands/sec) |
| **Consumers** | Multiple groups read same log | Competing consumers |
| **Use case** | Event streaming, data pipelines | Task queues, RPC |

**Q: When would you choose one over the other?**

- **Kafka**: Event sourcing, stream processing, data integration, replay capability
- **RabbitMQ**: Task distribution, RPC, complex routing, traditional message queuing

### 3.5 Schema Evolution

**Q: How do you handle schema evolution in event-driven systems?**

1. **Versioning** - Include version in event: `{version: 2, ...}`
2. **Schema Registry** - Central store for schema definitions
3. **Backward compatibility** - New schema reads old data (add optional fields)
4. **Forward compatibility** - Old schema reads new data (use defaults)
5. **Full compatibility** - Both directions work

**Tools**: Apache Avro, Protocol Buffers, JSON Schema with Schema Registry

---

## 4. Event-Driven Architecture Questions

### Core Concepts

**Q: What is Event-Driven Architecture (EDA)?**

A design pattern where components communicate through events (immutable facts about state changes) rather than direct calls. Components are loosely coupled and react to events asynchronously.

**Key components:**
- **Event Producer** - Generates events
- **Event Consumer** - Reacts to events
- **Event Broker/Bus** - Routes events between producers and consumers
- **Event Channel** - Pathway for event delivery

**Q: What is the difference between Event, Command, and Message?**

- **Event**: Notification that something *has happened* (immutable, past tense: `OrderPlaced`)
- **Command**: Request to perform an action (directed, intent: `PlaceOrder`)
- **Message**: Generic term for data unit sent over messaging system

**Q: What are the benefits of EDA?**

1. **Decoupling** - Producers/consumers don't know about each other
2. **Scalability** - Scale producers and consumers independently
3. **Resilience** - Failure of one consumer doesn't affect others
4. **Extensibility** - Add new consumers without changing existing code
5. **Real-time** - Immediate response to state changes

**Q: What is Eventual Consistency?**

A consistency model where all replicas will *eventually* converge to the same value if no new updates are made. Common in EDA because:

- Asynchronous event propagation introduces delays
- Different parts of system may see slightly different data temporarily
- Trade-off: Strong consistency vs High availability/Scalability

### Design Patterns

**Q: What is Event Sourcing?**

Store not just current state, but the full immutable sequence of events. Current state is derived by replaying events.

**Pros:**
- Complete audit log
- Temporal queries ("state at time T?")
- Can rebuild state from event log

**Cons:**
- Complex implementation
- Querying current state can be slow (mitigate with snapshots)
- Schema evolution challenges

**Q: What is CQRS (Command Query Responsibility Segregation)?**

Separates read and write models:

1. **Command** → Write side processes and updates primary store
2. **Events** → Emitted describing state changes
3. **Event handlers** → Update denormalized read models

**Benefits**: Write model optimized for consistency, read models optimized for queries.

**Q: What is the Saga Pattern?**

A failure management pattern for distributed transactions without distributed locks:

1. Sequence of local transactions
2. Each updates data and publishes event
3. If failure → execute compensating transactions to undo previous work

**Example**: `CreateOrder` succeeds, `ProcessPayment` fails → compensate by canceling order.

**Q: What is the Transactional Outbox Pattern?**

Solves the dual-write problem (DB commit + event publish must be atomic):

1. Write business data + events to "outbox" table in same transaction
2. Separate process monitors outbox table
3. Publishes events to message broker
4. Marks events as complete

### Event Types

**Q: Event Notification vs Event-Carried State Transfer?**

| Aspect | Notification | State Transfer |
|--------|-------------|----------------|
| **Payload** | Minimal (just ID) | Full data about change |
| **Consumer action** | Must call back to get details | Has all data needed |
| **Coupling** | Chatty, coupled | Decoupled |
| **Event size** | Small | Large |

---

## 5. Real-Time Communication Patterns

### Pattern Overview

**Q: What are the main real-time communication patterns?**

1. **WebSocket** - Full-duplex over single TCP connection
2. **Server-Sent Events (SSE)** - Server to client streaming over HTTP
3. **Long Polling** - Client polls, server holds connection until data available
4. **Short Polling** - Client repeatedly requests (simplest but least efficient)

### Comparison

| Pattern | Direction | Protocol | Complexity | Browser Support |
|---------|-----------|----------|------------|-----------------|
| WebSocket | Bidirectional | ws:// | High | All modern |
| SSE | Server→Client | HTTP | Low | All except IE |
| Long Polling | Client→Server | HTTP | Medium | Universal |
| Short Polling | Client→Server | HTTP | Very Low | Universal |

### WebSocket Specific

**Q: How do you handle WebSocket rooms/channels?**

```python
class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}
    
    async def join_room(self, room: str, ws: WebSocket):
        if room not in self.connections:
            self.connections[room] = set()
        self.connections[room].add(ws)
    
    async def broadcast(self, room: str, message: str):
        if room in self.connections:
            for ws in self.connections[room]:
                await ws.send_text(message)
```

**Q: How do you handle backpressure in WebSocket connections?**

- **Buffer management** - Limit outgoing message buffer size
- **Flow control** - Pause sending when buffer full
- **Message dropping** - Drop old messages when overwhelmed
- **Rate limiting** - Limit messages per second per client
- **Queue with bounds** - Bounded queues with overflow strategy

**Q: What is the Fan-out pattern?**

When one message needs to be sent to multiple consumers:

- **Pre-fanout**: Write to each consumer's queue at publish time
- **Post-fanout**: Single queue, broker copies to consumers
- **Trade-off**: Write amplification vs read amplification

---

## 6. Concurrency and Parallelism Questions

### Core Concepts

**Q: What is the difference between concurrency and parallelism?**

- **Concurrency**: Multiple tasks making progress (overlapping time periods)
- **Parallelism**: Multiple tasks executing simultaneously (requires multiple cores)

A single-threaded async program is concurrent but not parallel. Multiprocessing achieves parallelism.

**Q: What is the Global Interpreter Lock (GIL)?**

- Only one thread can execute Python bytecode at a time
- Prevents true parallelism for CPU-bound tasks in threads
- I/O-bound tasks release GIL during I/O waits (asyncio works around this)
- Multiprocessing avoids GIL by using separate processes

**Q: When to use threading vs multiprocessing vs asyncio?**

| Model | Best For | GIL Impact |
|-------|----------|------------|
| **Threading** | I/O-bound, external calls | Releases GIL during I/O |
| **Multiprocessing** | CPU-bound, heavy computation | Separate GIL per process |
| **asyncio** | High-concurrency I/O, many connections | Single thread, no GIL issue |

**Q: What is cooperative multitasking?**

Tasks voluntarily yield control at defined points (await). Contrast with preemptive multitasking where OS interrupts tasks. Asyncio uses cooperative multitasking.

### Synchronization Primitives

**Q: What are common concurrency primitives?**

- **Lock/Mutex** - Mutual exclusion for critical sections
- **Semaphore** - Limit concurrent access to N resources
- **Event** - Signal between threads/tasks
- **Queue** - Thread-safe producer-consumer
- **Condition** - Wait for specific condition

```python
# asyncio primitives
lock = asyncio.Lock()
semaphore = asyncio.Semaphore(10)  # Limit to 10 concurrent
event = asyncio.Event()
queue = asyncio.Queue(maxsize=100)
```

**Q: What is a race condition and how do you prevent it?**

When outcome depends on timing of uncontrollable events:

```python
# Race condition
counter = 0
async def increment():
    global counter
    temp = counter  # Read
    await some_io()  # Another task could change counter here
    counter = temp + 1  # Write stale value

# Fixed with lock
async def safe_increment():
    global counter
    async with lock:
        counter += 1
```

### Common Patterns

**Q: What is the Fan-out/Fan-in pattern?**

- **Fan-out**: Split work across multiple workers
- **Fan-in**: Collect results from multiple workers

```python
async def fan_out_fan_in(items, worker_fn, max_workers=10):
    semaphore = asyncio.Semaphore(max_workers)
    
    async def limited_worker(item):
        async with semaphore:
            return await worker_fn(item)
    
    tasks = [limited_worker(item) for item in items]
    return await asyncio.gather(*tasks)
```

**Q: What is the Circuit Breaker pattern?**

Prevents cascading failures when a service is down:

1. **Closed** - Normal operation, requests pass through
2. **Open** - Failures exceeded threshold, requests fail immediately
3. **Half-Open** - Allow test requests to check if service recovered

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, reset_timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.state = "closed"
        self.last_failure_time = None
    
    async def call(self, func, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = "half-open"
            else:
                raise CircuitOpenError()
        
        try:
            result = await func(*args, **kwargs)
            if self.state == "half-open":
                self.state = "closed"
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
            raise
```

---

## 7. Python asyncio Patterns

### Core asyncio Concepts

**Q: What are coroutines in Python?**

Coroutines are special functions that can pause execution and resume later. Defined with `async def`:

```python
async def fetch_data():
    await asyncio.sleep(1)  # Pauses, yields control to event loop
    return "data"

# Calling returns coroutine object (doesn't execute)
coro = fetch_data()
# Must be awaited or scheduled on event loop
result = await coro
# Or: asyncio.run(coro)
```

**Q: How does the asyncio event loop work?**

1. Event loop monitors coroutines
2. When a coroutine awaits (yields control), loop runs other coroutines
3. When awaited result is ready, loop resumes the coroutine
4. Single-threaded, cooperative multitasking

```python
import asyncio

async def main():
    # Schedule multiple coroutines concurrently
    results = await asyncio.gather(
        fetch_user(1),
        fetch_user(2),
        fetch_user(3),
    )

asyncio.run(main())  # Creates and runs event loop
```

**Q: What are Tasks vs Futures?**

- **Future**: Placeholder for a result not yet available
- **Task**: Subclass of Future, wraps a coroutine and schedules it on event loop

```python
# Task creation
task = asyncio.create_task(coro())  # Scheduled immediately
result = await task  # Get result

# gather returns list of results in order
results = await asyncio.gather(coro1(), coro2(), coro3())

# as_completed yields tasks as they finish
for coro in asyncio.as_completed([c1, c2, c3]):
    result = await coro
    print(f"Completed: {result}")
```

### Common Patterns

**Q: How do you implement producer-consumer with asyncio?**

```python
async def producer_consumer():
    queue = asyncio.Queue(maxsize=100)
    
    async def producer():
        for i in range(100):
            await queue.put(f"item_{i}")
        await queue.put(None)  # Sentinel
    
    async def consumer():
        while True:
            item = await queue.get()
            if item is None:
                break
            await process(item)
            queue.task_done()
    
    # Run producer and multiple consumers
    await asyncio.gather(
        producer(),
        consumer(),
        consumer(),
        consumer(),
    )
```

**Q: How do you handle exceptions in async code?**

```python
# Python 3.11+ ExceptionGroups
async def main():
    try:
        results = await asyncio.gather(
            risky_coro1(),
            risky_coro2(),
            return_exceptions=True,  # Returns exceptions as values
        )
    except* ValueError as eg:
        for exc in eg.exceptions:
            print(f"ValueError: {exc}")
    except* TypeError as eg:
        for exc in eg.exceptions:
            print(f"TypeError: {exc}")
```

**Q: How do you run blocking code in asyncio?**

```python
# Option 1: run_in_executor
async def main():
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,  # ThreadPoolExecutor
        blocking_function,
        arg1, arg2
    )

# Option 2: asyncio.to_thread (Python 3.9+)
async def main():
    result = await asyncio.to_thread(blocking_function, arg1)
```

**Q: What are async context managers and async iterators?**

```python
# Async context manager
class AsyncDB:
    async def __aenter__(self):
        self.conn = await create_connection()
        return self.conn
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.conn.close()

# Usage
async with AsyncDB() as conn:
    await conn.execute(query)

# Async iterator
async def fetch_pages(url):
    page = 1
    while True:
        data = await fetch(url, page)
        if not data:
            break
        yield data
        page += 1

async for page in fetch_pages(url):
    process(page)
```

### Performance Patterns

**Q: How do you implement connection pooling with asyncio?**

```python
class AsyncConnectionPool:
    def __init__(self, max_size=10):
        self.pool = asyncio.Queue(maxsize=max_size)
        self._initialized = False
    
    async def initialize(self):
        for _ in range(self.pool.maxsize):
            conn = await create_connection()
            await self.pool.put(conn)
        self._initialized = True
    
    @asynccontextmanager
    async def acquire(self):
        conn = await self.pool.get()
        try:
            yield conn
        finally:
            await self.pool.put(conn)
```

**Q: How do you implement rate limiting with asyncio?**

```python
class TokenBucket:
    def __init__(self, rate, capacity):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        async with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(
                self.capacity,
                self.tokens + elapsed * self.rate
            )
            self.last_refill = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
```

---

## 8. Scalability Patterns for Async Systems

### Horizontal Scaling

**Q: How do you scale async consumers horizontally?**

1. **Partitioning** - Split messages by key (user ID, order ID)
2. **Consumer groups** - Multiple consumers compete for messages
3. **Load balancing** - Distribute messages across consumers
4. **Auto-scaling** - Add consumers based on queue depth

```python
# Kafka consumer group example
from aiokafka import AIOKafkaConsumer

consumer = AIOKafkaConsumer(
    'orders',
    group_id='order-processors',
    bootstrap_servers='localhost:9092',
    enable_auto_commit=False,
)
```

**Q: How do you handle message ordering at scale?**

- **Partition by entity** - All events for same entity go to same partition
- **Sequence numbers** - Include order in message, reorder at consumer
- **Single partition** - Simplest but limits throughput

### Backpressure

**Q: What is backpressure and how do you implement it?**

Backpressure prevents system overload when producers are faster than consumers:

```python
class BoundedAsyncQueue:
    def __init__(self, maxsize=1000):
        self.queue = asyncio.Queue(maxsize=maxsize)
    
    async def put_with_backpressure(self, item):
        # This will block/await if queue is full
        await self.queue.put(item)
    
    async def get_or_timeout(self, timeout=1.0):
        try:
            return await asyncio.wait_for(
                self.queue.get(), timeout=timeout
            )
        except asyncio.TimeoutError:
            return None  # Handle slow consumer
```

**Strategies:**
- **Blocking put** - Producer waits when queue full
- **Drop oldest** - Remove oldest messages
- **Drop newest** - Reject new messages
- **Apply pressure back** - Signal producer to slow down

### Circuit Breakers and Resilience

**Q: How do you prevent cascading failures in async systems?**

1. **Circuit Breaker** - Stop calling failing service
2. **Bulkhead** - Isolate failures to specific components
3. **Timeout** - Set reasonable timeouts on all operations
4. **Retry with backoff** - Exponential backoff with jitter
5. **Fallback** - Provide degraded functionality when dependencies fail

```python
async def resilient_call(func, *args, 
                         max_retries=3, 
                         base_delay=1.0,
                         **kwargs):
    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            await asyncio.sleep(delay)
```

### Observability

**Q: What metrics are critical for async systems?**

1. **Consumer lag** - Messages produced vs consumed
2. **Queue depth** - Current number of messages in queue
3. **Processing latency** - Time from publish to process completion
4. **Throughput** - Messages per second (produce and consume)
5. **Error rate** - Failed message processing percentage
6. **DLQ size** - Messages in dead letter queue

**Q: How do you trace requests across async boundaries?**

Embed trace context in message metadata:

```python
import contextvars
import uuid

trace_id = contextvars.ContextVar('trace_id', default=None)

async def publish_event(event):
    event['trace_id'] = trace_id.get() or str(uuid.uuid4())
    await broker.publish(event)

async def consume_event(event):
    trace_id.set(event.get('trace_id'))
    # All downstream operations inherit trace_id
    await process(event)
```

### Event Ordering at Scale

**Q: How do you handle event ordering in distributed systems?**

1. **Partition by entity ID** - Ensures order per entity
2. **Vector clocks** - Track causal ordering
3. **Sequence numbers** - Include in events, reorder at consumer
4. **Design for idempotency** - Handle out-of-order gracefully

```python
class OrderedEventProcessor:
    def __init__(self):
        self.expected_seq = {}
        self.buffer = {}
    
    async def process(self, event):
        entity_id = event['entity_id']
        seq = event['sequence']
        
        if entity_id not in self.expected_seq:
            self.expected_seq[entity_id] = 0
        
        if seq == self.expected_seq[entity_id]:
            await self._handle(event)
            self.expected_seq[entity_id] += 1
            # Process any buffered events
            while entity_id in self.buffer:
                next_seq = self.expected_seq[entity_id]
                if next_seq in self.buffer[entity_id]:
                    await self._handle(self.buffer[entity_id].pop(next_seq))
                    self.expected_seq[entity_id] += 1
                else:
                    break
        else:
            self.buffer.setdefault(entity_id, {})[seq] = event
```

---

## Quick Reference: Common Interview Answers

### "Tell me about your async message bus system..."

**Structure your answer:**
1. **Problem** - Why async? (Multiple channel integrations, real-time requirements)
2. **Architecture** - Event-driven with pub/sub pattern
3. **Components** - Producers, consumers, message broker, channel adapters
4. **Challenges** - Ordering, idempotency, error handling
5. **Solutions** - DLQ, circuit breakers, correlation IDs, observability
6. **Results** - Throughput, latency improvements, reliability metrics

### Key Terms to Use

- Eventual consistency
- Idempotency
- Backpressure
- Dead Letter Queue
- Circuit Breaker
- Correlation ID
- Consumer lag
- Partitioning
- Schema evolution
- Compensating transactions

### Questions to Ask Interviewers

1. "How do you handle message ordering across partitions?"
2. "What's your approach to schema evolution?"
3. "How do you debug issues in distributed async systems?"
4. "What observability tools do you use for async systems?"
5. "How do you test event-driven systems?"

---

*Last updated: August 2025*
*Sources: System Design Codex, SecondTalent, CLIMB, GeeksforGeeks, Real Python, Index.dev, various interview preparation resources*
