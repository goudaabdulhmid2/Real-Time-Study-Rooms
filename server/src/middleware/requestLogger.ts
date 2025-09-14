import morgan, { StreamOptions } from "morgan";
import logger from "../config/logger";

// Create stream to redirect Morgan logs to winston
const stream: StreamOptions = {
    write: (message) => logger.http(message.trim())
};


// Morgan middleware (logs all HTTP requests)
const requestLogger = morgan(
    ":method :url :status :res[content-length] - :response-time ms",
    { stream }
)

export default requestLogger;