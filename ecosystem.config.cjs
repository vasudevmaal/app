module.exports = {
  apps: [
    {
      name: "excpix",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      time: true,
      max_memory_restart: "768M",
      instances: 1,
      autorestart: true,
    },
  ],
};
