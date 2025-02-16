# Use official Node.js image from Docker Hub
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all the application files
COPY . .

# Expose port 9469 (as requested)
EXPOSE 9324

# Set environment variables (you can modify this if necessary)
ENV PORT=9324

# Install dependencies for xvfb and Chrome
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path environment variable (needed for puppeteer and scraping)
ENV CHROME_PATH=/usr/bin/chromium

# Run xvfb (for virtual display) and the Node.js server
CMD ["xvfb-run", "node", "index.js"]
