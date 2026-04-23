use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_secs(15 * 60); // 15 minutes
const MAX_ATTEMPTS: u32 = 10;
const SWEEP_INTERVAL: Duration = Duration::from_secs(5 * 60); // 5 minutes

struct Bucket {
    count: u32,
    reset_at: Instant,
}

pub struct RateLimiter {
    buckets: Mutex<HashMap<String, Bucket>>,
    last_sweep: Mutex<Instant>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            buckets: Mutex::new(HashMap::new()),
            last_sweep: Mutex::new(Instant::now()),
        }
    }

    /// Returns true if the IP is rate-limited.
    pub fn check(&self, ip: &str) -> bool {
        self.maybe_sweep();

        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();

        let bucket = buckets.entry(ip.to_string()).or_insert(Bucket {
            count: 0,
            reset_at: now + WINDOW,
        });

        if now >= bucket.reset_at {
            bucket.count = 1;
            bucket.reset_at = now + WINDOW;
            return false;
        }

        bucket.count += 1;
        bucket.count > MAX_ATTEMPTS
    }

    fn maybe_sweep(&self) {
        let mut last = self.last_sweep.lock().unwrap();
        if last.elapsed() < SWEEP_INTERVAL {
            return;
        }
        *last = Instant::now();
        drop(last);

        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();
        buckets.retain(|_, b| now < b.reset_at);
    }
}
