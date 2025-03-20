require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const port = process.env.PORT || 3000;

// Set to false for debugging (will open a visible browser)
const HEADLESS_MODE = false;

app.use(express.json());
app.use(express.static('public'));

// Enhanced function to scrape verified accounts from Instagram post
async function scrapeVerifiedAccounts(postUrl, useCredentials = true) {
  console.log(`Starting scrape for URL: ${postUrl}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewport({ width: 1280, height: 800 });
  
  // Enable console logs from the browser
  page.on('console', message => console.log(`Browser console: ${message.text()}`));
  
  try {
    // Login to Instagram if credentials are provided and useCredentials is true
    if (useCredentials && process.env.INSTAGRAM_USERNAME && process.env.INSTAGRAM_PASSWORD) {
      console.log('Attempting to login with provided credentials...');
      
      // Navigate to Instagram login page
      await page.goto('https://www.instagram.com/accounts/login/', { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Wait for the login form
      await page.waitForSelector('input[name="username"]', { timeout: 10000 });
      
      // Enter username and password
      await page.type('input[name="username"]', process.env.INSTAGRAM_USERNAME);
      await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD);
      
      // Click login button
      const loginButton = await page.$('button[type="submit"]');
      await loginButton.click();
      
      // Wait for navigation after login
      try {
        // Wait for navigation or homepage elements to appear
        await Promise.race([
          page.waitForNavigation({ timeout: 30000 }),
          page.waitForSelector('svg[aria-label="Home"]', { timeout: 30000 }),
          page.waitForSelector('[aria-label="Home"]', { timeout: 30000 })
        ]);
        
        console.log('Successfully logged in to Instagram');
        
        // Take screenshot of logged in state for debugging
        await page.screenshot({ path: 'instagram-login.png', fullPage: false });
        
        // Handle any "Save Login Info" or "Turn on Notifications" prompts
        const promptButtons = await page.$$('button');
        for (const button of promptButtons) {
          const buttonText = await page.evaluate(btn => btn.textContent, button);
          if (buttonText.includes('Not Now') || buttonText.includes('Skip')) {
            await button.click();
            console.log('Dismissed prompt:', buttonText);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.log('Error during login process:', error.message);
        console.log('Continuing anyway...');
      }
    }
    
    console.log(`Navigating to ${postUrl}...`);
    // Navigate to the Instagram post
    await page.goto(postUrl, { 
      waitUntil: 'networkidle2',
      timeout: 60000 // Increase timeout to 60 seconds
    });
    console.log('Page loaded successfully');
    
    // Extract page title for debugging
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Check if we need to bypass any login prompts
    const hasLoginPrompt = await page.evaluate(() => {
      return !!document.querySelector('button[type="button"]');
    });
    
    if (hasLoginPrompt) {
      console.log('Detected possible login prompt, attempting to bypass...');
      // Try to click outside or close button
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          if (button.textContent.includes('Not Now') || 
              button.textContent.includes('Close') || 
              button.textContent.includes('Cancel')) {
            button.click();
          }
        });
      });
      
      // Wait a bit for any prompts to close
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
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
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'instagram-debug.png', fullPage: true });
    console.log('Screenshot saved to instagram-debug.png for debugging');
    
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
    console.error('Error while scraping:', error);
    await browser.close();
    throw error;
  }
}

// API endpoint to get verified accounts
app.post('/api/scrape', async (req, res) => {
  try {
    const { postUrl, useLogin, credentials } = req.body;
    
    if (!postUrl || !postUrl.includes('instagram.com/p/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Instagram post URL. Please provide a valid URL.'
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
    } finally {
      // Restore original credentials if they were changed
      if (useLogin && credentials && credentials.username && credentials.password) {
        process.env.INSTAGRAM_USERNAME = originalUsername;
        process.env.INSTAGRAM_PASSWORD = originalPassword;
      }
    }
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to scrape Instagram post. ' + error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Instagram scraper server is running on port ${port}`);
  console.log(`Open http://localhost:${port} in your browser`);
}); 