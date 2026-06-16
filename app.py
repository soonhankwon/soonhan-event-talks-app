import os
import re
import hashlib
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# URL of the BigQuery Release Notes XML Feed
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for parsed release notes
cache = {
    "data": None,
    "last_fetched": None
}

def clean_html_spaces(html_text):
    """Clean redundant spaces, newlines, and tidy up the HTML for display."""
    if not html_text:
        return ""
    # Strip leading/trailing whitespace and normalize internal whitespace slightly
    # but keep standard HTML tags intact
    return html_text.strip()

def parse_xml_feed(xml_content):
    """Parses the BigQuery Atom feed XML and extracts individual updates."""
    # Register namespaces to parse correctly
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        app.logger.error(f"XML Parsing Error: {e}")
        return []

    updates = []
    
    # Iterate over each <entry> in the Atom feed
    for entry in root.findall('atom:entry', ns):
        title_elem = entry.find('atom:title', ns)
        updated_elem = entry.find('atom:updated', ns)
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        content_elem = entry.find('atom:content', ns)
        
        entry_title = title_elem.text if title_elem is not None else ""
        entry_updated = updated_elem.text if updated_elem is not None else ""
        entry_link = link_elem.attrib.get('href', '') if link_elem is not None else ""
        content_html = content_elem.text if content_elem is not None else ""
        
        if not content_html:
            continue
            
        # Standardize date format for UI
        # entry_title is usually something like "June 15, 2026"
        # If it's not a standard readable date, fallback to parsing entry_updated
        display_date = entry_title.strip()
        if not display_date and entry_updated:
            try:
                # e.g., "2026-06-15T00:00:00-07:00" -> "June 15, 2026"
                dt = datetime.fromisoformat(entry_updated)
                display_date = dt.strftime("%B %d, %Y")
            except Exception:
                display_date = entry_updated

        # Split content_html by <h3> tags
        # E.g. <h3>Feature</h3> <p>content</p> <h3>Change</h3> <p>content</p>
        # We match: <h3>Type</h3> Content
        # Using positive lookahead (?=<h3>|$) to split cleanly
        pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL)
        matches = pattern.findall(content_html)
        
        entry_updates = []
        
        if matches:
            for idx, (update_type, update_desc) in enumerate(matches):
                clean_type = update_type.strip()
                clean_desc = clean_html_spaces(update_desc)
                
                # Create a unique ID for this specific update
                unique_str = f"{display_date}_{clean_type}_{clean_desc[:100]}"
                update_id = hashlib.md5(unique_str.encode('utf-8')).hexdigest()
                
                # Create a clean direct link for the specific entry using the date anchor
                # E.g. https://docs.cloud.google.com/bigquery/docs/release-notes#June_15_2026
                # But since the page anchors might replace spaces with underscores, let's format it.
                anchor = display_date.replace(" ", "_").replace(",", "")
                # Clean up multiple underscores or extra characters if necessary
                anchor_link = f"https://docs.cloud.google.com/bigquery/docs/release-notes#{anchor}"
                
                entry_updates.append({
                    "id": update_id,
                    "date": display_date,
                    "raw_date": entry_updated,
                    "type": clean_type,
                    "content": clean_desc,
                    "link": anchor_link
                })
        else:
            # If no <h3> header was found, treat the whole content as one update
            unique_str = f"{display_date}_General_{content_html[:100]}"
            update_id = hashlib.md5(unique_str.encode('utf-8')).hexdigest()
            entry_updates.append({
                "id": update_id,
                "date": display_date,
                "raw_date": entry_updated,
                "type": "Update",
                "content": clean_html_spaces(content_html),
                "link": entry_link or "https://docs.cloud.google.com/bigquery/docs/release-notes"
            })
            
        updates.extend(entry_updates)
        
    return updates

@app.route('/')
def index():
    """Render the main client page."""
    return render_template('index.html')

@app.route('/api/releases', methods=['GET'])
def get_releases():
    """API endpoint to fetch and return BigQuery release notes."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # Return cached data if available and not forcing refresh
    if not force_refresh and cache["data"] is not None:
        return jsonify({
            "success": True,
            "source": "cache",
            "last_fetched": cache["last_fetched"],
            "data": cache["data"]
        })
        
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        parsed_updates = parse_xml_feed(response.text)
        
        # Update cache
        cache["data"] = parsed_updates
        cache["last_fetched"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        return jsonify({
            "success": True,
            "source": "live",
            "last_fetched": cache["last_fetched"],
            "data": parsed_updates
        })
        
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error fetching feed: {e}")
        
        # Fallback to cache if request fails
        if cache["data"] is not None:
            return jsonify({
                "success": False,
                "error": f"Failed to fetch live feed ({str(e)}). Displaying cached data.",
                "source": "cache_fallback",
                "last_fetched": cache["last_fetched"],
                "data": cache["data"]
            })
            
        return jsonify({
            "success": False,
            "error": f"Failed to fetch release notes: {str(e)}",
            "data": []
        }), 500

if __name__ == '__main__':
    # Retrieve port from env or use default 5001
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
