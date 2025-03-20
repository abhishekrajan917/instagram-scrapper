require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const app = express();
const port = process.env.PORT || 3000;
const fs = require('fs').promises;
const path = require('path');
const randomUseragent = require('random-useragent');

// Apply the stealth plugin to Puppeteer
puppeteerExtra.use(StealthPlugin());

// Cookies storage path
const COOKIES_PATH = path.join(__dirname, 'instagram-cookies.json');

// Set to false for debugging (will open a visible browser)
const HEADLESS_MODE = false; // Always use visible browser to avoid detection

// Max retry attempts for navigation
const MAX_RETRIES = 3;

// Default pause time between actions
const DEFAULT_PAUSE = 3000;

// Simple random delay function to make behavior more human-like
const randomDelay = (min, max) => new Promise(resolve => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  setTimeout(resolve, delay);
});

app.use(express.json());
app.use(express.static('public'));

// Helper function to load cookies if they exist
async function loadCookies() {
  try {
    const cookiesData = await fs.readFile(COOKIES_PATH, 'utf8');
    return JSON.parse(cookiesData);
  } catch (error) {
    console.log('No cookies file found or invalid JSON');
    return null;
  }
}

// Helper function to save cookies
async function saveCookies(cookies) {
  try {
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookies saved successfully');
  } catch (error) {
    console.log('Error saving cookies:', error.message);
  }
}

// Enhanced function to safely navigate to a page
async function safeNavigation(page, url, options = {}) {
  const defaultOptions = {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  };
  
  const navOptions = { ...defaultOptions, ...options };
  
  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, navOptions);
    
    // Wait to ensure content loads
    await randomDelay(3000, 5000);
    
    return true;
  } catch (error) {
    console.log(`Navigation error: ${error.message}`);
    
    // Try a simpler navigation approach for recovery
    try {
      console.log('Trying alternative navigation method...');
      await page.goto('about:blank');
      await randomDelay(1000, 2000);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(3000, 5000);
      
      return true;
    } catch (retryError) {
      console.log(`Alternative navigation also failed: ${retryError.message}`);
      return false;
    }
  }
}

// Enhanced function to scrape verified accounts from Instagram post
async function scrapeVerifiedAccounts(postUrl, useCredentials = true) {
  console.log(`Starting scrape for URL: ${postUrl}`);
  
  let browser = null;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Close any existing browser instance before retrying
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.log('Error closing browser:', e.message);
        }
      }
      
      // Use a random user agent each time
      const userAgent = randomUseragent.getRandom(ua => {
        return ua.browserName === 'Chrome' && parseFloat(ua.browserVersion) >= 80;
      }) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      console.log(`Using user agent: ${userAgent}`);
      
      // Launch puppeteer with stealth plugin
      browser = await puppeteerExtra.launch({
        headless: HEADLESS_MODE,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ],
        ignoreHTTPSErrors: true,
        defaultViewport: null
      });
      
      const page = await browser.newPage();
      
      // Load cookies if they exist
      const cookies = await loadCookies();
      if (cookies) {
        try {
          console.log('Restoring previous cookies...');
          await page.setCookie(...cookies);
        } catch (cookieError) {
          console.log('Error setting cookies:', cookieError.message);
        }
      }
      
      // Randomize viewport slightly for each session
      const width = 1280 + Math.floor(Math.random() * 100);
      const height = 800 + Math.floor(Math.random() * 100);
      await page.setViewport({ width, height });
      
      // Set user agent
      await page.setUserAgent(userAgent);
      
      // More extensive evasion techniques
      await page.evaluateOnNewDocument(() => {
        // Overwrite navigator properties to mask Puppeteer
        const newProto = navigator.__proto__;
        delete newProto.webdriver;
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => Array(3).fill().map((_, i) => ({
            name: `Plugin ${i}`,
            description: `Plugin ${i} description`,
            filename: `plugin-${i}.dll`,
            length: 1,
          })),
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // Fake permissions behavior
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // Lie about webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // Add fake touch support
        const touchSupport = {
          maxTouchPoints: 5,
          touchEvent: true,
          touchStart: true
        };
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => touchSupport.maxTouchPoints });
        
        // Trick iframe detection
        if (window.frameElement) {
          window.frameElement = null;
        }
      });
      
      // Enable console logs from the browser
      page.on('console', message => console.log(`Browser console: ${message.text()}`));
      
      // Handle dialog boxes like alerts automatically
      page.on('dialog', async dialog => {
        console.log(`Dialog appeared: ${dialog.message()}`);
        await dialog.dismiss();
      });
      
      // Add human-like behaviors: random mouse movements and scrolling
      await page.evaluateOnNewDocument(() => {
        // Simulate random mouse movements
        const originalMouseMove = window.MouseEvent.prototype.movementX;
        Object.defineProperty(MouseEvent.prototype, 'movementX', {
          get: () => Math.floor(Math.random() * 5)
        });
        Object.defineProperty(MouseEvent.prototype, 'movementY', {
          get: () => Math.floor(Math.random() * 5)
        });
      });
      
      try {
        // Login to Instagram if credentials are provided and useCredentials is true
        if (useCredentials && process.env.INSTAGRAM_USERNAME && process.env.INSTAGRAM_PASSWORD) {
          console.log('Attempting to login with provided credentials...');
          
          try {
            // Use a gentler navigation approach
            console.log('Navigating to Instagram home page...');
            if (!await safeNavigation(page, 'https://www.instagram.com/')) {
              throw new Error('Failed to navigate to Instagram home page');
            }
            
            // Random delay before clicking login
            await randomDelay(2000, 5000);
            
            // Find and click the login link if on home page
            const hasLoginButton = await page.evaluate(() => {
              const loginButtons = Array.from(document.querySelectorAll('a, button')).filter(el => 
                el.textContent.toLowerCase().includes('log in') || 
                el.textContent.toLowerCase().includes('login'));
              
              if (loginButtons.length > 0) {
                loginButtons[0].click();
                return true;
              }
              return false;
            });
            
            if (hasLoginButton) {
              console.log('Clicked login button on home page');
              await randomDelay(3000, 5000);
            } else {
              // If no login button, go directly to login page
              await page.goto('https://www.instagram.com/accounts/login/', { 
                waitUntil: 'domcontentloaded',
                timeout: 60000
              });
            }
            
            // Wait for the login form with a more relaxed approach
            const usernameSelector = 'input[name="username"]';
            console.log('Waiting for login form...');
            
            // Wait for username field using polling to be more resilient
            let usernameField = null;
            for (let i = 0; i < 10; i++) {
              usernameField = await page.$(usernameSelector);
              if (usernameField) break;
              await randomDelay(1000, 2000);
            }
            
            if (!usernameField) {
              throw new Error('Could not find username field');
            }
            
            // Type credentials with human-like delays between keystrokes
            console.log('Entering username...');
            await page.type(usernameSelector, process.env.INSTAGRAM_USERNAME, { delay: 100 + Math.random() * 100 });
            
            await randomDelay(500, 1500);
            
            console.log('Entering password...');
            await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD, { delay: 100 + Math.random() * 100 });
            
            await randomDelay(1000, 2000);
            
            // Click login button
            const loginButton = await page.$('button[type="submit"]');
            if (loginButton) {
              console.log('Clicking login button...');
              await Promise.all([
                loginButton.click(),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('Navigation timeout after login, continuing anyway'))
              ]);
            } else {
              console.log('Login button not found, trying alternative method');
              // Try to find and click using evaluation
              await page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const button of buttons) {
                  if (button.textContent.toLowerCase().includes('log in') || 
                      button.type === 'submit') {
                    button.click();
                    return;
                  }
                }
              });
              await page.waitForNavigation({ timeout: 60000 }).catch(e => console.log('Navigation timeout after login, continuing anyway'));
            }
            
            console.log('Successfully logged in to Instagram');
            
            // Save cookies after successful login
            try {
              const currentCookies = await page.cookies();
              await saveCookies(currentCookies);
              console.log('Saved cookies for future use');
            } catch (cookieError) {
              console.log('Error saving cookies:', cookieError.message);
            }
            
            // Random delay after login
            await randomDelay(3000, 6000);
            
            // Handle any "Save Login Info" or "Turn on Notifications" prompts
            await handlePrompts(page);
            
            // Take screenshot of logged in state for debugging
            await page.screenshot({ path: 'instagram-login.png', fullPage: false });
            
          } catch (loginError) {
            console.log('Error during login process:', loginError.message);
            console.log('Continuing without login...');
          }
        }
        
        console.log(`Navigating to ${postUrl}...`);
        
        let navigationSuccess = await safeNavigation(page, postUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });
        
        if (!navigationSuccess) {
          // If direct navigation fails, try going to Instagram home first then to the post
          console.log('Trying navigation via homepage...');
          await safeNavigation(page, 'https://www.instagram.com/');
          await randomDelay(3000, 5000);
          
          navigationSuccess = await safeNavigation(page, postUrl);
        }
        
        if (!navigationSuccess) {
          throw new Error('Failed to navigate to Instagram post after multiple attempts');
        }
        
        // Extract page title for debugging
        const pageTitle = await page.title();
        console.log(`Page title: ${pageTitle}`);
        
        // Check if we need to bypass any login prompts
        await handlePrompts(page);
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'instagram-debug.png', fullPage: true });
        
        // Try to find the comments section with various selectors
        const commentSectionSelectors = [
          'ul._a9z6._a9za', 
          'article section ul',
          'article div[role="presentation"] ul',
          'ul[class*="comment"]',
          'div[class*="comment"] ul',
          'div.x9f619'
        ];
        
        let foundSelector = null;
        
        for (const selector of commentSectionSelectors) {
          console.log(`Trying to find comments with selector: ${selector}`);
          const elementExists = await page.evaluate((sel) => !!document.querySelector(sel), selector);
          
          if (elementExists) {
            console.log(`Found comments section with selector: ${selector}`);
            foundSelector = selector;
            await page.waitForSelector(selector, { timeout: 5000 }).catch(e => console.log('Timeout waiting for selector, but proceeding anyway'));
            break;
          }
        }
        
        if (!foundSelector) {
          console.log('Could not find comments section with known selectors. Will try to proceed anyway.');
        }
        
        // Wait for comments to load
        await page.waitForSelector('article', { timeout: 5000 }).catch(e => console.log('Timeout waiting for article, but proceeding anyway'));
        
        // Improved comment loading - click "View more comments" or "Load more comments" buttons repeatedly
        console.log('Attempting to load all comments...');
        let lastCommentCount = 0;
        let currentCommentCount = 0;
        let loadAttempts = 0;
        
        do {
          lastCommentCount = currentCommentCount;
          
          // Try to find and click "View more comments" or "Load more comments" buttons
          await page.evaluate(() => {
            const viewMoreButtons = Array.from(document.querySelectorAll('button, span, div')).filter(el => {
              const text = el.textContent.toLowerCase();
              return text.includes('view more comments') || 
                     text.includes('load more comments') || 
                     text.includes('view all') || 
                     text.includes('show more');
            });
            
            viewMoreButtons.forEach(button => {
              if (button.click) button.click();
            });
            
            // Also scroll to bottom of comments section
            const commentsSection = document.querySelector('article section ul') || 
                                  document.querySelector('article div[role="presentation"] ul') ||
                                  document.querySelector('div[class*="comment"]');
                                  
            if (commentsSection) {
              commentsSection.scrollTop = commentsSection.scrollHeight;
            } else {
              window.scrollBy(0, 500); // Fallback to main page scroll
            }
          });
          
          // Wait for new comments to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get current comment count
          currentCommentCount = await page.evaluate(() => {
            const commentElements = document.querySelectorAll('ul li');
            return commentElements.length;
          });
          
          console.log(`Comments loaded: ${currentCommentCount} (previous: ${lastCommentCount})`);
          loadAttempts++;
          
          // Take a screenshot every few attempts for debugging
          if (loadAttempts % 3 === 0) {
            await page.screenshot({ path: `instagram-comments-${loadAttempts}.png`, fullPage: true });
          }
          
        } while (currentCommentCount > lastCommentCount && loadAttempts < 15);
        
        // Get post URL for validation
        const currentPostUrl = await page.evaluate(() => window.location.href);
        console.log(`Current post URL: ${currentPostUrl}`);
        
        // Extract all verified accounts using multiple techniques
        const verifiedAccounts = await page.evaluate((postUrl) => {
          console.log('Starting to search for verified accounts...');
          const accounts = [];
          
          // Helper function to extract username from elements
          function extractUsername(element) {
            // First try to get username from a link
            const usernameLink = element.querySelector('a[href^="/"]');
            
            if (!usernameLink) return null;
            
            // Try text content first
            let username = usernameLink.textContent.trim();
            
            // Remove @ if present
            if (username.startsWith('@')) {
              username = username.substring(1);
            }
            
            // If no text content, try href
            if (!username) {
              const href = usernameLink.getAttribute('href');
              if (href) {
                username = href.replace(/^\/|\/$|\/p\/.*/g, '');
              }
            }

            // Filter out common UI elements that are not usernames
            if (shouldFilterUsername(username)) {
              console.log(`Filtering out UI element: ${username}`);
              return null;
            }
            
            return username;
          }

          // Helper function to determine if a username should be filtered out
          function shouldFilterUsername(username) {
            if (!username) return true;
            
            // List of common UI elements that might be incorrectly identified as usernames
            const commonUIElements = [
              'login', 'log_in', 'log in', 'signin', 'sign_in', 'sign in',
              'likes', 'comments', 'explore', 'notifications', 'profile',
              'home', 'search', 'activity', 'saved', 'tagged', 'posts',
              'settings', 'privacy', 'security', 'help', 'about',
              'reels', 'story', 'stories', 'share', 'send', 'message',
              'instagram', 'facebook', 'download', 'app', 'store', 'google', 'play'
            ];
            
            // Convert to lowercase for case-insensitive comparison
            const lowerUsername = username.toLowerCase();
            
            // Check if it contains numbers with commas (like counts)
            if (/\d+,\d+/.test(username) || /\d+\.\d+/.test(username)) {
              return true;
            }
            
            // Check if it's a common UI element
            for (const element of commonUIElements) {
              if (lowerUsername.includes(element)) {
                return true;
              }
            }
            
            // Check if it's just numbers (like counts)
            if (/^\d+$/.test(username)) {
              return true;
            }
            
            // Check for extremely short usernames (likely not real)
            if (username.length < 2) {
              return true;
            }
            
            // Check for usernames that have spaces (likely not real)
            if (username.includes(' ')) {
              return true;
            }
            
            return false;
          }

          // Helper function to add a verified account with validation
          function addVerifiedAccount(username, method) {
            if (!username) return false;
            
            // Perform final validation
            if (shouldFilterUsername(username)) return false;
            
            // Make sure username follows Instagram's username rules
            // Instagram usernames can only contain letters, numbers, periods, and underscores
            if (!/^[a-zA-Z0-9._]+$/.test(username)) {
              console.log(`Filtering invalid username format: ${username}`);
              return false;
            }
            
            // Extra validation: Ensure the username appears in a comment, not in the page UI
            const isInComment = validateUsernameInComments(username);
            if (!isInComment) {
              console.log(`Filtering username not found in comments: ${username}`);
              return false;
            }
            
            if (!accounts.includes(username)) {
              console.log(`Found verified user (${method}): ${username}`);
              accounts.push(username);
              return true;
            }
            
            return false;
          }
          
          // Function to check if a username is actually in a comment and not in UI
          function validateUsernameInComments(username) {
            // Look for the username in actual comment sections
            const commentContainers = document.querySelectorAll([
              'ul[role="list"] li', // Common comment list items
              'div[role="button"]', // Comment containers
              'article section ul li', // Another common pattern
              'div.x78zum5' // Class that often wraps comments
            ].join(', '));
            
            for (const container of commentContainers) {
              // Skip elements with very small height (likely UI elements)
              if (container.clientHeight < 20) continue;
              
              const userLinks = container.querySelectorAll('a[href^="/"]');
              for (const link of userLinks) {
                // Check for username in link
                const href = link.getAttribute('href');
                const linkText = link.textContent.trim();
                const linkUsername = linkText.startsWith('@') ? linkText.substring(1) : linkText;
                
                if (linkUsername === username || 
                    (href && href === `/${username}/` || href === `/${username}`)) {
                  // Check that this link also has verified badge nearby
                  const hasVerifiedBadge = container.querySelector('svg[aria-label="Verified"]');
                  if (hasVerifiedBadge) {
                    return true;
                  }
                }
              }
            }
            return false; // Username not found in comments
          }
          
          // TECHNIQUE 1: Look for all SVGs with verified badge
          console.log('TECHNIQUE 1: Finding all verified SVGs');
          const verifiedSvgs = document.querySelectorAll('svg[aria-label="Verified"]');
          console.log(`Found ${verifiedSvgs.length} verified SVGs`);
          
          verifiedSvgs.forEach(svg => {
            try {
              // First check if this SVG is in a comment section
              const isInCommentSection = isElementInCommentSection(svg);
              if (!isInCommentSection) {
                console.log('Skipping verified SVG not in comment section');
                return;
              }
              
              // Start from the SVG and go up to find username
              let element = svg;
              let username = null;
              
              // Go up to 5 levels to find the username
              for (let i = 0; i < 5 && !username && element; i++) {
                // Try to extract username from this element
                username = extractUsername(element);
                
                // If found username, add it
                if (username) {
                  addVerifiedAccount(username, 'SVG method');
                  break;
                }
                
                // Move up to parent
                element = element.parentElement;
              }
            } catch (error) {
              console.log('Error processing verified SVG:', error);
            }
          });
          
          // Helper function to determine if an element is within a comment section
          function isElementInCommentSection(element) {
            // Check if element or parent is in a comment section
            let current = element;
            for (let i = 0; i < 10 && current; i++) {
              // Common attributes of comment sections
              if (current.getAttribute('role') === 'list' || 
                  current.getAttribute('role') === 'listitem') {
                return true;
              }
              
              // Classes often used for comment sections
              const className = current.className || '';
              if (typeof className === 'string' && 
                  (className.includes('comment') || 
                   className.includes('x78zum5') || 
                   className.includes('_a9zj'))) {
                return true;
              }
              
              current = current.parentElement;
            }
            return false;
          }
          
          // TECHNIQUE 2: Look for specific class structure from example
          console.log('TECHNIQUE 2: Searching for x9f619 class structure');
          const commentDivs = document.querySelectorAll(
            'div.x9f619, div[class*="xjbqb8w"], div.x1emribx, span.x1lliihq, span.xt0psk2'
          );
          
          console.log(`Found ${commentDivs.length} potential elements with x9f619 class structure`);
          
          commentDivs.forEach(div => {
            try {
              // Skip if not in comment section
              if (!isElementInCommentSection(div)) {
                return;
              }
              
              // Check if this div contains a verified badge
              const verifiedBadge = div.querySelector('svg[aria-label="Verified"]');
              
              if (verifiedBadge) {
                // Look for username in this div or parent divs
                let element = div;
                let username = null;
                
                for (let i = 0; i < 3 && !username && element; i++) {
                  username = extractUsername(element);
                  
                  if (username) {
                    addVerifiedAccount(username, 'class structure');
                    break;
                  }
                  
                  element = element.parentElement;
                }
              }
            } catch (error) {
              console.log('Error processing div element:', error);
            }
          });
          
          // TECHNIQUE 3: Look for specific structure with div.xjbqb8w > span > svg
          console.log('TECHNIQUE 3: Looking for specific nested structure');
          const spans = document.querySelectorAll('span.xt0psk2, span.x1i10hfl');
          
          console.log(`Found ${spans.length} span elements to check`);
          
          spans.forEach(span => {
            try {
              // Skip if not in comment section
              if (!isElementInCommentSection(span)) {
                return;
              }
              
              // First check if this span or its descendants have verified badge
              const hasVerifiedBadge = span.querySelector('svg[aria-label="Verified"]');
              
              // Then check if a sibling has verified badge
              const nextSpan = span.nextElementSibling;
              const siblingHasVerifiedBadge = nextSpan && nextSpan.querySelector('svg[aria-label="Verified"]');
              
              if (hasVerifiedBadge || siblingHasVerifiedBadge) {
                const username = extractUsername(span) || 
                               (span.parentElement && extractUsername(span.parentElement));
                
                if (username) {
                  addVerifiedAccount(username, 'nested structure');
                }
              }
            } catch (error) {
              console.log('Error processing span element:', error);
            }
          });
          
          // TECHNIQUE 4: Look for blue checkmark SVGs by fill color
          console.log('TECHNIQUE 4: Finding SVGs by blue fill color');
          const blueSvgs = Array.from(document.querySelectorAll('svg[fill="rgb(0, 149, 246)"]'));
          
          console.log(`Found ${blueSvgs.length} blue SVGs`);
          
          blueSvgs.forEach(svg => {
            try {
              // Skip if not in comment section
              if (!isElementInCommentSection(svg)) {
                return;
              }
              
              // First check if this is a verified badge
              const isVerifiedBadge = svg.getAttribute('aria-label') === 'Verified';
              
              if (isVerifiedBadge) {
                // Find the username by traversing up
                let element = svg;
                let username = null;
                
                // Go up to 5 levels
                for (let i = 0; i < 5 && !username && element; i++) {
                  username = extractUsername(element);
                  
                  if (username) {
                    addVerifiedAccount(username, 'blue SVG');
                    break;
                  }
                  
                  element = element.parentElement;
                }
              }
            } catch (error) {
              console.log('Error processing blue SVG:', error);
            }
          });
          
          // Final post-processing to ensure only valid usernames are returned
          const validAccounts = accounts.filter(username => !shouldFilterUsername(username));
          
          console.log(`Found ${validAccounts.length} verified accounts in comments`);
          return validAccounts;
        }, postUrl);
        
        await browser.close();
        return verifiedAccounts;
        
      } catch (error) {
        console.error(`Error attempt ${retries + 1}/${MAX_RETRIES}:`, error.message);
        
        // Screenshot the error state if possible
        try {
          if (page) {
            await page.screenshot({ path: `error-screenshot-${retries}.png`, fullPage: true });
            console.log(`Error screenshot saved to error-screenshot-${retries}.png`);
          }
        } catch (screenshotError) {
          console.log('Failed to take error screenshot:', screenshotError.message);
        }
        
        // Close browser before retry
        try {
          if (browser) await browser.close();
        } catch (closeError) {
          console.log('Error closing browser:', closeError.message);
        }
        
        retries++;
        
        // If we've reached max retries, throw the error
        if (retries >= MAX_RETRIES) {
          console.error('Max retry attempts reached. Scraping failed.');
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const backoffTime = Math.min(30000, 2000 * Math.pow(2, retries));
        console.log(`Waiting ${backoffTime}ms before retry ${retries + 1}...`);
        await new Promise(r => setTimeout(r, backoffTime));
      }
    } catch (error) {
      console.error('Error initializing browser:', error);
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      throw error;
    }
  }
}

// API endpoint to get verified accounts
app.post('/api/scrape', async (req, res, next) => {
  try {
    const { postUrl, useLogin, credentials } = req.body;
    
    // More thorough Instagram post URL validation
    const instagramPostRegex = /^https?:\/\/(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)\/?/;
    if (!postUrl || !instagramPostRegex.test(postUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Instagram post URL. Please provide a valid URL (e.g. https://www.instagram.com/p/CODE/).'
      });
    }
    
    // If user provided credentials, temporarily set them as environment variables
    let originalUsername, originalPassword;
    
    if (useLogin && credentials && credentials.username && credentials.password) {
      console.log(`Using provided credentials for user: ${credentials.username}`);
      
      // Store original env vars
      originalUsername = process.env.INSTAGRAM_USERNAME;
      originalPassword = process.env.INSTAGRAM_PASSWORD;
      
      // Set new credentials from request
      process.env.INSTAGRAM_USERNAME = credentials.username;
      process.env.INSTAGRAM_PASSWORD = credentials.password;
    }
    
    try {
      // Call the scraping function with useLogin parameter
      const verifiedAccounts = await scrapeVerifiedAccounts(postUrl, useLogin);
      
      return res.json({
        success: true,
        data: {
          url: postUrl,
          verifiedAccounts,
          count: verifiedAccounts.length
        }
      });
    } catch (innerError) {
      console.error('Error during scraping operation:', innerError);
      return res.status(500).json({
        success: false,
        error: 'Failed to scrape Instagram post: ' + innerError.message
      });
    } finally {
      // Restore original credentials if they were changed
      if (useLogin && credentials && credentials.username && credentials.password) {
        process.env.INSTAGRAM_USERNAME = originalUsername;
        process.env.INSTAGRAM_PASSWORD = originalPassword;
      }
    }
    
  } catch (error) {
    console.error('Server error:', error);
    // Use next() to pass to the error handler middleware instead of handling here
    next(error);
  }
});

// Add a simple diagnostic endpoint
app.get('/api/test', async (req, res) => {
  console.log("Running Instagram connectivity test");
  
  let browser = null;
  try {
    // Launch browser with stealth plugin
    browser = await puppeteerExtra.launch({
      headless: HEADLESS_MODE,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--window-size=1280,800'
      ],
      defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    // Set default user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Try to navigate to Instagram
    const success = await safeNavigation(page, 'https://www.instagram.com/');
    
    if (!success) {
      throw new Error('Could not navigate to Instagram');
    }
    
    // Wait and take screenshot for debugging
    await page.screenshot({ path: 'instagram-test.png', fullPage: false });
    
    // Check if we're actually on Instagram
    const title = await page.title();
    const url = page.url();
    
    // Check for signs of being blocked
    const isBlocked = await page.evaluate(() => {
      return document.body.textContent.includes('suspicious activity') || 
             document.body.textContent.includes('unusual traffic');
    });
    
    // Close browser
    await browser.close();
    
    return res.json({
      success: true,
      status: {
        title,
        url,
        isBlocked,
        timestamp: new Date().toISOString()
      },
      message: isBlocked ? 'Instagram is blocking access - try again later' : 'Connection to Instagram successful'
    });
  } catch (error) {
    console.error('Test error:', error);
    
    // Ensure browser is closed
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log('Error closing browser during test:', e.message);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to connect to Instagram'
    });
  }
});

// Add error handler middleware to catch any server errors
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({
    success: false,
    error: 'Server error: ' + (err.message || 'Unknown error')
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Instagram scraper server is running on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
});

// Helper function to handle common Instagram prompts
async function handlePrompts(page) {
  try {
    // Look for common prompts and close them
    await page.evaluate(() => {
      const closeSelectors = [
        // Buttons containing these texts will be clicked to dismiss prompts
        'Not Now', 'Cancel', 'Skip', 'Close', 
        'Not now', 'No, thanks', 'Later'
      ];
      
      for (const text of closeSelectors) {
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'))
          .filter(el => el.textContent.includes(text));
        
        for (const button of buttons) {
          console.log(`Clicking button: ${button.textContent.trim()}`);
          button.click();
        }
      }
    });
    
    // Wait a bit after handling prompts
    await randomDelay(1000, 2000);
  } catch (e) {
    console.log('Error handling prompts:', e);
  }
} 