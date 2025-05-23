import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
const Help = () => {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-gray-800 dark:text-white mb-1">
          Help & Support
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Get help with using ReviewHub and find answers to common questions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Find answers to common questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a review widget?</AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">To create a review widget, follow these steps:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Go to the &ldquo;My Widgets&rdquo; page from the sidebar</li>
                      <li>Click the &ldquo;Create Widget&ldquo; button</li>
                      <li>Select a business source (Google or Facebook)</li>
                      <li>Customize the widget appearance</li>
                      <li>Click &ldquo;Create Widget&ldquo; to save</li>
                    </ol>
                    <p className="mt-2">
                      Once created, you can get the embed code by clicking &ldquo;Get Code&ldquo; on the widget card.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger>How do I add a new business to scrape reviews from?</AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">To add a new business for review scraping:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Go to the &ldquo;Reviews&ldquo; page from the sidebar</li>
                      <li>Click the &ldquo;Add Business&ldquo; button</li>
                      <li>Enter the business name</li>
                      <li>Select the source (Google or Facebook)</li>
                      <li>Enter the URL to the Google Maps listing or Facebook page reviews tab</li>
                      <li>Click &ldquo;Add Business&ldquo; to save</li>
                    </ol>
                    <p className="mt-2">
                      After adding a business, select it from the dropdown and click &ldquo;Scrape Reviews&ldquo; to fetch the latest reviews.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger>How often are reviews updated?</AccordionTrigger>
                  <AccordionContent>
                    <p>
                      Reviews are not automatically updated. You need to manually refresh the reviews by going to the Reviews page,
                      selecting the business, and clicking the &ldquo;Refresh Reviews&ldquo; button. We recommend doing this periodically to
                      ensure your widgets display the latest reviews.
                    </p>
                    <p className="mt-2">
                      In the future, we plan to add automatic review updates based on your subscription plan.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger>What is the Apify API key used for?</AccordionTrigger>
                  <AccordionContent>
                    <p>
                      The Apify API key is used to scrape reviews from Google Maps and Facebook. Apify is a third-party service
                      that provides web scraping capabilities. ReviewHub uses Apify&apos;s actors to fetch reviews in a reliable and
                      efficient way.
                    </p>
                    <p className="mt-2">
                      You can get your own Apify API key by signing up at <a href="https://apify.com" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">apify.com</a>. 
                      Once you have the key, you can add it in the Settings page under the API Keys tab.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-5">
                  <AccordionTrigger>How do I embed the widget on my website?</AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">
                      To embed a widget on your website:
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Go to the &ldquo;My Widgets&ldquo; page</li>
                      <li>Find the widget you want to embed</li>
                      <li>Click &ldquo;Get Code&ldquo; on the widget card</li>
                      <li>Copy either the JavaScript or iFrame code</li>
                      <li>Paste the code into your website where you want the widget to appear</li>
                    </ol>
                    <p className="mt-2">
                      We recommend using the JavaScript embed code for better integration and functionality.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Video Tutorials</CardTitle>
              <CardDescription>
                Watch step-by-step tutorials to learn how to use ReviewHub
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-play-circle text-4xl text-gray-400"></i>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Getting Started with ReviewHub</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">3:45 • Basic overview of the dashboard</p>
                  </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-play-circle text-4xl text-gray-400"></i>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Creating Your First Widget</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">5:12 • Step-by-step guide</p>
                  </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-play-circle text-4xl text-gray-400"></i>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Widget Customization Options</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">4:30 • Exploring all customization features</p>
                  </div>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <i className="fas fa-play-circle text-4xl text-gray-400"></i>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Embedding Widgets on Your Website</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">3:20 • Implementation guide</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
              <CardDescription>
                Need further assistance? Contact our support team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-500 dark:text-primary-300 mr-3 flex-shrink-0">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">Email Support</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Send us an email and we&apos;ll get back to you within 24 hours
                    </p>
                    <a 
                      href="mailto:support@reviewhub.example.com" 
                      className="inline-block mt-2 text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
                    >
                      support@reviewhub.example.com
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-500 dark:text-primary-300 mr-3 flex-shrink-0">
                    <i className="fas fa-comments"></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">Live Chat</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Chat with our support team in real-time
                    </p>
                    <Button 
                      className="mt-2"
                      size="sm"
                    >
                      <i className="fas fa-comment-dots mr-2"></i>
                      Start Chat
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-500 dark:text-primary-300 mr-3 flex-shrink-0">
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">Documentation</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                      Explore our comprehensive documentation
                    </p>
                    <a 
                      href="#documentation" 
                      className="inline-block mt-2 text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
                    >
                      View Documentation
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
              <CardDescription>
                Useful resources and links
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="#api-docs" 
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition duration-150"
                  >
                    <i className="fas fa-code mr-2 text-gray-500 dark:text-gray-500"></i>
                    API Documentation
                  </a>
                </li>
                <li>
                  <a 
                    href="#pricing" 
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition duration-150"
                  >
                    <i className="fas fa-tag mr-2 text-gray-500 dark:text-gray-500"></i>
                    Pricing Plans
                  </a>
                </li>
                <li>
                  <a 
                    href="#integrations" 
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition duration-150"
                  >
                    <i className="fas fa-puzzle-piece mr-2 text-gray-500 dark:text-gray-500"></i>
                    Integrations
                  </a>
                </li>
                <li>
                  <a 
                    href="#changelog" 
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition duration-150"
                  >
                    <i className="fas fa-history mr-2 text-gray-500 dark:text-gray-500"></i>
                    Changelog
                  </a>
                </li>
                <li>
                  <a 
                    href="#blog" 
                    className="flex items-center text-gray-700 dark:text-gray-300 hover:text-primary-500 dark:hover:text-primary-400 transition duration-150"
                  >
                    <i className="fas fa-rss mr-2 text-gray-500 dark:text-gray-500"></i>
                    Blog
                  </a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};
export default Help;
