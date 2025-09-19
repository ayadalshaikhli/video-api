import { generateVideoScript, enhanceScriptWithContext } from '../actions/script-writer.js';
import { consola } from 'consola';

export const generateScript = async (req, res) => {
    try {
        consola.info('Script generation request received');
        console.log('Request body:', req.body);

        const { prompt, additionalKnowledge, language, duration } = req.body;

        // Validate required fields
        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Prompt is required' 
            });
        }

        // Validate duration if provided
        if (duration && (isNaN(duration) || duration < 10 || duration > 600)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Duration must be between 10 and 600 seconds' 
            });
        }

        // Call the action to generate the script
        const result = await generateVideoScript(
            prompt.trim(),
            additionalKnowledge?.trim() || null,
            language || 'en',
            parseInt(duration) || 60
        );

        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || 'Failed to generate script' 
            });
        }

        consola.success('Script generated successfully');
        res.json({
            success: true,
            script: result.script,
            metadata: result.metadata
        });

    } catch (error) {
        consola.error('Error in generateScript controller:', error);
        res.status(500).json({ 
            success: false, 
            error: 'An unexpected error occurred while generating the script' 
        });
    }
};

export const enhanceScript = async (req, res) => {
    try {
        consola.info('Script enhancement request received');
        console.log('Request body:', req.body);

        const { script, context } = req.body;

        // Validate required fields
        if (!script || !script.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Script is required' 
            });
        }

        if (!context || !context.trim()) {
            return res.status(400).json({ 
                success: false, 
                error: 'Context is required for enhancement' 
            });
        }

        // Call the action to enhance the script
        const result = await enhanceScriptWithContext(
            script.trim(),
            context.trim()
        );

        if (!result.success) {
            return res.status(500).json({ 
                success: false, 
                error: result.error || 'Failed to enhance script' 
            });
        }

        consola.success('Script enhanced successfully');
        res.json({
            success: true,
            script: result.script
        });

    } catch (error) {
        consola.error('Error in enhanceScript controller:', error);
        res.status(500).json({ 
            success: false, 
            error: 'An unexpected error occurred while enhancing the script' 
        });
    }
};
