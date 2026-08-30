# Architectural Scaling Notes — RushHour at 10x Scale

This project represents a single-node high-concurrency architecture. While it is perfect for localhost demos and single-instance applications, several components would break if we scaled the system to 10x throughput (e.g. 50,000 requests in 60s) or scaled out horizontally across multiple servers.

Here is a breakdown of what breaks and how to replace them at production scale.

---

## 1. Concurrency Locking: In-Process Mutex
* **Why it breaks**: The `checkoutMutex` is an in-memory Promise chain inside the Node.js process memory. As soon as we run multiple instances of the Next.js app (e.g., behind a load balancer or in serverless functions), different servers will have separate memory spaces. A request hitting Server A and a request hitting Server B can execute the critical check-and-reserve transaction concurrently, bypassing the lock and causing overselling.
* **Production-Scale Solution**: Replace the local Mutex with a **Distributed Lock Manager (DLM)**.
  - **Redis Redlock**: Use Redis to acquire a lock key (e.g. `lock:checkout`) with a short TTL before executing the database transaction.
  - **PostgreSQL Advisory Locks**: If using Postgres, run `pg_try_advisory_xact_lock()` inside the database transaction to serialize requests at the database engine level.

---

## 2. Database Engine: SQLite (Single-Writer Model)
* **Why it breaks**: SQLite is a file-based database. Although WAL (Write-Ahead Logging) mode allows concurrent readers, all write transactions must still acquire a shared database lock. SQLite can only handle one write operation at a time. Under extreme concurrent checkout volume across multiple threads/instances, requests will queue up waiting for SQLite file locks, leading to "Database is locked" exceptions or high latency timeouts.
* **Production-Scale Solution**: Migrate to a production-grade relational database like **PostgreSQL** or **MySQL**. For global scale, horizontal database partitions (sharding) or Spanner-style multi-writer databases are utilized to partition the inventory records and handle parallel write execution.

---

## 3. Rate Limiting: In-Memory Map
* **Why it breaks**: The rate limiting map resides in server memory. If we scale out to multiple containers:
  1. A buyer can bypass the rate limit by hitting different servers sequentially (since Server A doesn't know about requests handled by Server B).
  2. Memory usage grows linearly with the number of unique buyers, potentially causing memory exhaustion.
* **Production-Scale Solution**: Implement a centralized, distributed rate limiter.
  - **Redis Token Bucket/Sliding Window**: Store rate limit tokens in Redis. Every request runs a fast `eval` Lua script in Redis to check and decrement tokens in single-digit milliseconds.

---

## 4. Background Job Queue: setInterval Pollers
* **Why it breaks**: The loops are run in-process using Node `setInterval`. In a scaled system:
  1. Multiple servers running the same setInterval loop will pull the same pending Jobs simultaneously, leading to redundant work or database deadlocks.
  2. If the Next.js process restarts, active memory states (like in-flight payments) are lost, leaving jobs half-done.
* **Production-Scale Solution**: Adopt a dedicated, stateful queue service:
  - **BullMQ / Bee-Queue (Redis-backed)**: Provides atomic job locking, retries, and distributed worker execution.
  - **Message Brokers**: Use Amazon SQS, RabbitMQ, or Kafka to route and process payment messages with dead-letter queue (DLQ) recovery.
