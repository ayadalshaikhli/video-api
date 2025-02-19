# Use official Node.js image from Docker Hub
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install dependencies
RUN npm install

# Install FFmpeg (which includes ffprobe)
RUN apt-get update && apt-get install -y ffmpeg

# Copy all the application files
COPY . .

# Expose port 9324 (as requested)
EXPOSE 9324

# Set environment variables (you can modify this if necessary)
ENV PORT=9324

# Install dependencies for xvfb and Chrome (if needed)
RUN apt-get update && apt-get install -y \
    chromium \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxrandr2 \
    libxshmfence1 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Run xvfb (for virtual display) and the Node.js server
CMD ["npm", "start"]
