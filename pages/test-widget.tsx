import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export default function TestWidget() {
  const [widgetId, setWidgetId] = useState('6832c330dd506564ff9d8b8d'); // Default widget ID from the logs
  const [testMethod, setTestMethod] = useState<'javascript' | 'iframe'>('javascript');

  const domain = typeof window !== 'undefined' ? window.location.origin : '';

  const javascriptCode = `<script src="${domain}/widget.js" data-widget-id="${widgetId}"></script>`;
  const iframeCode = `<iframe src="${domain}/embed/widget/${widgetId}" style="width: 100%; min-height: 400px; border: none;" title="Review Widget"></iframe>`;

  const handleTestJavaScript = () => {
    // Remove any existing widgets
    const existingWidgets = document.querySelectorAll('.reviewhub-widget-container');
    existingWidgets.forEach(widget => widget.remove());

    // Create a new container
    const container = document.createElement('div');
    container.id = 'test-widget-container';
    document.getElementById('widget-test-area')?.appendChild(container);

    // Create and append the script
    const script = document.createElement('script');
    script.src = `${domain}/widget.js`;
    script.setAttribute('data-widget-id', widgetId);
    document.head.appendChild(script);
  };

  const handleTestIframe = () => {
    const testArea = document.getElementById('widget-test-area');
    if (testArea) {
      testArea.innerHTML = iframeCode;
    }
  };

  const handleClearTest = () => {
    const testArea = document.getElementById('widget-test-area');
    if (testArea) {
      testArea.innerHTML = '';
    }
    // Remove any dynamically added scripts
    const scripts = document.querySelectorAll('script[data-widget-id]');
    scripts.forEach(script => script.remove());
  };

  const handleTestAPI = async () => {
    try {
      const response = await fetch(`/api/public/widget-data/${widgetId}`);
      const data = await response.json();
      console.log('Widget API Response:', data);
      alert(`API Test: ${response.ok ? 'Success' : 'Failed'}\nCheck console for details`);
    } catch (error) {
      console.error('API Test Error:', error);
      alert('API Test Failed - Check console for details');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Widget Testing Page</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="widget-id">Widget ID</Label>
              <Input
                id="widget-id"
                value={widgetId}
                onChange={(e) => setWidgetId(e.target.value)}
                placeholder="Enter widget ID"
              />
            </div>
            
            <div>
              <Label>Test Method</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={testMethod === 'javascript' ? 'default' : 'outline'}
                  onClick={() => setTestMethod('javascript')}
                >
                  JavaScript
                </Button>
                <Button
                  variant={testMethod === 'iframe' ? 'default' : 'outline'}
                  onClick={() => setTestMethod('iframe')}
                >
                  iFrame
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button 
              onClick={testMethod === 'javascript' ? handleTestJavaScript : handleTestIframe}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Test {testMethod === 'javascript' ? 'JavaScript' : 'iFrame'} Widget
            </Button>
            <Button onClick={handleTestAPI} variant="outline">
              Test API Endpoint
            </Button>
            <Button onClick={handleClearTest} variant="outline">
              Clear Test
            </Button>
          </div>

          <div className="bg-gray-100 p-4 rounded-md">
            <h3 className="font-medium mb-2">Current Embed Code:</h3>
            <pre className="text-sm bg-gray-800 text-white p-3 rounded overflow-x-auto">
              {testMethod === 'javascript' ? javascriptCode : iframeCode}
            </pre>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Widget Test Area</h2>
          <div 
            id="widget-test-area" 
            className="min-h-[400px] border-2 border-dashed border-gray-300 rounded-lg p-4"
          >
            <p className="text-gray-500 text-center">
              Click "Test Widget" above to load the widget here
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Domain:</strong> {domain}</p>
            <p><strong>Widget ID:</strong> {widgetId}</p>
            <p><strong>API Endpoint:</strong> {domain}/api/public/widget-data/{widgetId}</p>
            <p><strong>iFrame URL:</strong> {domain}/embed/widget/{widgetId}</p>
            <p><strong>Widget Script:</strong> {domain}/widget.js</p>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Console Logs:</h3>
            <p className="text-sm text-gray-600">
              Open browser developer tools (F12) and check the Console tab for detailed logs from the widget.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 