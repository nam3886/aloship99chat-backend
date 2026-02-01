/**
 * PM2 Ecosystem Configuration - Staging
 * Uses redis-staging and mysql-staging containers
 */

module.exports = {
  apps: [{
    name: 'ship99-api-staging',
    script: 'index.js',

    // Cluster mode - 2 workers for staging (less than production)
    instances: 2,
    exec_mode: 'cluster',

    // Auto-restart on failure
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',

    // Environment - Staging
    env: {
      NODE_ENV: 'staging',
      PORT: 3000,
      REDIS_HOST: 'redis-staging',
      REDIS_PORT: 6379
    },

    // Logging
    error_file: '/dev/null',
    out_file: '/dev/null',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true,

    // Load balancing
    instance_var: 'INSTANCE_ID',

    // Restart delay
    restart_delay: 1000,
    max_restarts: 10,

    // Wait for ready signal
    wait_ready: true
  }]
};
