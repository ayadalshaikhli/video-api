// actions/scrape.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import consola from "consola";

puppeteer.use(StealthPlugin());

export const scrapeContent = async (url) => {
    try {
        consola.info(`🔄 Scraping URL: ${url}`);
        const { connect } = await import("puppeteer-real-browser");
        const { browser, page } = await connect({
            headless: true,
            turnstile: true,
            customConfig: {},
            connectOption: {
                defaultViewport: null
            }
        });
        // Navigate to the URL
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for the page to load and be ready for scraping
        await page.waitForSelector('body', { timeout: 100000 });
        console.log("Page loaded successfully");
        // Extract content from the page body (you can change this as needed)
        const content = await page.evaluate(() => {
            const bodyContent = document.querySelector('main').innerText;
            return bodyContent;  // Return plain text, or modify to get specific elements like articles
        });
        console.log(content);
        console.log("Content extracted successfully");
        // Close the browser after scraping
        await browser.close();

        consola.success(`✅ Successfully scraped content from: ${url}`);

        return content;  // Returning the scraped content

    } catch (error) {
        consola.error(`❌ Error while scraping ${url}:`, error);
        throw error;
    }
};
