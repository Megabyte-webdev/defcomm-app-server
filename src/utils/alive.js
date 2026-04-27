import https from "https";

export function keepAlive(url) {
  const interval = 14 * 60 * 1000; // 14 minutes (Render sleeps at 15)

  setInterval(() => {
    https
      .get(url, (res) => {
        if (res.statusCode === 200) {
          logger.info("Self-ping successful: App stayed awake.");
        }
      })
      .on("error", (err) => {
        logger.error("Error in self-ping:", err.message);
      });
  }, interval);
}
