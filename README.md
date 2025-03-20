# Instagram Verified Comments Scraper

A web application that scrapes verified account handles from Instagram post comments. This tool allows you to extract a list of all accounts with blue check marks (verified accounts) that have commented on a specific Instagram post.

## Features

- Extract verified account handles from Instagram post comments
- Simple and intuitive web interface
- Copy all extracted accounts to clipboard
- Responsive design using TailwindCSS

## Installation

1. Clone this repository:

```
git clone https://github.com/yourusername/instagram-scraper.git
cd instagram-scraper
```

2. Install dependencies:

```
npm install
```

> **Note:** This project uses Puppeteer v22.8.2 or later. Earlier versions (< 22.8.2) are deprecated and no longer supported.

3. Start the application:

```
npm start
```

4. Open your browser and navigate to:

```
http://localhost:3000
```

## Usage

1. Paste an Instagram post URL (e.g., `https://www.instagram.com/p/DHZE_7KR9Fh/`) into the input field
2. Click "Extract Verified Accounts"
3. Wait for the scraper to finish processing
4. View the list of verified accounts that commented on the post
5. Use the "Copy All" button to copy the list to your clipboard

## Notes

- Instagram may block automated access if the tool is used too frequently
- The scraper uses Puppeteer to navigate Instagram, which requires a browser to be installed on your system
- The scraper only extracts accounts with verified badges (blue check marks)
- Some Instagram posts may have hundreds of comments, and the scraper may not extract all of them in a single run

## Customization

You can modify the following files to customize the application:

- `index.js`: Backend server and scraping logic
- `public/index.html`: Frontend UI and interaction

## Troubleshooting

If you encounter any issues:

1. Make sure you have the latest version of Node.js installed
2. Try running the application with elevated privileges if Puppeteer fails to launch
3. Check that the Instagram post URL is valid and accessible without logging in
4. Instagram may change their HTML structure, requiring updates to the selectors in the scraping code

## License

MIT
