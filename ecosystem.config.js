/**
 * PM2 Ecosystem Configuration
 * Enables cluster mode for handling high concurrency (100 CCU)
 *
 * With Redis adapter, Socket.IO works across all workers
 */

module.exports = {
  apps: [{
    name: 'ship99-api',
    script: 'index.js',

    // Cluster mode - 4 workers for balanced performance
    instances: 4,
    exec_mode: 'cluster',

    // Auto-restart on failure
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      REDIS_HOST: 'redis',
      REDIS_PORT: 6379
    },

    // Logging - use /dev/null to avoid permission issues, logs go to docker logs
    error_file: '/dev/null',
    out_file: '/dev/null',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true,

    // Load balancing - round robin
    instance_var: 'INSTANCE_ID',

    // Restart delay to prevent rapid restarts
    restart_delay: 1000,

    // Max restarts before stopping
    max_restarts: 10,

    // Wait for ready signal
    wait_ready: true
  }]
};
