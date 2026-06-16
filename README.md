# BigQuery Release Notes Hub 🚀

A modern, responsive web application built with **Python Flask** and **Vanilla HTML/CSS/JavaScript**. It fetches Google Cloud BigQuery's XML release notes feed, parses individual updates, and enables users to customize and share updates on X/Twitter.

## Features

- **Split Update Parsing**: Instead of displaying daily release blocks, the feed splits content by `<h3>` tags to isolate individual Features, Changes, Deprecations, and Announcements.
- **Client-Side Search & Filtering**: Instant, case-insensitive keyword searching and category filtering without repeated backend queries.
- **Live Sync & Refresh**: Refresh feed data with a rotating loader/spinner. If offline, the app handles errors gracefully and loads from an in-memory cache.
- **Stats Dashboard**: Metrics indicating the total count of features, changes, deprecations, and sync times.
- **Tweet Composer Slide-Out**:
  - A sliding side-drawer containing a Twitter-style preview card.
  - Multi-style templates (**Professional**, **Excited**, and **Minimal**) for drafting tweets.
  - Interactive circular SVG progress bar showing character limits (max 280 characters), turning orange and red near/over the limit.
  - Click-to-Tweet integrations via X/Twitter Web Intents.
  - Copy-to-clipboard functionality with a toast notification.
- **Rich Dark Aesthetics**: Premium glassmorphism design, clean Google Fonts typography (Outfit & Inter), and customized badge tag systems.

---

## File Structure

```text
bq-releases-notes/
├── app.py                  # Flask Web Server & Feed XML Parser
├── templates/
│   └── index.html          # Semantic HTML5 & Skeleton Layout
├── static/
│   ├── css/
│   │   └── styles.css      # CSS Variables, Animations, Glassmorphism, Responsive Styles
│   └── js/
│       └── app.js          # Client-Side MVC State, Filtering, Drawer Controls, and SVG Count Ring
└── venv/                   # Python Virtual Environment
```

---

## Installation & Setup

1. **Activate the Virtual Environment**:
   ```bash
   source venv/bin/activate
   ```

2. **Run the Flask Web App**:
   ```bash
   python app.py
   ```
   *By default, the server runs on `http://localhost:5001`.*

3. **Open in Browser**:
   Open [http://localhost:5001](http://localhost:5001) in your browser.
