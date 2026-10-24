import Layout from "../components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
const Help = () => {
  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Help & Support
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Get help with using ReviewHub and find answers to common questions
        </p>
      </div>

      <div className="">
        <div className="">
          <Card className="mb-6 rounded-2xl border-gray-200 shadow-none">
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
                      Automatically. Google reviews are checked every 4 days and Facebook reviews every 15 days. Each check
                      fetches only the reviews posted since the last one, so new reviews reach your widgets within a few days.
                    </p>
                    <p className="mt-2">
                      Need them sooner? Open the business on the Reviews page and click &ldquo;Recrawl&rdquo; to fetch everything now.
                      The dashboard&apos;s Review crawling line shows whether every client is up to date.
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
                      The Apify key is set up on the server by your agency, so there is nothing to enter here. The per-business
                      key for the reviews API is different: find it in each widget&apos;s Embed Code tab.
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
      </div>
    </Layout>
  );
};
export default Help;
