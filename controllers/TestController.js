import { generateImageFromPrompt } from '../actions/image-generation.js'; // Import image generation
import { consola } from 'consola';

export const TestController = async (req, res) => {
  try {
    // Get the transcription data from the request body (only the text part)
    const { transcriptionData } = req.body;

    // Check if the transcription data is provided with required properties
    if (!transcriptionData || !transcriptionData.text) {
      return res.status(400).json({
        success: false,
        message: 'Valid transcription data with text is required',
      });
    }

    // Extract the summarized text from the request (summarized content)
    const summarizedContent = transcriptionData.text;

    // Split the summarized content into chunks (split by periods or adjust as needed)
    const summarizedContentChunks = summarizedContent.split(". ");  // Split by sentences, adjust as necessary

    let imageResults = [];

    // Generate an image for each chunk of summarized content
    for (const chunk of summarizedContentChunks) {
      consola.info("🚀 Sending chunk to Image Generation API...");
      const imageResult = await generateImageFromPrompt(chunk);  // Generate image for each chunk of summarized content
      imageResults.push(imageResult.image);  // Collect the image URLs
    }

    // Return the generated image URLs
    return res.json({
      success: true,
      message: "Images generated successfully!",
      data: {
        imageUrls: imageResults,  // Return an array of image URLs for each chunk
      },
    });

  } catch (error) {
    consola.error(`❌ Error in TestController: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
};
