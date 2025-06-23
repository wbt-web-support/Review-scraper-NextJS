import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
const Help = () => {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold mb-1">
          Help & Support
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Get help with using ReviewHub and find answers to common questions
        </p>
      </div>

      <div className="">
        <div className="">
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

        </div>

   
      </div>
    </Layout>
  );
};
export default Help;
