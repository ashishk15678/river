const nextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/ws",
        destination: "http://localhost:3001/ws",
      },
    ];
  },
  server: {
    port: 3000,
  },
};

module.exports = nextConfig;
