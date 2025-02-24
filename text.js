// test.js
import { handler } from './index.js';

const testEvent = {
  body: JSON.stringify({
    url: "https://example.com",
    text: "This is a test script.",
    captionId: "1",
    videoStyleId: "1",
    voiceId: "1"
  }),
  headers: {
    "Content-Type": "application/json"
  },
  requestContext: {
    identity: {
      sourceIp: "127.0.0.1"
    }
  },
  queryStringParameters: {}
};

handler(testEvent)
  .then((result) => {
    console.log("Lambda result:", result);
  })
  .catch((err) => {
    console.error("Error:", err);
  });
