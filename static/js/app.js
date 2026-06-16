/**
 * BigQuery Release Notes Hub - Main Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        updates: [],
        filteredUpdates: [],
        selectedUpdate: null,
        activeCategory: 'all',
        searchQuery: '',
        currentTemplateStyle: 'professional',
        lastSyncTime: null
    };

    // DOM Elements
    const elements = {
        btnRefresh: document.getElementById('btn-refresh'),
        connectionStatus: document.getElementById('connection-status'),
        statusLabel: document.querySelector('#connection-status .status-label'),
        
        // Stat counters
        statTotal: document.getElementById('stat-total'),
        statFeatures: document.getElementById('stat-features'),
        statChanges: document.getElementById('stat-changes'),
        statLastSync: document.getElementById('stat-last-sync'),
        
        // Search & Filter
        searchInput: document.getElementById('search-input'),
        searchClear: document.getElementById('search-clear'),
        filterCategories: document.getElementById('filter-categories'),
        
        // Category Badges in Sidebar
        badgeAll: document.getElementById('badge-all'),
        badgeFeature: document.getElementById('badge-feature'),
        badgeChange: document.getElementById('badge-change'),
        badgeAnnouncement: document.getElementById('badge-announcement'),
        badgeDeprecation: document.getElementById('badge-deprecation'),
        badgeOther: document.getElementById('badge-other'),
        
        // Content Area
        errorBanner: document.getElementById('error-banner'),
        errorMessage: document.getElementById('error-message'),
        btnCloseError: document.getElementById('btn-close-error'),
        feedTitle: document.getElementById('feed-title'),
        feedCountLabel: document.getElementById('feed-count-label'),
        releasesContainer: document.getElementById('release-notes-container'),
        
        // Tweet Drawer
        tweetDrawer: document.getElementById('tweet-drawer'),
        drawerOverlay: document.getElementById('drawer-overlay'),
        btnCloseDrawer: document.getElementById('btn-close-drawer'),
        selectedNotePreview: document.getElementById('selected-note-preview'),
        tweetTextarea: document.getElementById('tweet-textarea'),
        charProgress: document.getElementById('char-progress'),
        charCount: document.getElementById('char-count'),
        templateButtons: document.querySelectorAll('.template-btn'),
        btnCopyTweet: document.getElementById('btn-copy-tweet'),
        btnTweetIntent: document.getElementById('btn-tweet-intent')
    };

    // Standard Categories list for mapping
    const MAIN_CATEGORIES = ['Feature', 'Change', 'Announcement', 'Deprecation'];

    /* ==========================================================================
       INITIALIZATION & DATA FETCHING
       ========================================================================== */
    
    // Fetch data on page load
    fetchReleases();

    // Event Listeners
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    elements.btnCloseError.addEventListener('click', () => {
        elements.errorBanner.style.display = 'none';
    });
    
    // Search input handlers
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        elements.searchClear.style.display = state.searchQuery ? 'block' : 'none';
        applyFilters();
    });

    elements.searchClear.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClear.style.display = 'none';
        elements.searchInput.focus();
        applyFilters();
    });

    // Category click handler
    elements.filterCategories.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;

        // Toggle active button
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        state.activeCategory = btn.dataset.type;
        applyFilters();
    });

    // Drawer closing actions
    elements.btnCloseDrawer.addEventListener('click', closeTweetDrawer);
    elements.drawerOverlay.addEventListener('click', closeTweetDrawer);

    // Textarea typing character counting
    elements.tweetTextarea.addEventListener('input', updateCharCount);

    // Template selection clicks
    elements.templateButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.templateButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentTemplateStyle = btn.dataset.style;
            populateTweetText();
        });
    });

    // Twitter Intent action
    elements.btnTweetIntent.addEventListener('click', postTweet);
    elements.btnCopyTweet.addEventListener('click', copyTweetText);

    /**
     * Fetch Release Notes from the Backend API
     */
    async function fetchReleases(forceRefresh = false) {
        setLoadingState(true);
        elements.errorBanner.style.display = 'none';

        try {
            const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                state.updates = result.data;
                state.lastSyncTime = result.last_fetched;
                
                // Show notification if fallback cache is used
                if (result.source === 'cache_fallback') {
                    showError(result.error || "Network error. Displaying cached version.");
                }
                
                setConnectionStatus('success', result.source === 'live' ? 'Live Feed Connected' : 'Displaying Cache');
            } else {
                throw new Error(result.error || "Unknown server error");
            }
        } catch (error) {
            console.error("Fetch error:", error);
            showError(`Failed to fetch release notes: ${error.message}`);
            setConnectionStatus('error', 'Offline / Connection Failed');
        } finally {
            setLoadingState(false);
            updateDashboard();
        }
    }

    /**
     * Update loading animations and buttons
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            elements.btnRefresh.classList.add('loading');
            elements.btnRefresh.disabled = true;
            setConnectionStatus('loading', 'Refreshing notes...');
            renderSkeletons();
        } else {
            elements.btnRefresh.classList.remove('loading');
            elements.btnRefresh.disabled = false;
        }
    }

    /**
     * Set header connection status badges
     */
    function setConnectionStatus(status, text) {
        elements.connectionStatus.className = `status-indicator ${status}`;
        elements.statusLabel.textContent = text;
    }

    /**
     * Show top alert banner
     */
    function showError(msg) {
        elements.errorMessage.textContent = msg;
        elements.errorBanner.style.display = 'flex';
        // Auto scroll to top to see error
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ==========================================================================
       DASHBOARD STATE & METRICS
       ========================================================================== */

    /**
     * Updates counters, filter metrics, sidebar badges, and triggers rendering
     */
    function updateDashboard() {
        // Calculate totals and categories
        const total = state.updates.length;
        const features = state.updates.filter(u => u.type === 'Feature').length;
        const changesAndAnnouncements = state.updates.filter(u => u.type === 'Change' || u.type === 'Announcement').length;
        
        // Update stats banner
        elements.statTotal.textContent = total;
        elements.statFeatures.textContent = features;
        elements.statChanges.textContent = changesAndAnnouncements;
        elements.statLastSync.textContent = formatTime(state.lastSyncTime);

        // Calculate sidebar counts
        const counts = {
            all: total,
            Feature: features,
            Change: state.updates.filter(u => u.type === 'Change').length,
            Announcement: state.updates.filter(u => u.type === 'Announcement').length,
            Deprecation: state.updates.filter(u => u.type === 'Deprecation').length,
            other: state.updates.filter(u => !MAIN_CATEGORIES.includes(u.type)).length
        };

        // Update badge DOM texts
        elements.badgeAll.textContent = counts.all;
        elements.badgeFeature.textContent = counts.Feature;
        elements.badgeChange.textContent = counts.Change;
        elements.badgeAnnouncement.textContent = counts.Announcement;
        elements.badgeDeprecation.textContent = counts.Deprecation;
        elements.badgeOther.textContent = counts.other;

        // Apply filters to filter list and render notes
        applyFilters();
    }

    /**
     * Helper: Format datetime string cleanly
     */
    function formatTime(timeStr) {
        if (!timeStr) return '--:--';
        try {
            // "2026-06-16 09:02:00" -> extract "09:02" or similar
            const dt = new Date(timeStr.replace(' ', 'T'));
            return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) {
            return timeStr;
        }
    }

    /* ==========================================================================
       FILTER & RENDER NOTES
       ========================================================================== */

    /**
     * Filter updates list by search query and category filters
     */
    function applyFilters() {
        let results = state.updates;

        // 1. Search Query filter (matches in title/type/content)
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            results = results.filter(u => 
                u.type.toLowerCase().includes(query) || 
                u.content.toLowerCase().includes(query) ||
                u.date.toLowerCase().includes(query)
            );
        }

        // 2. Category Filter
        if (state.activeCategory !== 'all') {
            if (state.activeCategory === 'other') {
                // Matches anything not in the standard MAIN_CATEGORIES
                results = results.filter(u => !MAIN_CATEGORIES.includes(u.type));
            } else {
                results = results.filter(u => u.type === state.activeCategory);
            }
        }

        state.filteredUpdates = results;
        
        // Update labels
        updateFeedTitleText();
        
        // Render
        renderReleases();
    }

    /**
     * Updates header label above stream showing count
     */
    function updateFeedTitleText() {
        let title = "All Release Notes";
        if (state.activeCategory !== 'all') {
            title = state.activeCategory === 'other' ? "Other Updates" : `${state.activeCategory} Notes`;
        }
        
        if (state.searchQuery) {
            title += ` matching "${state.searchQuery}"`;
        }
        
        elements.feedTitle.textContent = title;
        elements.feedCountLabel.textContent = `Showing ${state.filteredUpdates.length} of ${state.updates.length} updates`;
    }

    /**
     * Renders skeletons when loading
     */
    function renderSkeletons() {
        elements.releasesContainer.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    }

    /**
     * Render release note cards to container
     */
    function renderReleases() {
        if (state.filteredUpdates.length === 0) {
            elements.releasesContainer.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <h3>No release notes found</h3>
                    <p>Try clearing your keyword filters or selecting a different category.</p>
                </div>
            `;
            return;
        }

        elements.releasesContainer.innerHTML = '';
        
        state.filteredUpdates.forEach(update => {
            const card = document.createElement('div');
            card.className = 'update-card';
            card.dataset.id = update.id;
            
            // Check if this card is currently selected
            if (state.selectedUpdate && state.selectedUpdate.id === update.id) {
                card.classList.add('selected');
            }

            // Determine badge tag class name
            const badgeClass = MAIN_CATEGORIES.includes(update.type) 
                ? update.type.toLowerCase() 
                : 'other';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge-tag ${badgeClass}">${update.type}</span>
                        <span class="card-date">${update.date}</span>
                    </div>
                    <a href="${update.link}" target="_blank" class="btn-card-link" title="Open original release notes" onclick="event.stopPropagation();">
                        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
                    </a>
                </div>
                <div class="card-body">
                    ${update.content}
                </div>
                <div class="card-actions">
                    <button class="btn-card-tweet" aria-label="Compose tweet for this update">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet Update</span>
                    </button>
                </div>
            `;

            // Card click behavior (select card and open composer)
            card.addEventListener('click', () => {
                selectUpdate(update);
            });

            elements.releasesContainer.appendChild(card);
        });
    }

    /**
     * Select a specific release note and slide in the drawer
     */
    function selectUpdate(update) {
        state.selectedUpdate = update;
        
        // Re-render notes container to update selected class highlighting
        document.querySelectorAll('.update-card').forEach(card => {
            if (card.dataset.id === update.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Open Drawer
        openTweetDrawer();
    }

    /* ==========================================================================
       TWEET COMPOSER DRAWER
       ========================================================================== */

    /**
     * Slide open the side panel composer
     */
    function openTweetDrawer() {
        if (!state.selectedUpdate) return;
        
        // Populate preview box
        const badgeClass = MAIN_CATEGORIES.includes(state.selectedUpdate.type) 
            ? state.selectedUpdate.type.toLowerCase() 
            : 'other';

        elements.selectedNotePreview.innerHTML = `
            <div class="preview-meta">
                <span class="badge-tag ${badgeClass}">${state.selectedUpdate.type}</span>
                <span class="card-date">${state.selectedUpdate.date}</span>
            </div>
            <div class="card-body" style="font-size:12.5px; opacity:0.85;">
                ${state.selectedUpdate.content}
            </div>
        `;

        // Pre-fill textarea based on selected template style
        populateTweetText();

        // Slide drawer in
        elements.tweetDrawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden'; // Lock body scrolling
    }

    /**
     * Slide close the side panel composer
     */
    function closeTweetDrawer() {
        elements.tweetDrawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = ''; // Unlock scrolling
        
        // Clear selected state highlight
        state.selectedUpdate = null;
        document.querySelectorAll('.update-card').forEach(card => card.classList.remove('selected'));
    }

    /**
     * Strips HTML tags cleanly for tweet generation
     */
    function stripHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    /**
     * Generate pre-filled tweet drafts based on template selections
     */
    function populateTweetText() {
        if (!state.selectedUpdate) return;
        
        const update = state.selectedUpdate;
        const cleanDesc = stripHtml(update.content).replace(/\s+/g, ' ').trim();
        const date = update.date;
        const type = update.type;
        const link = update.link;

        // Twitter standard character limit: 280 characters.
        // Links count as 23 characters (t.co wrapper).
        // Let's truncate descriptions so they fit nicely with link and tags.
        // Tag space: " #BigQuery #GoogleCloud" = 23 chars.
        // Label space: "📢 BigQuery Update [Date]: Type\n\n" = approx 40-50 chars.
        // Thus, description max safe characters is ~180.
        const maxDescLength = 160;
        let shortDesc = cleanDesc;
        if (shortDesc.length > maxDescLength) {
            shortDesc = shortDesc.substring(0, maxDescLength - 3) + '...';
        }

        let draft = '';
        switch (state.currentTemplateStyle) {
            case 'excited':
                draft = `🚀 New BigQuery update (${date})!\n\n⚡ ${shortDesc}\n\nCheck details: ${link} #GoogleCloud #BigQuery`;
                break;
            case 'minimal':
                draft = `Google BigQuery ${type} (${date}):\n${shortDesc}\n${link}`;
                break;
            case 'professional':
            default:
                draft = `📢 BigQuery Update [${date}]: ${type}\n\n"${shortDesc}"\n\nRead details: ${link} #BigQuery #GoogleCloud`;
                break;
        }

        elements.tweetTextarea.value = draft;
        updateCharCount();
    }

    /**
     * Compute and animate X/Twitter character limits (280 characters)
     */
    function updateCharCount() {
        const text = elements.tweetTextarea.value;
        const maxChars = 280;
        
        // In twitter: URLs are wrapped in t.co (counts as 23 characters always)
        // Let's do a basic character calculation that replaces URLs with 23 characters for accuracy
        const urlRegex = /https?:\/\/[^\s]+/g;
        let computedLength = text.length;
        const urls = text.match(urlRegex) || [];
        
        urls.forEach(url => {
            computedLength = computedLength - url.length + 23;
        });

        const remaining = maxChars - computedLength;
        elements.charCount.textContent = remaining;

        // Radial progress wheel calculation
        // Circle circumference: 2 * PI * R (R=10) = 62.83
        const circleRadius = 10;
        const circumference = 2 * Math.PI * circleRadius;
        
        let percentage = Math.min(computedLength / maxChars, 1);
        let offset = circumference - (percentage * circumference);
        
        elements.charProgress.style.strokeDashoffset = offset;

        // Visual warnings near and over limits
        if (remaining < 0) {
            elements.charCount.className = 'char-count-text error';
            elements.charProgress.style.stroke = '#f4212e'; // Twitter red
            elements.btnTweetIntent.disabled = true;
            elements.btnTweetIntent.style.opacity = '0.5';
        } else if (remaining <= 20) {
            elements.charCount.className = 'char-count-text warn';
            elements.charProgress.style.stroke = '#ffd400'; // Twitter orange/yellow
            elements.btnTweetIntent.disabled = false;
            elements.btnTweetIntent.style.opacity = '1';
        } else {
            elements.charCount.className = 'char-count-text';
            elements.charProgress.style.stroke = '#1d9bf0'; // Twitter blue
            elements.btnTweetIntent.disabled = false;
            elements.btnTweetIntent.style.opacity = '1';
        }
    }

    /**
     * Opens Twitter Web Intent window to compose/publish
     */
    function postTweet() {
        const tweetText = elements.tweetTextarea.value;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(url, '_blank', 'width=550,height=420,toolbar=0,status=0');
    }

    /**
     * Copies tweet text to Clipboard and shows toast
     */
    function copyTweetText() {
        const tweetText = elements.tweetTextarea.value;
        navigator.clipboard.writeText(tweetText)
            .then(() => {
                showToast("Tweet copied to clipboard!");
            })
            .catch(err => {
                console.error("Copy failed:", err);
                showToast("Failed to copy text.");
            });
    }

    /**
     * Show a transient alert banner (toast)
     */
    function showToast(message) {
        // Find or create toast element
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast-msg';
            document.body.appendChild(toast);
        }
        
        toast.innerHTML = `
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m22 4-10 10.01-3-3"/></svg>
            <span>${message}</span>
        `;
        
        // Slide it up
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
