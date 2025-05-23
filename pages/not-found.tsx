import { Card, CardContent } from "../components/ui/card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background dark:bg-background transition-theme">
      <Card className="w-full max-w-md mx-4 border border-border dark:border-border shadow-sm transition-theme">
        <CardContent className="pt-6">
          <div className="flex items-center mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive dark:text-destructive transition-theme" />
            <h1 className="text-2xl font-bold text-foreground dark:text-foreground transition-theme">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground dark:text-muted-foreground transition-theme">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          
          <div className="mt-6 text-center">
            <Link 
              href="/" 
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-theme"
            >
              Return Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
