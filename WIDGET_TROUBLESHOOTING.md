# Widget Embedding Troubleshooting Guide

## Overview
This guide helps you troubleshoot common issues when embedding ReviewHub widgets on your website.

## Quick Checklist ✅

Before diving into detailed troubleshooting, check these common issues:

- [ ] Widget ID is correct and valid
- [ ] Your website allows external scripts (no CSP blocking)
- [ ] No ad blockers or security extensions blocking the widget
- [ ] Internet connection is stable
- [ ] Widget is marked as "Active" in your dashboard

## Common Issues and Solutions

### 1. Widget Not Loading at All

**Symptoms:**
- Nothing appears where the widget should be
- No error messages visible

**Solutions:**

#### Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for error messages related to ReviewHub

#### Verify Widget Code
```html
<!-- Correct JavaScript embed -->
<script src="https://your-domain.com/widget.js" data-widget-id="YOUR_WIDGET_ID"></script>

<!-- Correct iFrame embed -->
<iframe src="https://your-domain.com/embed/widget/YOUR_WIDGET_ID" 
        style="width: 100%; min-height: 400px; border: none;"
        title="Review Widget"></iframe>
```

#### Test Widget Independently
1. Use the test page generator in the widget modal
2. Open the test page in a new browser tab
3. If it works there, the issue is with your website's configuration

### 2. CORS (Cross-Origin) Errors

**Symptoms:**
- Console shows "CORS policy" errors
- Widget loads but shows error message

**Solutions:**

#### For Website Owners
Add these meta tags to your HTML head:
```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline' https://your-domain.com;">
<meta http-equiv="Content-Security-Policy" content="frame-src 'self' https://your-domain.com;">
```

#### For WordPress Users
Add to your theme's functions.php:
```php
function allow_reviewhub_widgets() {
    header("Content-Security-Policy: script-src 'self' 'unsafe-inline' https://your-domain.com;");
    header("Content-Security-Policy: frame-src 'self' https://your-domain.com;");
}
add_action('wp_head', 'allow_reviewhub_widgets');
```

### 3. Widget Shows "Loading..." Forever

**Symptoms:**
- Widget container appears but shows loading spinner indefinitely
- No reviews appear

**Possible Causes & Solutions:**

#### API Endpoint Issues
1. Check if the API endpoint is accessible:
   ```
   https://your-domain.com/api/public/widget-data/YOUR_WIDGET_ID
   ```
2. Open this URL directly in browser - should return JSON data

#### Network Connectivity
1. Check your internet connection
2. Try accessing the widget from a different network
3. Disable VPN if using one

#### Widget Configuration
1. Verify widget is marked as "Active" in dashboard
2. Check if business URL is properly connected
3. Ensure reviews exist for the connected business

### 4. Styling Issues

**Symptoms:**
- Widget appears but looks broken
- Text overlapping or incorrect colors
- Responsive issues on mobile

**Solutions:**

#### CSS Conflicts
Add this CSS to your website:
```css
.reviewhub-widget {
    font-family: inherit !important;
    box-sizing: border-box !important;
}

.reviewhub-widget * {
    box-sizing: border-box !important;
}
```

#### Use iFrame Instead
If CSS conflicts persist, switch to iFrame embed:
```html
<iframe src="https://your-domain.com/embed/widget/YOUR_WIDGET_ID" 
        style="width: 100%; min-height: 400px; border: none;"
        title="Review Widget"></iframe>
```

### 5. Widget Not Responsive on Mobile

**Solutions:**

#### Ensure Proper Viewport
Add to your HTML head:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

#### Container Width
Ensure the widget container has proper width:
```css
.widget-container {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
}
```

### 6. Performance Issues

**Symptoms:**
- Website loads slowly after adding widget
- Widget takes long time to appear

**Solutions:**

#### Lazy Loading
Add loading="lazy" to iFrame:
```html
<iframe src="https://your-domain.com/embed/widget/YOUR_WIDGET_ID" 
        loading="lazy"
        style="width: 100%; min-height: 400px; border: none;"
        title="Review Widget"></iframe>
```

#### Async Loading for JavaScript
```html
<script async src="https://your-domain.com/widget.js" data-widget-id="YOUR_WIDGET_ID"></script>
```

## Platform-Specific Instructions

### WordPress

#### Method 1: HTML Block
1. Add HTML block to your page/post
2. Paste the widget code
3. Publish/update the page

#### Method 2: Custom HTML Widget
1. Go to Appearance > Widgets
2. Add "Custom HTML" widget
3. Paste the widget code

#### Method 3: Theme Files
Add to your theme template files:
```php
<?php
// In your theme's template file
echo '<script src="https://your-domain.com/widget.js" data-widget-id="YOUR_WIDGET_ID"></script>';
?>
```

### Shopify

#### Method 1: Theme Editor
1. Go to Online Store > Themes
2. Click "Actions" > "Edit code"
3. Add widget code to appropriate template file

#### Method 2: Page Content
1. Create/edit a page
2. Click "Show HTML"
3. Paste the widget code

### Wix

1. Add HTML element to your page
2. Paste the widget code
3. Publish your site

### Squarespace

1. Add Code Block to your page
2. Paste the widget code
3. Save and publish

## Advanced Troubleshooting

### Debug Mode
Add debug parameter to see detailed logs:
```html
<script>
window.REVIEWHUB_DEBUG = true;
</script>
<script src="https://your-domain.com/widget.js" data-widget-id="YOUR_WIDGET_ID"></script>
```

### Manual Initialization
If automatic loading fails, try manual initialization:
```html
<div id="my-widget-container"></div>
<script src="https://your-domain.com/widget.js"></script>
<script>
window.ReviewHub.init({
    widgetId: 'YOUR_WIDGET_ID',
    containerId: 'my-widget-container'
});
</script>
```

### Network Analysis
1. Open browser developer tools
2. Go to Network tab
3. Reload page and check for failed requests
4. Look for 404, 500, or CORS errors

## Testing Tools

### Browser Compatibility Test
Test your widget in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

### Online Testing Tools
1. **CORS Test**: Use online CORS testers to verify API accessibility
2. **CSP Validator**: Check if your Content Security Policy allows the widget
3. **Mobile Simulator**: Test responsive behavior

## Getting Help

If you're still experiencing issues:

1. **Collect Information:**
   - Widget ID
   - Website URL where widget should appear
   - Browser and version
   - Error messages from console
   - Screenshots of the issue

2. **Contact Support:**
   - Include all collected information
   - Mention troubleshooting steps already tried
   - Provide access to test page if possible

## Best Practices

### Performance
- Use JavaScript embed for better performance
- Implement lazy loading for below-the-fold widgets
- Cache widget responses when possible

### Security
- Keep your widget code up to date
- Use HTTPS for all widget implementations
- Regularly review and update CSP policies

### User Experience
- Provide fallback content for when widgets fail to load
- Ensure widgets are accessible (screen readers, keyboard navigation)
- Test widgets regularly to ensure they're working

### SEO
- Use descriptive titles for iFrame embeds
- Consider server-side rendering for critical review content
- Implement structured data for reviews when possible

## Frequently Asked Questions

**Q: Can I customize the widget appearance?**
A: Yes, use the theme color parameter: `data-theme-color="#your-color"`

**Q: How often do reviews update?**
A: Reviews are cached for 5 minutes and update automatically

**Q: Can I use multiple widgets on one page?**
A: Yes, each widget needs a unique widget ID

**Q: Does the widget work with single-page applications (SPAs)?**
A: Yes, use manual initialization for dynamic content

**Q: Is the widget GDPR compliant?**
A: Yes, the widget doesn't collect personal data from visitors

---

*Last updated: [Current Date]*
*For technical support, contact: support@reviewhub.com* 