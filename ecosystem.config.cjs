module.exports = {
  apps: [
    {
      name: "tauri-update-server",
      script: "./src/index.js",
      interpreter: "node",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_file: "./logs/pm2-combined.log",
      time: true,
      max_memory_restart: "500M",
      kill_timeout: 5000,
      listen_timeout: 3000,
      wait_ready: true,
      instance_var: "INSTANCE_ID",
    },
  ],
};
