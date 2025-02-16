import { consola } from 'consola';


export const retryFunction = async (func, retries = 3, delay = 1000) => {
    let attempt = 0;

    while (attempt < retries) {
        try {
            // Try to execute the function
            return await func();
        } catch (error) {
            attempt++;
            consola.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= retries) {
                throw new Error(`Failed after ${retries} attempts: ${error.message}`);
            }

            // Wait before retrying (exponential backoff)
            const backoffDelay = delay * 2 ** attempt; // Exponential backoff
            consola.info(`Retrying in ${backoffDelay} ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
    }
};
