import axios from "axios";
import { consola } from "consola";
import { retryFunction } from "../utils/utils.js";
import fs from "fs";
import dotenv from "dotenv";
import { Buffer } from "buffer";

dotenv.config();

export const whisperAudio = async (audioUrl, saveToFile = false, retryOnGaps = true) => {
  try {
    // Your Cloudflare API credentials.
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_KEY;
    
    // Test all available models
    const models = [
      { name: 'whisper', url: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/openai/whisper` },
      { name: 'whisper-large-v3-turbo', url: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/openai/whisper-large-v3-turbo` },
      { name: 'whisper-tiny-en', url: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/openai/whisper-tiny-en` },
      { name: 'deepgram-nova-3', url: `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/deepgram/nova-3` }
    ];
    
    consola.info("🧪 Testing all Whisper models for best transcription results...");
    
    // Fetch the audio file once
    const response = await axios.get(audioUrl, { responseType: "arraybuffer" });
    consola.info("✅ Audio file fetched.");
    consola.info("Audio file size:", response.data.byteLength, "bytes");
    consola.info("Audio URL:", audioUrl);
    
    const audioData = response.data;
    const results = {};
    
    // Test each model
    for (const model of models) {
      try {
        consola.info(`🔬 Testing model: ${model.name}`);
        
        let requestData;
        let headers = {
          Authorization: `Bearer ${cfApiToken}`,
        };
        
        if (model.name === 'deepgram-nova-3') {
          // Deepgram uses different format
          requestData = audioData;
          headers['Content-Type'] = 'audio/mpeg';
        } else if (model.name === 'whisper-large-v3-turbo') {
          // Large v3 turbo uses base64
          const base64 = Buffer.from(audioData, 'binary').toString('base64');
          requestData = { audio: base64 };
          headers['Content-Type'] = 'application/json';
        } else {
          // Standard whisper models use array format
          requestData = { audio: [...new Uint8Array(audioData)] };
          headers['Content-Type'] = 'application/json';
        }
        
        const modelResponse = await axios.post(model.url, requestData, { headers });
        
        if (modelResponse.status === 200) {
          const result = modelResponse.data;
          
          // Extract word-level timing for comparison
          let words = [];
          let text = '';
          let duration = 0;
          
          if (model.name === 'deepgram-nova-3') {
            // Deepgram format
            if (result.results?.channels?.[0]?.alternatives?.[0]) {
              const alt = result.results.channels[0].alternatives[0];
              text = alt.transcript || '';
              words = alt.words || [];
              duration = Math.max(...words.map(w => w.end || 0));
            }
          } else {
            // Whisper format
            text = result.text || '';
            words = result.words || [];
            duration = result.transcription_info?.duration || Math.max(...words.map(w => w.end || 0));
          }
          
          results[model.name] = {
            text,
            words,
            duration,
            wordCount: words.length,
            success: true,
            rawResult: result
          };
          
          consola.info(`✅ ${model.name}: ${words.length} words, ${duration.toFixed(2)}s duration`);
        } else {
          results[model.name] = {
            success: false,
            error: `HTTP ${modelResponse.status}`,
            wordCount: 0
          };
          consola.warn(`❌ ${model.name}: HTTP ${modelResponse.status}`);
        }
      } catch (error) {
        results[model.name] = {
          success: false,
          error: error.message,
          wordCount: 0
        };
        consola.warn(`❌ ${model.name}: ${error.message}`);
      }
    }
    
    // Find the best result (most words, least gaps)
    let bestModel = null;
    let bestScore = 0;
    
    for (const [modelName, result] of Object.entries(results)) {
      if (result.success && result.words.length > 0) {
        // Calculate score: word count + coverage (no large gaps)
        let score = result.wordCount;
        
        // Check for gaps
        let hasLargeGaps = false;
        for (let i = 0; i < result.words.length - 1; i++) {
          const current = result.words[i];
          const next = result.words[i + 1];
          const gap = next.start - current.end;
          if (gap > 2) {
            hasLargeGaps = true;
            score -= 10; // Penalty for large gaps
          }
        }
        
        if (!hasLargeGaps) {
          score += 20; // Bonus for no gaps
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestModel = modelName;
        }
      }
    }
    
    consola.info(`🏆 Best model: ${bestModel} (score: ${bestScore})`);
    
    // Return the best result in the expected format
    if (bestModel && results[bestModel].success) {
      const bestResult = results[bestModel];
      
      const transcriptionResult = {
        text: bestResult.text,
        wordCount: bestResult.wordCount,
        vtt: bestResult.rawResult.vtt || null,
        words: bestResult.words,
        success: true,
        errors: [],
        messages: [`Best result from ${bestModel} model`],
        modelUsed: bestModel,
        allResults: results // Include all results for debugging
      };
      
      consola.info("✅ Transcription completed successfully with best model.");
      
      // Optionally, save the complete transcription data to a file.
      if (saveToFile) {
        const fileData = {
          ...transcriptionResult,
          timestamp: new Date().toISOString(),
        };

        fs.writeFileSync(
          "./transcriptionResult.json",
          JSON.stringify(fileData, null, 2),
          "utf-8"
        );
        consola.info("✅ Transcription saved to 'transcriptionResult.json'.");
      }

      return transcriptionResult;
    } else {
      throw new Error('All models failed to transcribe audio');
    }
  } catch (error) {
    consola.error(
      `❌ Error in transcribing audio with Cloudflare Whisper: ${error.message}`
    );
    throw error;
  }
};
