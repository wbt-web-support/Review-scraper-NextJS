const fetch = require('node-fetch');

async function createTestWidget() {
    try {
        console.log('Creating test widget...');
        
        const response = await fetch('http://localhost:3000/api/debug/create-test-widget', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Test widget created successfully!');
        console.log('Widget ID:', data.widget._id);
        console.log('Widget Name:', data.widget.name);
        console.log('Test URL:', data.testUrl);
        console.log('\n📋 Simple Embed Code:');
        console.log(`<script src="http://localhost:3000/widget.js" data-widget-id="${data.widget._id}"></script>`);
        console.log('\n📋 Embed Code with Theme:');
        console.log(`<script src="http://localhost:3000/widget.js" data-widget-id="${data.widget._id}" data-theme-color="#e74c3c"></script>`);
        
        return data.widget._id;
    } catch (error) {
        console.error('❌ Error creating test widget:', error.message);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    createTestWidget();
}

module.exports = createTestWidget; 